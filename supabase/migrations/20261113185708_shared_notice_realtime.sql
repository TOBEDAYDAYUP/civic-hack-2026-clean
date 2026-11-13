-- Additive migration for the existing public civic source/AI tables.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.civic_sync_state (
  id text primary key check (id = 'toronto-notices'),
  lease_token uuid,
  lease_until timestamptz,
  last_started_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  fetched integer not null default 0,
  changed integer not null default 0
);
alter table public.civic_sync_state enable row level security;
revoke all on public.civic_sync_state from anon, authenticated;
grant select (id,last_started_at,last_success_at,last_error,fetched,changed) on public.civic_sync_state to anon;
grant all on public.civic_sync_state to service_role;
create policy "Read public sync status" on public.civic_sync_state for select to anon using (true);

create or replace function public.civic_acquire_sync_lease() returns uuid
language plpgsql security invoker set search_path = '' as $$
declare acquired uuid;
begin
  insert into public.civic_sync_state (id,lease_token,lease_until,last_started_at)
  values ('toronto-notices',gen_random_uuid(),now()+interval '180 seconds',now())
  on conflict (id) do update set lease_token=excluded.lease_token,
    lease_until=excluded.lease_until,last_started_at=excluded.last_started_at
  where public.civic_sync_state.lease_until is null or public.civic_sync_state.lease_until < now()
  returning lease_token into acquired;
  return acquired;
end $$;
revoke all on function public.civic_acquire_sync_lease() from public,anon,authenticated;
grant execute on function public.civic_acquire_sync_lease() to service_role;

create or replace function public.civic_commit_source_sync(token uuid, records jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare affected integer;
begin
  perform 1 from public.civic_sync_state where id='toronto-notices' and lease_token=token and lease_until>now() for update;
  if not found then raise exception 'Sync lease expired or replaced'; end if;
  if jsonb_typeof(records) <> 'array' or jsonb_array_length(records)=0 or jsonb_array_length(records)>20000 then
    raise exception 'Invalid or empty source batch';
  end if;
  if exists (select 1 from jsonb_array_elements(records) r where coalesce(r->>'id','')='' or coalesce(r->'payload'->>'title','')='' or coalesce(r->>'source_hash','')='' or r->>'id' is distinct from r->'payload'->>'id') then
    raise exception 'Invalid source record';
  end if;
  insert into public.civic_source_notices (id,source_hash,notice_date,payload,updated_at)
  select r.id,r.source_hash,r.notice_date,r.payload,now()
  from jsonb_to_recordset(records) as r(id text,source_hash text,notice_date timestamptz,payload jsonb)
  on conflict (id) do update set source_hash=excluded.source_hash,notice_date=excluded.notice_date,
    payload=excluded.payload,updated_at=excluded.updated_at
  where public.civic_source_notices.source_hash is distinct from excluded.source_hash;
  get diagnostics affected = row_count;
  update public.civic_sync_state set lease_token=null,lease_until=null,last_success_at=now(),
    last_error=null,fetched=jsonb_array_length(records),changed=affected where id='toronto-notices';
  return jsonb_build_object('fetched',jsonb_array_length(records),'changed',affected);
end $$;
revoke all on function public.civic_commit_source_sync(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.civic_commit_source_sync(uuid,jsonb) to service_role;
grant select,insert,update on public.civic_source_notices to service_role;

do $$ begin
  if not exists(select 1 from pg_publication where pubname='supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='civic_source_notices') then
    alter publication supabase_realtime add table public.civic_source_notices;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='civic_notices') then
    alter publication supabase_realtime add table public.civic_notices;
  end if;
end $$;
notify pgrst, 'reload schema';
