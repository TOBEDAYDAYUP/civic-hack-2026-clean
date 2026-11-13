import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterSupportedImpacts,
  validateSimplifiedNotice,
  IMPACT_CATEGORIES,
} from '../lib/impact-analysis.mjs';

const source = {
  title: 'Proposed six-storey building',
  description:
    'The applicant proposes a six-storey building with 155 residential units. The site is near a bus stop.',
};
const grounded = {
  category: 'Housing & Affordability',
  explanation: 'If built, this could add 155 new homes; affordability was not specified.',
  certainty: 'potential',
  sourceExcerpt: 'a six-storey building with 155 residential units',
};

test('only official-source-backed categories appear in impact cards', () => {
  const impacts = filterSupportedImpacts(
    [
      grounded,
      {
        ...grounded,
        category: 'Economy & Financial Impact',
        sourceExcerpt: 'House prices will rise in Toronto',
      },
      { ...grounded, category: 'Environment & Public Space', sourceExcerpt: 'traffic' },
      { ...grounded, explanation: 'duplicate' },
    ],
    source,
  );
  assert.deepEqual(impacts, [grounded]);
});

test('missing evidence means zero impacts, never six invented placeholders', () => {
  assert.deepEqual(filterSupportedImpacts([], source), []);
  assert.deepEqual(
    filterSupportedImpacts(
      [
        {
          ...grounded,
          category: 'Other Impacts',
          sourceExcerpt: 'This is definitely good for everyone',
        },
      ],
      source,
    ),
    [],
  );
});

test('AI result preserves earlier fields and turns key points into a short list', () => {
  const result = validateSimplifiedNotice(
    {
      plainTitle: 'New homes proposed',
      whatIsHappening: 'A housing project is proposed.',
      keyPoints: [
        'A six-storey building is proposed.',
        'There are 155 units.',
        'Status is proposal.',
        'Fourth point',
      ],
      impacts: [grounded],
    },
    source,
  );
  assert.equal(result.keyPoints.length, 3);
  assert.deepEqual(result.impacts, [grounded]);
});

test('category names stay stable for backend and frontend', () => {
  assert.equal(IMPACT_CATEGORIES.length, 6);
  assert.ok(IMPACT_CATEGORIES.includes('Other Impacts'));
});

// Regression tests for the Qwen 3.5:4b issue reported on notice 8006:
// first-pass impacts: [] must not be taken as the final answer if the official
// source has a verifiable planning or housing effect.
import {
  buildSourceEvidence,
  supportedEvidenceLinkedImpacts,
  sourceGroundedFallbackImpacts,
} from '../lib/impact-analysis.mjs';
import { analyzeNoticeWithOllama } from '../lib/impact-ollama.mjs';

const planningSource = {
  title: 'Notice of Application for Mixed-Use Towers at York Mills Road',
  description:
    'North York Community Council has received an application to amend the Official Plan and Zoning By-law 569-2013 to facilitate the development of two mixed-use towers with heights of 55 and 40 storeys.',
};

function fakeOllama(responses) {
  let calls = 0;
  return {
    fetchImpl: async (_url, request) => {
      assert.ok(request.body.includes('qwen3.5:4b'));
      const content = responses[calls++];
      if (!content) throw new Error('Unexpected Ollama call');
      return {
        ok: true,
        async json() {
          return { model: 'qwen3.5:4b', message: { content: JSON.stringify(content) } };
        },
      };
    },
    count: () => calls,
  };
}
function primary(impacts = []) {
  return {
    plainTitle: 'A proposed development',
    whatIsHappening: 'The city received a development application.',
    keyPoints: ['A development application has been submitted.'],
    impacts,
  };
}

test('recovery chooses an official evidence ID rather than an invented quotation', async () => {
  const evidence = buildSourceEvidence(planningSource);
  assert.equal(evidence.length, 2);
  const fake = fakeOllama([
    primary([]),
    {
      impacts: [
        {
          category: 'Other Impacts',
          explanation:
            'The proposed zoning amendment could change development permissions for the site; it is not an approval.',
          certainty: 'potential',
          evidenceId: 'E2',
        },
      ],
    },
  ]);
  const result = await analyzeNoticeWithOllama(planningSource, { fetchImpl: fake.fetchImpl });
  assert.equal(fake.count(), 2);
  assert.equal(result.diagnostics.recovered, 1);
  assert.equal(result.result.impacts.length, 1);
  assert.equal(result.result.impacts[0].sourceExcerpt, evidence[1].text);
});

test('unknown source ID is rejected and planning fallback remains evidence-based', async () => {
  const fake = fakeOllama([
    primary([]),
    {
      impacts: [
        {
          category: 'Housing & Affordability',
          explanation: 'This proposal will lower house prices across the city.',
          certainty: 'confirmed',
          evidenceId: 'E999',
        },
      ],
    },
  ]);
  const result = await analyzeNoticeWithOllama(planningSource, { fetchImpl: fake.fetchImpl });
  assert.equal(result.result.impacts.length, 1);
  assert.equal(result.result.impacts[0].category, 'Other Impacts');
  assert.equal(result.result.impacts[0].certainty, 'potential');
  assert.match(result.result.impacts[0].sourceExcerpt, /Zoning By-law/);
});

