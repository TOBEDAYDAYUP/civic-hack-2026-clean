-- Store source evidence and derived agenda references in separate staging tables.
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

create index agent_issue_sources_source_idx
  on public.agent_issue_sources (source, external_id);
create index agent_timeline_events_source_idx
  on public.agent_timeline_events (source, external_id);

create function public.agent_ingest_source_batch(records jsonb) returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  record_source text;
  record_id text;
  agenda text;
  agenda_key text;
  seen_at timestamptz := clock_timestamp();
begin
  if jsonb_typeof(records) is distinct from 'array' then
    raise exception 'Expected an array of source records' using errcode = '22023';
  end if;
  if jsonb_array_length(records) not between 1 and 1000 then
    raise exception 'Expected 1 to 1000 source records' using errcode = '22023';
  end if;

  for item in
    select entry
    from jsonb_array_elements(records) as batch(entry)
    order by entry->>'source', entry->>'external_id'
  loop
    record_source := item->>'source';
    record_id := item->>'external_id';
    agenda := item->>'agenda_reference';

    if coalesce(btrim(record_id), '') = ''
      or jsonb_typeof(item->'payload') is distinct from 'object'
      or coalesce(item->>'content_hash', '') !~ '^[0-9a-f]{64}$'
      or not coalesce(
        (record_source = 'toronto_public_notice'
          and item->>'record_type' = 'public_notice'
          and item->>'source_url' ~ '^https://secure[.]toronto[.]ca/'
          and agenda is null)
        or (record_source = 'toronto_open_data_vote'
          and item->>'record_type' = 'motion_vote'
          and item->>'source_url' ~ '^https://open[.]toronto[.]ca/'
          and (agenda is null or agenda ~ '^[0-9]{4}[.][A-Z]{2,8}[0-9]+[.][0-9]+$')),
        false
      )
    then
      raise exception 'Invalid civic agent source record' using errcode = '22023';
    end if;

    -- The upsert locks the source row before dependent review state is updated.
    insert into public.agent_sources as stored (
      source, external_id, source_url, record_type, title, occurred_at_text,
      agenda_reference, payload, content_hash, first_seen_at, last_seen_at, last_changed_at
    ) values (
      record_source, record_id, item->>'source_url', item->>'record_type',
      coalesce(item->>'title', ''), item->>'occurred_at_text',
      agenda, item->'payload', item->>'content_hash', seen_at, seen_at, seen_at
    )
    on conflict (source, external_id) do update set
      source_url = excluded.source_url,
      title = excluded.title,
      occurred_at_text = excluded.occurred_at_text,
      agenda_reference = excluded.agenda_reference,
      payload = excluded.payload,
      content_hash = excluded.content_hash,
      last_seen_at = greatest(stored.last_seen_at, excluded.last_seen_at),
      last_changed_at = greatest(stored.last_changed_at, clock_timestamp())
    where stored.content_hash is distinct from excluded.content_hash;

    if found then
      agenda_key := case when agenda is not null then 'agenda:' || agenda end;

      delete from public.agent_timeline_events as event
      using public.agent_issue_sources as link
      where event.source = record_source and event.external_id = record_id
        and event.event_type = 'motion_vote'
        and (event.issue_key, event.source, event.external_id) =
          (link.issue_key, link.source, link.external_id)
        and link.method = 'official_agenda_identifier'
        and link.issue_key is distinct from agenda_key;

      delete from public.agent_issue_sources
      where source = record_source and external_id = record_id
        and method = 'official_agenda_identifier'
        and issue_key is distinct from agenda_key;

      update public.agent_issue_sources
      set review_status = 'pending_review', reviewed_at = null
      where source = record_source and external_id = record_id and review_status = 'confirmed';

      update public.agent_timeline_events
      set review_status = 'pending_review'
      where source = record_source and external_id = record_id and review_status = 'confirmed';

      if agenda_key is not null then
        insert into public.agent_issues (issue_key, official_reference, title)
        values (agenda_key, agenda, coalesce(item->>'title', ''))
        on conflict (issue_key) do nothing;

        insert into public.agent_issue_sources (issue_key, source, external_id, method, evidence)
        values (agenda_key, record_source, record_id, 'official_agenda_identifier', agenda)
        on conflict (issue_key, source, external_id) do nothing;

        insert into public.agent_timeline_events (issue_key, source, external_id, event_type, evidence)
        values (agenda_key, record_source, record_id, 'motion_vote', jsonb_build_object(
          'source_url', item->>'source_url', 'date_text', item->>'occurred_at_text'
        ))
        on conflict (issue_key, source, external_id, event_type) do update
        set evidence = excluded.evidence;
      end if;
    else
      update public.agent_sources
      set last_seen_at = greatest(last_seen_at, seen_at)
      where source = record_source and external_id = record_id;
    end if;
  end loop;

  return jsonb_array_length(records);
end;
$$;

revoke all on function public.agent_ingest_source_batch(jsonb) from public, anon, authenticated;
grant execute on function public.agent_ingest_source_batch(jsonb) to service_role;

commit;
