import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const VERBOSE = process.env.VERBOSE === 'true';
const api = axios.create({ baseURL: BASE_URL, timeout: 10000 });

// ── Counters ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];
const scriptStart = Date.now();

// ── Helpers ──────────────────────────────────────────────────────────────────

function elapsed(): string {
  return `${ ((Date.now() - scriptStart) / 1000).toFixed(1) }s`;
}

function stepTimer(): () => string {
  const start = Date.now();
  return () => `${ Date.now() - start }ms`;
}

function log(section: string, msg: string) {
  console.log(`\n[${ section }] ${ msg }  (${ elapsed() })`);
}

function ok(msg: string) {
  passed++;
  console.log(`  \x1b[32m✓\x1b[0m ${ msg }`);
}

function fail(msg: string) {
  failed++;
  failures.push(msg);
  console.error(`  \x1b[31m✗\x1b[0m ${ msg }`);
}

function dim(msg: string) {
  console.log(`  \x1b[2m${ msg }\x1b[0m`);
}

function pretty(label: string, data: unknown) {
  console.log(`  \x1b[36m── ${ label } ──\x1b[0m`);
  console.log(
    JSON.stringify(data, null, 2)
      .split('\n')
      .map((l) => `  ${ l }`)
      .join('\n'),
  );
}

// ── Request / Response interceptors (debug logging) ──────────────────────────

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const method = (config.method ?? 'GET').toUpperCase();
  const url = `${ config.baseURL }${ config.url }`;
  const params = config.params ? `?${ new URLSearchParams(config.params as Record<string, string>).toString() }` : '';
  dim(`→ ${ method } ${ url }${ params }`);
  if (config.data && VERBOSE) {
    pretty('Request body', config.data);
  }
  return config;
});

api.interceptors.response.use(
  (response: AxiosResponse) => {
    dim(`← ${ response.status } ${ response.statusText } (${ response.headers['content-type'] ?? '' })`);
    if (VERBOSE) {
      pretty('Response body', response.data);
    }
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      dim(`← ${ error.response.status } ${ error.response.statusText }`);
      if (VERBOSE || error.response.status >= 500) {
        pretty('Error response', error.response.data);
      }
    } else if (error.code) {
      dim(`← ERROR: ${ error.code } — ${ error.message }`);
    }
    return Promise.reject(error);
  },
);

// ── Core assertion helper ────────────────────────────────────────────────────

async function expectStatus(
  fn: () => Promise<unknown>,
  expected: number,
  label: string,
): Promise<unknown> {
  const timer = stepTimer();
  try {
    const res = (await fn()) as { status: number; data: unknown };
    if (res.status === expected) {
      ok(`${ label } → ${ expected }  (${ timer() })`);
      return res.data;
    }
    fail(`${ label } → expected ${ expected }, got ${ res.status }  (${ timer() })`);
    pretty('Unexpected response', res.data);
    return res.data;
  } catch (err) {
    const axErr = err as AxiosError;
    if (axErr.response?.status === expected) {
      ok(`${ label } → ${ expected }  (${ timer() })`);
      return axErr.response.data;
    }
    if (axErr.response) {
      fail(`${ label } → expected ${ expected }, got ${ axErr.response.status }  (${ timer() })`);
      pretty('Error response body', axErr.response.data);
    } else {
      fail(`${ label } → expected ${ expected }, got network error: ${ axErr.code ?? axErr.message }  (${ timer() })`);
    }
    return axErr.response?.data;
  }
}

// ── Polling helper with progress logging ─────────────────────────────────────