test('explicit residential proposals lead to a conditional housing impact, not a price prediction', () => {
  const result = sourceGroundedFallbackImpacts(source);
  assert.equal(result.length, 1);
  assert.equal(result[0].category, 'Housing & Affordability');
  assert.match(result[0].explanation, /if approved and built/i);
  assert.match(result[0].explanation, /proposal for 155 residential units/);
  assert.doesNotMatch(result[0].explanation, /prices will|rents will/i);
});

test('unrelated notices are not forced into any impact category', async () => {
  const unrelated = {
    title: 'Updated administrative contact list',
    description: 'The phone number of the information desk is now 416-555-0100.',
  };
  const fake = fakeOllama([primary([]), { impacts: [] }]);
  const result = await analyzeNoticeWithOllama(unrelated, { fetchImpl: fake.fetchImpl });
  assert.deepEqual(result.result.impacts, []);
});

test('candidate with an off-topic evidence ID is rejected', () => {
  const evidence = buildSourceEvidence({
    title: 'Notice of residential development',
    description:
      'The application proposes 200 residential units. The relevant application number is A100.',
  });
  const rejected = supportedEvidenceLinkedImpacts(
    [
      {
        category: 'Economy & Financial Impact',
        explanation: 'This will generate local employment and increase tax revenue.',
        certainty: 'confirmed',
        evidenceId: 'E2',
      },
    ],
    evidence,
  );
  assert.deepEqual(rejected, []);
});

test('legacy entertainment notice can show a meaningful source-backed land-use relevance immediately', () => {
  const entertainment = {
    title: 'Notice of Application at 1605 Queen Street West',
    description:
      'The amendment proposes to permit an entertainment place of assembly at 1605 Queen Street West.',
  };
  const impacts = sourceGroundedFallbackImpacts(entertainment);
  assert.equal(impacts.length, 1);
  assert.equal(impacts[0].category, 'Other Impacts');
  assert.equal(impacts[0].certainty, 'potential');
  assert.match(impacts[0].sourceExcerpt, /entertainment place of assembly/);
  assert.doesNotMatch(impacts[0].explanation, /noise will|jobs will|traffic will/i);
});

test('concrete transit and environment evidence yields only relevant categories', () => {
  const notice = {
    title: 'Proposed sidewalk closures and tree protection',
    description:
      'The proposal includes a sidewalk closure and tree protection measures near the work site.',
  };
  const impacts = sourceGroundedFallbackImpacts(notice);
  assert.deepEqual(
    impacts.map((i) => i.category),
    ['Daily Life & Transportation', 'Environment & Public Space'],
  );
  assert.ok(impacts.every((item) => item.sourceExcerpt.length >= 15));
});

test('a generic road address is not grounds for traffic impact claims', () => {
  const notice = {
    title: 'Administrative Contact Change on York Mills Road',
    description: 'The contact email for the City office on York Mills Road has changed.',
  };
  assert.deepEqual(sourceGroundedFallbackImpacts(notice), []);
});

test('housing explanations carry record-specific units and addresses, not a universal template', () => {
  const weston = sourceGroundedFallbackImpacts({
    title: 'Residential development proposal at Weston Road',
    description: 'The application proposes 155 residential units in a six-storey development.',
    addresses: [{ label: '1956 Weston Road' }],
  });
  const queen = sourceGroundedFallbackImpacts({
    title: 'Residential development proposal at Queen Street',
    description: 'The application proposes 320 residential units in a 25-storey development.',
    addresses: [{ label: '1605 Queen Street West' }],
  });
  assert.equal(weston[0].category, 'Housing & Affordability');
  assert.equal(queen[0].category, 'Housing & Affordability');
  assert.match(weston[0].explanation, /155.*1956 Weston Road/);
  assert.match(queen[0].explanation, /320.*1605 Queen Street West/);
  assert.notEqual(weston[0].explanation, queen[0].explanation);
});

test('generic past housing boilerplate is not accepted as a personalized impact', () => {
  const impacts = filterSupportedImpacts(
    [
      {
        category: 'Housing & Affordability',
        certainty: 'potential',
        explanation:
          'The proposed homes could expand local housing options; affordability is unknown.',
        sourceExcerpt: 'a six-storey building with 155 residential units',
      },
    ],
    source,
  );
  assert.deepEqual(impacts, []);
});

