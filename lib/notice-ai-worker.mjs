/** Poll committed source revisions. Keep failed jobs queued without blocking newer notices. */
export function createNoticeAiCycle({
  since,
  readChanges,
  analyze,
  sync,
  syncIntervalMs = 15 * 60_000,
  now = Date.now,
  log = console.log,
  warn = console.error,
  signal,
}) {
  let cursor = { updatedAt: since, id: '' };
  let nextSync = -Infinity;
  const pending = new Map();
  const batchSize = 3;
  const queueCapacity = 100;

  return async function cycle() {
    if (signal?.aborted) return;
    let sourceFailed = false;
    if (sync && now() >= nextSync) {
      nextSync = now() + syncIntervalMs;
      try {
        const result = await sync();
        log(
          result.skipped
            ? 'Source sync skipped: another sync is running.'
            : `Toronto source: ${result.changed} changed out of ${result.fetched}.`,
        );
      } catch (error) {
        sourceFailed = true;
        warn(`Toronto source sync failed. Will retry on its next interval: ${error.message}`);
      }
    }

    const capacity = queueCapacity - pending.size;
    if (capacity > 0 && !signal?.aborted) {
      try {
        const rows = await readChanges(cursor, Math.min(20, capacity));
        for (const row of rows) {
          // A new revision replaces any failed attempt for the same notice.
          const old = pending.get(row.id);
          if (old?.hash !== row.source_hash) {
            pending.set(row.id, { hash: row.source_hash, attempts: 0, readyAt: 0 });
          }
          cursor = { updatedAt: row.updated_at, id: row.id };
        }
        if (rows.length)
          log(`Found ${rows.length} source revisions; ${pending.size} notices queued.`);
      } catch (error) {
        sourceFailed = true;
        warn(`Could not check for source revisions. Will retry: ${error.message}`);
      }
    }

    let attempted = 0;
    let failed = 0;
    // Attempt fresh work before retries so bad notices cannot monopolize a cycle.
    const candidates = [...pending].sort((a, b) => a[1].attempts - b[1].attempts);
    for (const [id, job] of candidates) {
      if (attempted >= batchSize || signal?.aborted) break;
      if (job.readyAt > now()) continue;
      attempted++;
      try {
        await analyze(id);
        pending.delete(id);
      } catch (error) {
        if (signal?.aborted) break;
        failed++;
        job.attempts++;
        const retryMs = Math.min(300_000, 15_000 * 2 ** Math.min(job.attempts - 1, 5));
        job.readyAt = now() + retryMs;
        warn(
          `Notice ${id} was not processed: ${error.message}. Retrying in at least ${retryMs / 1000}s.`,
        );
      }
    }
    return { attempted, failed, pending: pending.size, sourceFailed };
  };
}
