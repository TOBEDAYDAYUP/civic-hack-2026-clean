-- The full notice export succeeds after roughly 90 seconds, then the atomic
-- source batch can exceed PostgREST's inherited 8-second statement timeout.
-- Scope this allowance to the existing service-role-only ingestion function.
-- The Node HTTP budget (120s) + this commit budget (45s) fits the 180s lease.
alter function public.civic_commit_source_sync(uuid, jsonb)
  set statement_timeout = '45s';

notify pgrst, 'reload schema';

-- Rollback: alter function public.civic_commit_source_sync(uuid, jsonb)
--   reset statement_timeout;
-- notify pgrst, 'reload schema';
