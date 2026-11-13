create table public.civic_notice_titles (notice_id text primary key, original_title text not null, short_title text not null check (char_length(short_title) between 5 and 90), model text not null, generated_at timestamptz not null default now());
alter table public.civic_notice_titles enable row level security;
revoke all on public.civic_notice_titles from anon,authenticated;
grant select on public.civic_notice_titles to anon;
grant all on public.civic_notice_titles to service_role;
create policy "Read shortened public titles" on public.civic_notice_titles for select to anon using(true);
notify pgrst,'reload schema';
