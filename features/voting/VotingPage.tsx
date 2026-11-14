import { getTranslator } from '@/features/language/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { readVoteResults, votesPerPage, type VoteResult } from './vote-results';
import '@/features/records/records.css';
import './voting.css';
import { SourceLanguageNote } from '@/features/language/LanguageProvider';

const voteLabels = [
  ['yes', 'Yes'],
  ['no', 'No'],
  ['absent', 'Absent'],
] as const;

function pageLink(query: string, page: number) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (page > 1) params.set('page', String(page));
  return params.size ? '/voting?' + params.toString() : '/voting';
}

async function VoteCard({ vote }: { vote: VoteResult }) {
  const { t, intlLocale } = await getTranslator();
  const text = vote.motion_text || vote.decision_text;
  const official = new URL('https://secure.toronto.ca/council/agenda-item.do');
  official.searchParams.set('item', vote.reference);
  const date = new Intl.DateTimeFormat(intlLocale, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(vote.vote_date + 'T00:00:00Z'),
  );
  const total = vote.yes + vote.no + vote.absent;

  return (
    <article className="vote-card">
      <div className="vote-meta">
        <span>{vote.reference}</span>
        <time dateTime={vote.vote_date + (vote.vote_time ? 'T' + vote.vote_time : '')}>
          {date}
          {vote.vote_time && ' · ' + vote.vote_time + ' ET'}
        </time>
      </div>
      <h2 lang="en">{vote.title || vote.reference}</h2>
      <div className="vote-outcome" lang="en">
        {vote.motion_type && <span>{vote.motion_type}</span>}
        {vote.result && <strong>{vote.result}</strong>}
      </div>
      <dl className="vote-counts">
        {voteLabels.map(([key, label]) => (
          <div key={key} className={'vote-' + key}>
            <dt>{t(label)}</dt>
            <dd>{vote[key]}</dd>
          </div>
        ))}
      </dl>
      {total > 0 && (
        <div className="vote-bar" aria-hidden="true">
          {voteLabels.map(([key]) => (
            <span key={key} className={'vote-' + key} style={{ flexGrow: vote[key] }} />
          ))}
        </div>
      )}
      {text && (
        <details>
          <summary>{t(vote.motion_text ? 'Read motion text' : 'Read decision text')}</summary>
          <p lang="en">{text}</p>
        </details>
      )}
      <a className="vote-source" href={official.href}>
        {t('Official agenda item ')}
        <span aria-hidden="true">↗</span>
      </a>
    </article>
  );
}

export default async function VotingPage({
  params,
}: {
  params: { q?: string | string[]; page?: string | string[] };
}) {
  const { t, intlLocale } = await getTranslator();
  const query = typeof params.q === 'string' ? params.q.trim().slice(0, 100) : '';
  const page = typeof params.page === 'string' ? Number(params.page) : 1;
  const currentPage = Number.isSafeInteger(page) && page > 0 && page <= 100_000 ? page : 1;
  let results;
  try {
    results = await readVoteResults(query, currentPage);
  } catch (error) {
    console.error('Unable to read public voting results:', error);
  }
  if (results === null) redirect(pageLink(query, 1));
  const lastPage = results ? Math.ceil(results.total / votesPerPage) : 0;
  if (currentPage > 1 && results && currentPage > lastPage) redirect(pageLink(query, 1));

  return (
    <section className="route-page civic-voting">
      <div className="voting-hero civic-banner">
        <h1>{t('2026 voting records')}</h1>
        <p>{t('Explore recorded votes from Toronto City Council and its committees.')}</p>
      </div>

      <SourceLanguageNote />
      <form className="vote-search" action="/voting" role="search">
        <label htmlFor="vote-query">{t('Find a vote')}</label>
        <div>
          <input
            type="search"
            id="vote-query"
            name="q"
            placeholder={t('Search by agenda item or title')}
            maxLength={100}
            defaultValue={query}
          />
          <button type="submit">{t('Search')}</button>
        </div>
      </form>
      {!results && (
        <p className="vote-message" role="status">
          {t('Voting records are temporarily unavailable.')}{' '}
          <a href={pageLink(query, currentPage)}>{t('Try again')}</a>
        </p>
      )}
      {results?.total === 0 && (
        <p className="vote-message">
          {t(query ? 'No voting records match your search. ' : 'No 2026 votes are available yet.')}
          {query && <Link href="/voting">{t('Clear search')}</Link>}
        </p>
      )}
      {results && results.total > 0 && (
        <>
          <div className="vote-list-heading">
            <p>
              {results.total.toLocaleString(intlLocale)} {t(results.total === 1 ? 'vote' : 'votes')}
              {t(' · Newest first')}
            </p>
            {query && <Link href="/voting">{t('Clear search')}</Link>}
          </div>
          <div className="vote-grid">
            {results.rows.map((vote) => (
              <VoteCard key={vote.id} vote={vote} />
            ))}
          </div>
          {lastPage > 1 && (
            <nav className="vote-pagination" aria-label={t('Voting results pages')}>
              {currentPage > 1 && (
                <Link href={pageLink(query, currentPage - 1)}>{t('← Previous')}</Link>
              )}
              <span>
                {t('Page ')}
                {currentPage}
                {t(' of ')}
                {lastPage}
              </span>
              {currentPage < lastPage && (
                <Link href={pageLink(query, currentPage + 1)}>{t('Next →')}</Link>
              )}
            </nav>
          )}
        </>
      )}
    </section>
  );
}