async function poll(
  label: string,
  checkFn: () => Promise<boolean>,
  intervalMs = 2000,
  maxMs = 180000,
): Promise<boolean> {
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < maxMs) {
    attempt++;
    dim(`polling "${ label }" attempt #${ attempt } (${ ((Date.now() - start) / 1000).toFixed(0) }s elapsed)`);
    try {
      if (await checkFn()) {
        ok(`"${ label }" resolved after ${ attempt } poll(s), ${ ((Date.now() - start) / 1000).toFixed(1) }s`);
        return true;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      dim(`poll error: ${ msg }`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  fail(`"${ label }" — timed out after ${ maxMs / 1000 }s (${ attempt } attempts)`);
  return false;
}

// ── Valid test data ──────────────────────────────────────────────────────────

const ts = Date.now();

const LEAD_1 = {
  fullName: 'Roberto Mendes',
  email: `roberto.mendes+${ ts }@testflow.com`,
  phone: '+5511999990001',
  companyName: 'FlowTest Tecnologia',
  companyCnpj: '71634825000106',
  companyWebsite: 'https://flowtest.com.br',
  estimatedValue: 320000.5,
  source: 'WEBSITE',
  notes: 'Lead de teste do script de validacao',
};

const LEAD_2 = {
  fullName: 'Camila Duarte',
  email: `camila.duarte+${ ts }@testflow.com`,
  phone: '+5521988881234',
  companyName: 'Duarte Consulting',
  companyCnpj: '83920147000127',
  companyWebsite: 'https://duarteconsulting.com.br',
  estimatedValue: 150000,
  source: 'REFERRAL',
};

// ── Main flow ────────────────────────────────────────────────────────────────

async function run() {
  console.log('='.repeat(70));
  console.log(' QUARK BACKEND CHALLENGE — FULL FLOW TEST');
  console.log(` API:     ${ BASE_URL }`);
  console.log(` VERBOSE: ${ VERBOSE } (set VERBOSE=true for full request/response bodies)`);
  console.log(` Started: ${ new Date().toISOString() }`);
  console.log('='.repeat(70));

  // ── Health check ──────────────────────────────────────────────────────────
  log('0', 'CONNECTIVITY CHECK');
  try {
    const res = await api.get('/leads', { params: { limit: 1 }, timeout: 5000 });
    ok(`API is reachable — status ${ res.status }`);
  } catch (err) {
    const axErr = err as AxiosError;
    fail(`Cannot reach API at ${ BASE_URL }: ${ axErr.code ?? axErr.message }`);
    console.error('\n  Make sure the server is running:');
    console.error('    npm run start:dev');
    console.error('  Or via Docker:');
    console.error('    docker compose up\n');
    process.exit(1);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. LEAD CRUD
  // ──────────────────────────────────────────────────────────────────────────
  log('1', 'LEAD CRUD');

  // 1a. Create lead 1
  log('1a', 'Create lead 1');
  dim(`Payload: email=${ LEAD_1.email }, cnpj=${ LEAD_1.companyCnpj }`);
  const lead1: any = await expectStatus(
    () => api.post('/leads', LEAD_1),
    201,
    'POST /leads (lead 1)',
  );
  const lead1Id = lead1?.id;
  if (!lead1Id) {
    fail('No lead id returned — aborting');
    pretty('Response data', lead1);
    printSummary();
    return;
  }
  ok(`Created lead id=${ lead1Id }`);

  // 1b. Create lead 2
  log('1b', 'Create lead 2');
  dim(`Payload: email=${ LEAD_2.email }, cnpj=${ LEAD_2.companyCnpj }`);
  const lead2: any = await expectStatus(
    () => api.post('/leads', LEAD_2),
    201,
    'POST /leads (lead 2)',
  );
  const lead2Id = lead2?.id;
  if (!lead2Id) {
    fail('No lead id returned — aborting');
    pretty('Response data', lead2);
    printSummary();
    return;
  }
  ok(`Created lead id=${ lead2Id }`);

  // 1c. Duplicate email → 409
  log('1c', 'Duplicate email should fail');
  await expectStatus(
    () => api.post('/leads', { ...LEAD_1, companyCnpj: '55443322000105' }),
    409,
    'POST /leads (duplicate email)',
  );

  // 1d. Duplicate CNPJ → 409
  log('1d', 'Duplicate CNPJ should fail');
  await expectStatus(
    () => api.post('/leads', { ...LEAD_1, email: 'unique@test.com' }),
    409,
    'POST /leads (duplicate CNPJ)',
  );

  // 1e. Validation errors
  log('1e', 'Validation errors');
  await expectStatus(
    () => api.post('/leads', { fullName: 'AB' }),
    400,
    'POST /leads (short name + missing required fields)',
  );
  await expectStatus(
    () => api.post('/leads', { ...LEAD_1, email: 'not-an-email', companyCnpj: '00000000000000' }),
    400,
    'POST /leads (invalid email + invalid CNPJ)',
  );
  await expectStatus(
    () => api.post('/leads', { ...LEAD_1, phone: '11999990001' }),
    400,
    'POST /leads (phone not E.164)',
  );

  // 1f. Get lead by id
  log('1f', 'Get lead by id');
  const detail: any = await expectStatus(
    () => api.get(`/leads/${ lead1Id }`),
    200,
    `GET /leads/${ lead1Id }`,
  );
  ok(`Returned: status=${ detail?.status }, fullName=${ detail?.fullName }, source=${ detail?.source }`);

  // 1g. List leads with filters
  log('1g', 'List leads with filters');
  const list: any = await expectStatus(
    () => api.get('/leads', { params: { source: 'WEBSITE', page: 1, limit: 5 } }),
    200,
    'GET /leads?source=WEBSITE&page=1&limit=5',
  );
  ok(`Returned ${ list?.data?.length ?? list?.length ?? '?' } lead(s)`);

  // 1h. Search
  log('1h', 'Search leads');
  const searchResult: any = await expectStatus(
    () => api.get('/leads', { params: { search: 'Roberto' } }),
    200,
    'GET /leads?search=Roberto',
  );
  ok(`Search returned ${ searchResult?.data?.length ?? searchResult?.length ?? '?' } lead(s)`);

  // 1i. Update lead
  log('1i', 'Update lead (notes + estimatedValue)');
  const updated: any = await expectStatus(
    () => api.patch(`/leads/${ lead1Id }`, { notes: 'Nota atualizada via script', estimatedValue: 400000 }),
    200,
    `PATCH /leads/${ lead1Id }`,
  );
  ok(`Updated: notes="${ updated?.notes }", estimatedValue=${ updated?.estimatedValue }`);

  // 1j. Immutable fields → 400
  log('1j', 'Immutable fields (email, companyCnpj) should be rejected');
  await expectStatus(
    () => api.patch(`/leads/${ lead1Id }`, { email: 'new@email.com' }),
    400,
    'PATCH (email is immutable)',
  );
  await expectStatus(
    () => api.patch(`/leads/${ lead1Id }`, { companyCnpj: '98765432000110' }),
    400,
    'PATCH (companyCnpj is immutable)',
  );

  // ──────────────────────────────────────────────────────────────────────────
  // 2. ENRICHMENT FLOW
  // ──────────────────────────────────────────────────────────────────────────
  log('2', 'ENRICHMENT FLOW');

  // 2a. Request enrichment (lead 1: PENDING → ENRICHING)
  log('2a', 'Request enrichment for lead 1');
  dim(`Lead status before: ${ detail?.status }`);
  await expectStatus(
    () => api.post(`/leads/${ lead1Id }/enrichment`),
    201,
    `POST /leads/${ lead1Id }/enrichment`,
  );

  // 2b. Wait for enrichment to complete
  log('2b', 'Waiting for enrichment to complete...');
  await poll('enrichment lead 1', async () => {
    const res = await api.get(`/leads/${ lead1Id }`);
    const status = (res.data as any).status;
    return status === 'ENRICHED' || status === 'FAILED';
  });

  const lead1After: any = (await api.get(`/leads/${ lead1Id }`)).data;
  ok(`Lead status after enrichment: ${ lead1After.status }`);
  if (lead1After.status === 'FAILED') {
    dim('Enrichment failed — this may be due to mock-api random failure. Check enrichment history for details.');
  }

  // 2c. Get enrichment history
  log('2c', 'Get enrichment history');
  const enrichments: any = await expectStatus(
    () => api.get(`/leads/${ lead1Id }/enrichments`),
    200,
    `GET /leads/${ lead1Id }/enrichments`,
  );
  ok(`${ enrichments?.length ?? 0 } enrichment record(s)`);
  if (enrichments?.length > 0) {
    const e = enrichments[0];
    ok(`Latest: status=${ e.status }, industry=${ e.industry ?? 'N/A' }`);
    dim(`  requestedAt=${ e.requestedAt }, completedAt=${ e.completedAt }`);
    if (e.errorMessage) dim(`  errorMessage=${ e.errorMessage }`);
  }

  // 2d. State machine validation
  log('2d', 'State machine: cannot classify a PENDING lead');
  dim(`Lead 2 is still PENDING — classification should be rejected`);
  await expectStatus(
    () => api.post(`/leads/${ lead2Id }/classification`),
    400,
    'POST /leads/:id/classification (PENDING → 400)',
  );

  // ──────────────────────────────────────────────────────────────────────────
  // 3. CLASSIFICATION FLOW
  // ──────────────────────────────────────────────────────────────────────────
  log('3', 'CLASSIFICATION FLOW');

  if (lead1After.status !== 'ENRICHED') {
    fail(`Lead 1 is "${ lead1After.status }", not ENRICHED — skipping classification`);
    dim('This can happen if mock-api returned an error. Re-run the script to retry.');
  } else {
    // 3a. Request classification (ENRICHED → CLASSIFYING)
    log('3a', 'Request classification for lead 1');
    await expectStatus(
      () => api.post(`/leads/${ lead1Id }/classification`),
      201,
      `POST /leads/${ lead1Id }/classification`,
    );

    // 3b. Wait for classification to complete
    log('3b', 'Waiting for AI classification (tinyllama can take 30-120s)...');
    await poll('classification lead 1', async () => {
      const res = await api.get(`/leads/${ lead1Id }`);
      const status = (res.data as any).status;
      return status === 'CLASSIFIED' || status === 'FAILED';
    }, 3000, 300000);

    const lead1Post: any = (await api.get(`/leads/${ lead1Id }`)).data;
    ok(`Lead status after classification: ${ lead1Post.status }`);

    // 3c. Get classification history
    log('3c', 'Get classification history');
    const classifications: any = await expectStatus(
      () => api.get(`/leads/${ lead1Id }/classifications`),
      200,
      `GET /leads/${ lead1Id }/classifications`,
    );
    ok(`${ classifications?.length ?? 0 } classification record(s)`);
    if (classifications?.length > 0) {
      const c = classifications[0];
      ok(`Latest: status=${ c.status }`);
      dim(`  score=${ c.score }, classification=${ c.classification }`);
      dim(`  commercialPotential=${ c.commercialPotential }`);
      dim(`  justification=${ c.justification }`);
      dim(`  modelUsed=${ c.modelUsed }`);
      dim(`  requestedAt=${ c.requestedAt }, completedAt=${ c.completedAt }`);
      if (c.errorMessage) dim(`  errorMessage=${ c.errorMessage }`);
    }

    // ────────────────────────────────────────────────────────────────────────
    // 4. REPROCESSING (re-enrichment + re-classification)
    // ────────────────────────────────────────────────────────────────────────
    log('4', 'REPROCESSING FLOWS');

    if (lead1Post.status === 'CLASSIFIED') {
      // 4a. Re-enrichment from CLASSIFIED state
      log('4a', 'Re-enrichment (CLASSIFIED → ENRICHING)');
      dim('Spec allows: CLASSIFIED → ENRICHING for re-enrichment');
      await expectStatus(
        () => api.post(`/leads/${ lead1Id }/enrichment`),
        201,
        `POST /leads/${ lead1Id }/enrichment (re-enrich)`,
      );

      await poll('re-enrichment lead 1', async () => {
        const res = await api.get(`/leads/${ lead1Id }`);
        const status = (res.data as any).status;
        return status === 'ENRICHED' || status === 'FAILED';
      });

      const afterReEnrich: any = (await api.get(`/leads/${ lead1Id }`)).data;
      ok(`After re-enrichment: status=${ afterReEnrich.status }`);

      // Check history grew
      const enrichHist: any = (await api.get(`/leads/${ lead1Id }/enrichments`)).data;
      ok(`Enrichment history count: ${ enrichHist?.length ?? 0 } (expected 2+)`);
      if ((enrichHist?.length ?? 0) < 2) {
        fail('History should have grown — each execution creates a new record');
      }

      // 4b. Re-classification from ENRICHED state
      if (afterReEnrich.status === 'ENRICHED') {
        log('4b', 'Re-classification (ENRICHED → CLASSIFYING)');
        dim('Spec allows: ENRICHED → CLASSIFYING');
        await expectStatus(
          () => api.post(`/leads/${ lead1Id }/classification`),
          201,
          `POST /leads/${ lead1Id }/classification (re-classify)`,
        );

        await poll('re-classification lead 1', async () => {
          const res = await api.get(`/leads/${ lead1Id }`);
          const status = (res.data as any).status;
          return status === 'CLASSIFIED' || status === 'FAILED';
        }, 3000, 300000);

        const afterReClassify: any = (await api.get(`/leads/${ lead1Id }`)).data;
        ok(`After re-classification: status=${ afterReClassify.status }`);

        const classHist: any = (await api.get(`/leads/${ lead1Id }/classifications`)).data;
        ok(`Classification history count: ${ classHist?.length ?? 0 } (expected 2+)`);
        if ((classHist?.length ?? 0) < 2) {
          fail('History should have grown — each execution creates a new record');
        }
      }
    } else if (lead1Post.status === 'FAILED') {
      // 4a-alt. Reprocessing from FAILED state
      log('4a', 'Reprocessing from FAILED state');
      dim('Spec allows: FAILED → ENRICHING and FAILED → CLASSIFYING');
      await expectStatus(
        () => api.post(`/leads/${ lead1Id }/enrichment`),
        201,
        `POST /leads/${ lead1Id }/enrichment (retry from FAILED)`,
      );

      await poll('retry enrichment', async () => {
        const res = await api.get(`/leads/${ lead1Id }`);
        const status = (res.data as any).status;
        return status !== 'ENRICHING';
      });

      const retried: any = (await api.get(`/leads/${ lead1Id }`)).data;
      ok(`After retry: status=${ retried.status }`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. EXPORT
  // ──────────────────────────────────────────────────────────────────────────
  log('5', 'EXPORT');

  log('5a', 'Export all leads');
  const exported: any = await expectStatus(
    () => api.get('/leads/export'),
    200,
    'GET /leads/export',
  );
  ok(`Exported ${ exported?.length ?? 0 } lead(s)`);
  if (exported?.length > 0) {
    const sample = exported[0];
    ok(`Sample: name=${ sample.lead?.fullName }, enrichments=${ sample.enrichmentCount }, classifications=${ sample.classificationCount }`);
    dim(`  latestEnrichment status=${ sample.latestEnrichment?.status ?? 'none' }`);
    dim(`  latestClassification status=${ sample.latestClassification?.status ?? 'none' }`);
  }

  log('5b', 'Export with filter');
  const filteredExport: any = await expectStatus(
    () => api.get('/leads/export', { params: { source: 'WEBSITE' } }),
    200,
    'GET /leads/export?source=WEBSITE',
  );
  ok(`Filtered export returned ${ filteredExport?.length ?? 0 } lead(s)`);

  // ──────────────────────────────────────────────────────────────────────────
  // 6. FULL PIPELINE FOR LEAD 2
  // ──────────────────────────────────────────────────────────────────────────
  log('6', 'FULL PIPELINE FOR LEAD 2 (enrich → classify)');

  log('6a', 'Enrich lead 2');
  await expectStatus(
    () => api.post(`/leads/${ lead2Id }/enrichment`),
    201,
    `POST /leads/${ lead2Id }/enrichment`,
  );

  await poll('enrichment lead 2', async () => {
    const res = await api.get(`/leads/${ lead2Id }`);
    const status = (res.data as any).status;
    return status === 'ENRICHED' || status === 'FAILED';
  });

  const lead2AfterEnrich: any = (await api.get(`/leads/${ lead2Id }`)).data;
  ok(`Lead 2 after enrichment: status=${ lead2AfterEnrich.status }`);

  if (lead2AfterEnrich.status === 'ENRICHED') {
    log('6b', 'Classify lead 2');
    await expectStatus(
      () => api.post(`/leads/${ lead2Id }/classification`),
      201,
      `POST /leads/${ lead2Id }/classification`,
    );

    await poll('classification lead 2', async () => {
      const res = await api.get(`/leads/${ lead2Id }`);
      const status = (res.data as any).status;
      return status === 'CLASSIFIED' || status === 'FAILED';
    }, 3000, 300000);

    const lead2Final: any = (await api.get(`/leads/${ lead2Id }`)).data;
    ok(`Lead 2 final: status=${ lead2Final.status }`);

    // Show full detail
    const lead2Detail: any = (await api.get(`/leads/${ lead2Id }`)).data;
    dim(`  enrichments: ${ lead2Detail?.enrichments?.length ?? 0 }, classifications: ${ lead2Detail?.classifications?.length ?? 0 }`);
  } else {
    dim('Lead 2 enrichment failed — skipping classification');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. DELETE
  // ──────────────────────────────────────────────────────────────────────────
  log('7', 'DELETE');

  log('7a', 'Delete lead 2 (should cascade enrichments + classifications)');
  await expectStatus(
    () => api.delete(`/leads/${ lead2Id }`),
    200,
    `DELETE /leads/${ lead2Id }`,
  );

  log('7b', 'Verify deleted lead returns 404');
  await expectStatus(
    () => api.get(`/leads/${ lead2Id }`),
    404,
    `GET /leads/${ lead2Id } (after delete)`,
  );

  log('7c', 'Delete non-existent lead → 404');
  await expectStatus(
    () => api.delete('/leads/00000000-0000-0000-0000-000000000000'),
    404,
    'DELETE /leads/:nonexistent',
  );

  // ──────────────────────────────────────────────────────────────────────────
  // 8. FINAL EXPORT
  // ──────────────────────────────────────────────────────────────────────────
  log('8', 'FINAL EXPORT — consolidated view');
  const finalExport: any = await expectStatus(
    () => api.get('/leads/export'),
    200,
    'GET /leads/export (final)',
  );
  ok(`Total leads exported: ${ finalExport?.length ?? 0 }`);
  if (finalExport?.length > 0) {
    pretty('Sample exported lead', finalExport[0]);
  }

  printSummary();
}

// ── Summary ──────────────────────────────────────────────────────────────────

function printSummary() {
  const total = passed + failed;
  const totalTime = ((Date.now() - scriptStart) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(70));
  console.log(' RESULTS');
  console.log('='.repeat(70));
  console.log(`  Total:   ${ total } assertions`);
  console.log(`  \x1b[32mPassed:  ${ passed }\x1b[0m`);
  console.log(`  \x1b[31mFailed:  ${ failed }\x1b[0m`);
  console.log(`  Time:    ${ totalTime }s`);

  if (failures.length > 0) {
    console.log('\n  \x1b[31m── Failures ──\x1b[0m');
    failures.forEach((f, i) => console.log(`  ${ i + 1 }. ${ f }`));
  }

  console.log('='.repeat(70));
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('\n\x1b[31mFATAL ERROR:\x1b[0m', err.message ?? err);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
