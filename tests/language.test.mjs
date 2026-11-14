import test from 'node:test';
import assert from 'node:assert/strict';
import {
  french,
  normalizeLocale,
  translate,
  safeReturnPath,
} from '../features/language/messages.mjs';

test('only supported locale values can select a dictionary', () => {
  assert.equal(normalizeLocale('fr'), 'fr');
  for (const value of ['en', '', 'FR', 'zh', null, undefined, { toString: () => 'fr' }])
    assert.equal(normalizeLocale(value), 'en');
});
test('French interface labels translate without changing English originals', () => {
  for (const label of [
    'Home',
    'Map',
    'Participate',
    'Saved',
    'Upcoming agendas',
    'Voting',
    'Search public notices',
    'Main navigation',
    'Why could this matter to residents?',
    'No record',
    'All topics',
  ]) {
    assert.notEqual(translate('fr', label), label);
    assert.equal(translate('en', label), label);
  }
  const original = '1123 Lansdowne Avenue — Appeal of Property Standards Order — 2027.SZ1.1';
  assert.equal(translate('fr', original), original);
  assert.equal(translate('fr', 'constructor'), 'constructor');
  assert.equal(translate('fr', ' Taxes & Budget '), ' Impôts et budget ');
});
test('interpolation preserves IDs and numbers without translating source data', () => {
  assert.equal(translate('fr', 'Page {page} of {total}', { page: 2, total: 18 }), 'Page 2 sur 18');
  assert.equal(
    translate('fr', 'View official item {reference}', { reference: '2027.SZ1.1' }),
    'Consulter le point officiel 2027.SZ1.1',
  );
  assert.equal(translate('en', '{count} matching notices', { count: 18 }), '18 matching notices');
});
test('translation catalog preserves placeholders and avoids literal HTML entities', () => {
  for (const [key, value] of Object.entries(french)) {
    assert.equal(typeof value, 'string');
    assert.ok(value.length > 0, key);
    assert.deepEqual(
      [...key.matchAll(/\{\w+\}/g)].map((x) => x[0]).sort(),
      [...value.matchAll(/\{\w+\}/g)].map((x) => x[0]).sort(),
      key,
    );
    assert.doesNotMatch(key, /&amp;|&copy;/);
  }
});
test('language switch returns to the current same-origin page and rejects external redirects', () => {
  const origin = 'https://example.vercel.app';
  assert.equal(
    safeReturnPath('/voting?q=Housing&page=2#results', origin),
    '/voting?q=Housing&page=2#results',
  );
  assert.equal(safeReturnPath(origin + '/?view=Map', origin), '/?view=Map');
  for (const value of [
    'https://evil.example/',
    '//evil.example/',
    '/\\evil.example/',
    'javascript:alert(1)',
    '/api/language',
    null,
  ])
    assert.equal(safeReturnPath(value, origin), '/');
});
