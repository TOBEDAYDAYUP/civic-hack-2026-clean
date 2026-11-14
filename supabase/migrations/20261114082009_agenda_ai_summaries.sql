create table public.civic_agenda_summaries (
  item_key text primary key check (length(item_key) between 5 and 120),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  short_title text not null check (length(short_title) between 8 and 110),
  summary text not null check (length(summary) between 25 and 420),
  model text not null,
  generated_at timestamptz not null default now()
);
alter table public.civic_agenda_summaries enable row level security;
revoke all on public.civic_agenda_summaries from public, anon, authenticated;
grant select on public.civic_agenda_summaries to anon, authenticated;
grant select, insert, update on public.civic_agenda_summaries to service_role;
create policy "Public can read published agenda summaries"
  on public.civic_agenda_summaries for select to anon, authenticated using (true);
notify pgrst, 'reload schema';
