import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import app from '../../src/app.js';
import { SESSION_COOKIE_NAME } from '../../src/middleware/auth.js';

test('Integration: Public report submission succeeds and returns reference ID', async () => {
  const res = await request(app)
    .post('/api/reports')
    .field('place_original', 'KPHB Metro Station - Gate 2')
    .field('place_landmark', 'Near ticket counter')
    .field('incident_time', new Date().toISOString())
    .field('incident_time_approx', 'false')
    .field('category', 'harassment')
    .field('description', 'Catcalling from two individuals standing near gate 2.')
    .field('reporter_contact', 'optional_user@example.com')
    .field('reporter_contact_note', 'Safe to email for follow-up')
    .expect(201);

  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.referenceId);
  assert.match(res.body.referenceId, /^SFR-\d{4}-[A-F0-9]{6}$/);
  // Ensure sensitive fields are not in the response
  assert.strictEqual(res.body.reporter_contact, undefined);
  assert.strictEqual(res.body.id, undefined);
});

test('Integration: Unauthenticated access to admin endpoints is rejected with 401', async () => {
  const res = await request(app)
    .get('/api/admin/reports')
    .expect(401);

  assert.ok(res.body.error);
});

test('Integration: Admin login flow, session cookie, and authenticated report review', async () => {
  // 1. Bad credentials rejected
  await request(app)
    .post('/api/admin/login')
    .send({ username: 'admin', password: 'WrongPassword!' })
    .expect(401);

  // 2. Successful login sets session cookie
  const loginRes = await request(app)
    .post('/api/admin/login')
    .send({ username: 'admin', password: 'Admin@SafeSignal2026!' })
    .expect(200);

  assert.strictEqual(loginRes.body.success, true);
  assert.strictEqual(loginRes.body.user.username, 'admin');

  const cookies = loginRes.headers['set-cookie'];
  assert.ok(cookies, 'Should set session cookie');
  const sessionCookie = cookies.find(c => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  assert.ok(sessionCookie, 'Cookie name must match SESSION_COOKIE_NAME');

  // Extract raw cookie header string for subsequent requests
  const authCookieHeader = sessionCookie.split(';')[0];

  // 3. Authenticated overview
  const overviewRes = await request(app)
    .get('/api/admin/overview')
    .set('Cookie', [authCookieHeader])
    .expect(200);

  assert.ok(overviewRes.body.overview.totalReports >= 5);
  assert.ok(overviewRes.body.overview.locationsAtThreshold >= 1);

  // 4. Authenticated reports listing
  const listRes = await request(app)
    .get('/api/admin/reports')
    .set('Cookie', [authCookieHeader])
    .expect(200);

  assert.ok(listRes.body.reports.length > 0);
  const firstReport = listRes.body.reports[0];
  assert.ok(firstReport.reference_id);
  assert.ok(firstReport.place_window_count !== undefined);

  // 5. Authenticated report detail
  const detailRes = await request(app)
    .get(`/api/admin/reports/${firstReport.id}`)
    .set('Cookie', [authCookieHeader])
    .expect(200);

  assert.strictEqual(detailRes.body.report.id, firstReport.id);

  // 6. Update report status
  const updateRes = await request(app)
    .patch(`/api/admin/reports/${firstReport.id}/status`)
    .set('Cookie', [authCookieHeader])
    .send({ status: 'reviewing', internal_note: 'Assigned to community coordinator.' })
    .expect(200);

  assert.strictEqual(updateRes.body.success, true);

  // 7. Responder deliberate action logging
  const actionRes = await request(app)
    .post('/api/admin/responders/action-log')
    .set('Cookie', [authCookieHeader])
    .send({
      contactId: 'resp_01',
      placeNormalized: 'kphb metro',
      reportId: firstReport.id
    })
    .expect(200);

  assert.strictEqual(actionRes.body.success, true);

  // 8. Verify audit logs record the deliberate responder action
  const auditRes = await request(app)
    .get('/api/admin/audit-logs')
    .set('Cookie', [authCookieHeader])
    .expect(200);

  const responderAudit = auditRes.body.logs.find(l => l.action === 'DELIBERATE_RESPONDER_ACTION_INITIATED');
  assert.ok(responderAudit, 'Audit trail must record deliberate responder contact action');
});
