create table public.civic_agenda_snapshot (
  id smallint primary key check (id = 1),
  collected_at timestamptz not null,
  items jsonb not null check (jsonb_typeof(items) = 'array')
);

alter table public.civic_agenda_snapshot enable row level security;
revoke all on public.civic_agenda_snapshot from public, anon, authenticated;
grant select on public.civic_agenda_snapshot to anon, authenticated;
grant select, insert, update on public.civic_agenda_snapshot to service_role;

create policy "Public can read the published agenda snapshot"
  on public.civic_agenda_snapshot for select to anon, authenticated using (true);

notify pgrst, 'reload schema';
