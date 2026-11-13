-- Run once in Supabase SQL Editor.
-- Public civic notices can be read anonymously, but only the private administrator
-- script (using SUPABASE_SECRET_KEY / service_role) may insert or modify them.
create table if not exists public.civic_notices (
  id text primary key,
  source_hash text not null,
  notice_date timestamptz,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists civic_notices_notice_date_idx
  on public.civic_notices (notice_date desc);

alter table public.civic_notices enable row level security;

-- Explicit grants, not just RLS: remove direct write access to regular API users.
revoke all on table public.civic_notices from anon, authenticated;
grant usage on schema public to anon;
grant select on table public.civic_notices to anon;

drop policy if exists "Anyone can read civic notices" on public.civic_notices;
create policy "Anyone can read civic notices"
  on public.civic_notices
  for select to anon using (true);

-- No public insert/update/delete RLS policies.
-- The secret service-role key must only be used on the administrator's machine.


-- Public raw-source archive (independent of the capped local AI batch).
create table if not exists public.civic_source_notices (
  id text primary key,
  source_hash text not null,
  notice_date timestamptz,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists civic_source_notices_date_idx
  on public.civic_source_notices (notice_date desc);
alter table public.civic_source_notices enable row level security;
revoke all on table public.civic_source_notices from anon, authenticated;
grant select on table public.civic_source_notices to anon;
drop policy if exists "Public can read source notices" on public.civic_source_notices;
create policy "Public can read source notices"
  on public.civic_source_notices for select to anon using (true);

-- One read-only feed: show current AI summaries only when the source hash matches.
-- RLS is enforced for both underlying tables via security_invoker=true.
create or replace view public.civic_notice_feed with (security_invoker=true) as
select
  coalesce(s.id,p.id) as id,
  coalesce(s.notice_date,p.notice_date) as notice_date,
  case when p.id is not null and (s.id is null or s.source_hash=p.source_hash)
    then p.payload else s.payload end as payload,
  (p.id is not null and (s.id is null or s.source_hash=p.source_hash)) as ai_ready
from public.civic_source_notices s
full outer join public.civic_notices p on p.id=s.id;
revoke all on public.civic_notice_feed from anon, authenticated;
grant select on public.civic_notice_feed to anon;
notify pgrst, 'reload schema';
