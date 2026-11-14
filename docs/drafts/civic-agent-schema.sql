-- DRAFT ONLY: do not apply until reviewed against the actual Supabase schema and roles.
-- This is additive; it does not alter civic_source_notices, civic_notices or their feed.
begin;
create table public.agent_sources (
  source text not null, external_id text not null, source_url text not null,
  record_type text not null check (record_type in ('public_notice','motion_vote')),
  title text not null default '', occurred_at_text text, agenda_reference text,
  payload jsonb not null, content_hash text not null,
  first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
  last_changed_at timestamptz not null default now(), primary key (source, external_id)
);
create table public.agent_issues (
  issue_key text primary key, official_reference text, title text not null default '',
  review_status text not null default 'pending_review' check (review_status in ('pending_review','confirmed','rejected')),
  created_at timestamptz not null default now()
);
create table public.agent_issue_sources (
  issue_key text not null references public.agent_issues(issue_key), source text not null,
  external_id text not null, method text not null, evidence text not null,
  review_status text not null default 'pending_review' check (review_status in ('pending_review','confirmed','rejected')),
  reviewed_at timestamptz, primary key(issue_key,source,external_id),
  foreign key(source,external_id) references public.agent_sources(source,external_id)
);
create table public.agent_timeline_events (
  id bigint generated always as identity primary key, issue_key text not null references public.agent_issues(issue_key),
  source text not null, external_id text not null,
  event_type text not null check(event_type in ('notice','motion_vote','meeting','decision')),
  event_date timestamptz, evidence jsonb not null, review_status text not null default 'pending_review'
    check(review_status in ('pending_review','confirmed','rejected')),
  foreign key(source,external_id) references public.agent_sources(source,external_id),
  unique(issue_key,source,external_id,event_type)
);
alter table public.agent_sources enable row level security;
alter table public.agent_issues enable row level security;
alter table public.agent_issue_sources enable row level security;
alter table public.agent_timeline_events enable row level security;
revoke all on public.agent_sources,public.agent_issues,public.agent_issue_sources,public.agent_timeline_events from public,anon,authenticated;
grant all on public.agent_sources,public.agent_issues,public.agent_issue_sources,public.agent_timeline_events to service_role;
grant usage,select on sequence public.agent_timeline_events_id_seq to service_role;

-- Admin-only transactional ingestion. No vote is promoted to a final decision.
create function public.agent_ingest_source_batch(records jsonb) returns integer
language plpgsql security invoker set search_path = '' as $$
declare r jsonb; k text; n integer := 0; previous_hash text;
begin
 if jsonb_typeof(records) <> 'array' or jsonb_array_length(records) < 1 or jsonb_array_length(records) > 1000 then raise exception 'Invalid batch'; end if;
 for r in select * from jsonb_array_elements(records) loop
  if coalesce(r->>'source','') not in ('toronto_public_notice','toronto_open_data_vote') or coalesce(r->>'external_id','')='' or coalesce(r->>'source_url','') !~ '^https://(secure\.toronto\.ca|open\.toronto\.ca)/' or coalesce(r->>'content_hash','') !~ '^[0-9a-f]{64}$' then raise exception 'Invalid source record'; end if;
  select content_hash into previous_hash from public.agent_sources where source=r->>'source' and external_id=r->>'external_id';
  if previous_hash is not null and previous_hash is distinct from r->>'content_hash' then
   update public.agent_issue_sources set review_status='pending_review',reviewed_at=null where source=r->>'source' and external_id=r->>'external_id' and review_status='confirmed';
   update public.agent_timeline_events set review_status='pending_review' where source=r->>'source' and external_id=r->>'external_id' and review_status='confirmed';
  end if;
  insert into public.agent_sources(source,external_id,source_url,record_type,title,occurred_at_text,agenda_reference,payload,content_hash)
  values(r->>'source',r->>'external_id',r->>'source_url',r->>'record_type',coalesce(r->>'title',''),r->>'occurred_at_text',r->>'agenda_reference',r->'payload',r->>'content_hash')
  on conflict(source,external_id) do update set source_url=excluded.source_url,record_type=excluded.record_type,title=excluded.title,occurred_at_text=excluded.occurred_at_text,agenda_reference=excluded.agenda_reference,payload=excluded.payload,last_changed_at=case when public.agent_sources.content_hash is distinct from excluded.content_hash then now() else public.agent_sources.last_changed_at end,content_hash=excluded.content_hash,last_seen_at=now();
  if r->>'source'='toronto_open_data_vote' and r->>'record_type'='motion_vote' and r->>'agenda_reference' ~ '^\d{4}\.[A-Z]{2,8}\d+\.\d+$' then
   k := 'agenda:' || (r->>'agenda_reference');
   insert into public.agent_issues(issue_key,official_reference,title) values(k,r->>'agenda_reference',coalesce(r->>'title','')) on conflict do nothing;
   insert into public.agent_issue_sources(issue_key,source,external_id,method,evidence) values(k,r->>'source',r->>'external_id','official_agenda_identifier',r->>'agenda_reference') on conflict do nothing;
   insert into public.agent_timeline_events(issue_key,source,external_id,event_type,evidence) values(k,r->>'source',r->>'external_id','motion_vote',jsonb_build_object('source_url',r->>'source_url','date_text',r->>'occurred_at_text')) on conflict(issue_key,source,external_id,event_type) do update set evidence=excluded.evidence;
  end if;
  n := n+1;
 end loop;
 return n;
end $$;
revoke all on function public.agent_ingest_source_batch(jsonb) from public,anon,authenticated;
grant execute on function public.agent_ingest_source_batch(jsonb) to service_role;
commit;
