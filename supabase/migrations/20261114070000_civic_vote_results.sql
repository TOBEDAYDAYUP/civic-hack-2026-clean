begin;

-- Publish only the summary fields used by the voting archive.
create view public.civic_vote_results as
select
  external_id as id,
  agenda_reference as reference,
  title,
  left(occurred_at_text, 10) as vote_date,
  coalesce(substring(occurred_at_text from ' ([0-2][0-9]:[0-5][0-9])'), '') as vote_time,
  payload->>'motion_type' as motion_type,
  payload->>'result' as result,
  (payload->>'yes')::integer as yes,
  (payload->>'no')::integer as no,
  (payload->>'absent')::integer as absent,
  payload->>'motion_text' as motion_text,
  payload->>'decision_text' as decision_text
from public.agent_sources
where source = 'toronto_open_data_vote'
  and record_type = 'motion_vote'
  and (external_id like 'motion:%' or external_id like 'aggregate:%')
  and agenda_reference ~ '^[0-9]{4}\.[A-Z]+[0-9]+\.[0-9]+$'
  and occurred_at_text ~ '^2026-[0-9]{2}-[0-9]{2}($| )'
  and jsonb_typeof(payload->'yes') = 'number'
  and jsonb_typeof(payload->'no') = 'number'
  and jsonb_typeof(payload->'absent') = 'number';

revoke all on public.civic_vote_results from public, anon, authenticated;
grant select on public.civic_vote_results to anon, authenticated;
notify pgrst, 'reload schema';

commit;
