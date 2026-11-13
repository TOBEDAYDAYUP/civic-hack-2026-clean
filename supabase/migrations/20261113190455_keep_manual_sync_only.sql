-- User chose manual synchronization only. These extensions were added by the preceding migration.
do $$ begin
 if exists(select 1 from cron.job where jobname<>'civic-notices-every-five-minutes') then raise exception 'Other cron jobs exist; do not remove scheduling extensions'; end if;
end $$;
drop extension if exists pg_net;
drop extension if exists pg_cron;