test('independent per-record AI pass can replace a generic first pass with a source-grounded unique result', async () => {
  const fake = fakeOllama([
    primary([
      {
        category: 'Housing & Affordability',
        explanation:
          'The proposed homes could expand local housing options; affordability is unknown.',
        certainty: 'potential',
        sourceExcerpt: 'a six-storey building with 155 residential units',
      },
    ]),
    {
      impacts: [
        {
          category: 'Housing & Affordability',
          explanation:
            'The proposal for 155 residential units could affect housing options near the site, but completion is not confirmed.',
          certainty: 'potential',
          evidenceId: 'E2',
        },
      ],
    },
  ]);
  const result = await analyzeNoticeWithOllama(source, { fetchImpl: fake.fetchImpl });
  assert.equal(fake.count(), 2);
  assert.equal(result.result.impacts.length, 1);
  assert.match(result.result.impacts[0].explanation, /155/);
});

test('different supported dimensions all survive AI recovery and are not limited to one card', async () => {
  const multiSource = {
    title: 'Proposed 155 residential units with tree protection',
    description:
      'The application proposes 155 residential units with a tree protection plan at 99 Example Street. A temporary sidewalk closure is proposed during site works.',
  };
  const evidence = buildSourceEvidence(multiSource);
  const housing = evidence.find((x) => /155 residential units/i.test(x.text));
  const environment = evidence.find((x) => /tree protection/i.test(x.text));
  const travel = evidence.find((x) => /sidewalk closure/i.test(x.text));
  assert.ok(housing && environment && travel);
  const fake = fakeOllama([
    primary([]),
    {
      impacts: [
        {
          category: 'Housing & Affordability',
          certainty: 'potential',
          evidenceId: housing.id,
          explanation:
            'The proposed 155 residential units could change which homes are eventually available at this specific site. People searching for housing should check the unit mix and tenure. The application does not establish pricing or completion.',
        },
        {
          category: 'Environment & Public Space',
          certainty: 'potential',
          evidenceId: environment.id,
          explanation:
            'The tree protection plan at the proposed residential site may affect how existing trees are managed if the plan proceeds. Neighbours concerned about local greenery can inspect the details. The notice does not show final tree outcomes.',
        },
        {
          category: 'Daily Life & Transportation',
          certainty: 'potential',
          evidenceId: travel.id,
          explanation:
            'The proposed temporary sidewalk closure could affect pedestrians passing this site if the measure is implemented. People using that route may need to check a confirmed access plan. The notice does not show a closure already in effect.',
        },
      ],
    },
  ]);
  const outcome = await analyzeNoticeWithOllama(multiSource, { fetchImpl: fake.fetchImpl });
  assert.equal(outcome.result.impacts.length, 3);
  assert.deepEqual(
    outcome.result.impacts.map((x) => x.category),
    ['Housing & Affordability', 'Daily Life & Transportation', 'Environment & Public Space'],
  );
  assert.ok(
    outcome.result.impacts.every((x) => x.explanation.split(/[.!?]/).filter(Boolean).length >= 2),
  );
});

test('fallback can show a distinct planning permission aspect alongside documented housing facts', () => {
  const source = {
    title: 'Proposed new homes and rezoning',
    description:
      'The applicant seeks to amend the Official Plan and Zoning By-law to allow 155 residential units at 99 Example Street.',
  };
  const results = sourceGroundedFallbackImpacts(source);
  assert.deepEqual(
    results.map((item) => item.category),
    ['Housing & Affordability', 'Other Impacts'],
  );
  assert.ok(results.every((item) => item.explanation.length > 150));
});

import { noticeImpactPresentation } from '../lib/impact-analysis.mjs';

test('current persisted impact renders only when the public feed marks it current', () => {
  const simple = { impacts: [grounded] };
  const saved = noticeImpactPresentation({
    ...source,
    aiReady: true,
    analysisVersion: 'impact-v5',
    simple,
  });
  assert.deepEqual(saved, { impacts: [grounded], fromSavedAnalysis: true });
  const stale = noticeImpactPresentation({
    ...source,
    aiReady: false,
    analysisVersion: 'impact-v5',
    simple,
  });
  assert.equal(stale.fromSavedAnalysis, false);
  assert.notEqual(stale.impacts[0].explanation, grounded.explanation);
});

test('a legacy saved category can still appear when its excerpt matches the current source', () => {
  const legacy = { ...source, title: 'Notice concerning a building with 155 residential units' };
  const rendered = noticeImpactPresentation({
    ...legacy,
    aiReady: true,
    analysisVersion: 'impact-v3',
    simple: { impacts: [grounded] },
  });
  assert.equal(rendered.fromSavedAnalysis, true);
  assert.deepEqual(rendered.impacts, [grounded]);
});

test('confirmed wording cannot upgrade an application to an outcome', () => {
  const application = { ...source, title: 'Notice of Application for a new building' };
  const [impact] = filterSupportedImpacts([{ ...grounded, certainty: 'confirmed' }], application);
  assert.equal(impact.certainty, 'potential');
});

test('mixed-use heights are not automatically assigned to a residential building', () => {
  const impacts = sourceGroundedFallbackImpacts({
    title: 'Notice of Application for Mixed-Use Towers',
    description:
      'The application describes two towers of 55 and 40 storeys. Both towers include residential and commercial uses.',
  });
  assert.doesNotMatch(impacts[0].explanation, /55|40/);
});
