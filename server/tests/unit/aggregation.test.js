import test from 'node:test';
import assert from 'node:assert';
import { runClusterAggregation, getPlaceReportCount } from '../../src/services/aggregationService.js';
import { query } from '../../src/db/index.js';

test('Aggregation: identifies clusters reaching configured threshold', async () => {
  const result = await runClusterAggregation();
  assert.ok(result.threshold >= 1);
  assert.ok(result.windowHours >= 1);

  // KPHB Metro has 5 seeded reports in the last 24h
  const kphbAlert = result.activeClusters.find(c => c.place_normalized === 'kphb metro');
  assert.ok(kphbAlert, 'KPHB Metro should be detected as an active cluster alert');
  assert.ok(kphbAlert.report_count >= 5, `Expected count >= 5, got ${kphbAlert?.report_count}`);
});

test('Aggregation: excludes reports older than the rolling window', async () => {
  // rep_kphb_old was seeded 36 hours ago, so count in 24h window should only be 5, not 6
  const count24h = await getPlaceReportCount('kphb metro', 24);
  const count48h = await getPlaceReportCount('kphb metro', 48);

  assert.strictEqual(count24h, 5, '24 hour count should not include 36-hour old report');
  assert.strictEqual(count48h, 6, '48 hour count should include both recent and older report');
});

test('Aggregation: keeps distinct places separate without accidental conflation', async () => {
  const hitecCount = await getPlaceReportCount('hitec city', 24);
  const gachibowliCount = await getPlaceReportCount('gachibowli', 24);

  assert.strictEqual(hitecCount, 1);
  assert.strictEqual(gachibowliCount, 1);
  // They should not trigger an alert because count is 1 < 5
  const result = await runClusterAggregation();
  const hitecAlert = result.activeClusters.find(c => c.place_normalized === 'hitec city');
  assert.strictEqual(hitecAlert, undefined, 'Hitec City should not trigger an alert below threshold');
});
