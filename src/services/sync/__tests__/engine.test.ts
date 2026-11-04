import { MAX_REJECTIONS, mergeEntries, pullChanges, pushChanges, syncOnce } from '../engine';
import { FakeDevice, FakeServer } from '../testing/fakes';
import type { SyncDeps } from '../types';

const USER = '11111111-1111-4111-8111-111111111111';

function setup() {
  const device = new FakeDevice();
  const server = new FakeServer();
  const deps: SyncDeps = { userId: USER, outbox: device, local: device, remote: server };
  return { device, server, deps };
}

let n = 0;
function uuid() {
  n += 1;
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function iso(minute: number) {
  return new Date(Date.UTC(2026, 10, 4, 9, minute)).toISOString();
}

function review(cardId: string, minute: number) {
  return {
    id: uuid(),
    card_id: cardId,
    rating: 3,
    was_new: 0,
    state: 2,
    due: iso(minute + 600),
    stability: 3.2,
    difficulty: 5.1,
    scheduled_days: 2,
    reviewed_at: iso(minute),
    created_at: iso(minute),
  };
}

function session(minute: number) {
  return {
    id: uuid(),
    course_id: uuid(),
    topic_id: null,
    plan_item_id: null,
    date: '2026-11-04',
    minutes: 25,
    source: 'timer',
    started_at: iso(minute),
    ended_at: iso(minute + 25),
    created_at: iso(minute + 25),
    updated_at: iso(minute + 25),
    deleted_at: null,
  };
}

/** US-05: 12 card reviews and 1 study session recorded while offline. */
function recordOffline(device: FakeDevice) {
  const cardId = uuid();
  for (let i = 0; i < 12; i++) device.localUpsert('card_reviews', review(cardId, i));
  device.localUpsert('study_sessions', session(20));
}

describe('US-05 Çevrimdışı kayıtların eşitlenmesi', () => {
  it('pushes 12 reviews and 1 session once the connection is back, without duplicates', async () => {
    const { device, server, deps } = setup();
    server.offline = true;
    recordOffline(device);

    const offline = await syncOnce(deps);
    expect(offline.push.retryLater).toBe(true);
    expect(device.outbox).toHaveLength(13);
    expect(server.rows('card_reviews')).toHaveLength(0);

    server.offline = false;
    const online = await syncOnce(deps);
    expect(online.push).toMatchObject({ pushed: 13, rejected: 0, retryLater: false });
    expect(server.rows('card_reviews')).toHaveLength(12);
    expect(server.rows('study_sessions')).toHaveLength(1);
    expect(device.outbox).toHaveLength(0);

    // Every remote row belongs to the signed-in user.
    expect(server.rows('card_reviews').every((r) => r.user_id === USER)).toBe(true);

    const writes = server.writes;
    const again = await syncOnce(deps);
    expect(again.push.pushed).toBe(0);
    expect(server.writes).toBe(writes);
    expect(server.rows('card_reviews')).toHaveLength(12);
    expect(server.rows('study_sessions')).toHaveLength(1);
  });

  it('does not duplicate rows when the server saved them but the answer got lost', async () => {
    const { device, server, deps } = setup();
    recordOffline(device);
    server.loseNextResponse = true;

    const first = await syncOnce(deps);
    expect(first.push.retryLater).toBe(true);
    // The first table (card_reviews) reached the server, but the device could not know.
    expect(server.rows('card_reviews')).toHaveLength(12);
    expect(device.outbox).toHaveLength(13);

    await syncOnce(deps);
    expect(server.rows('card_reviews')).toHaveLength(12);
    expect(server.rows('study_sessions')).toHaveLength(1);
    expect(device.outbox).toHaveLength(0);
  });

  it('keeps the changes after a failed push and sends them on the next run', async () => {
    const { device, server, deps } = setup();
    recordOffline(device);
    server.failNext = 1;

    const failed = await pushChanges(deps);
    expect(failed).toMatchObject({ pushed: 0, retryLater: true });
    expect(device.outbox).toHaveLength(13);
    // A network or server failure is not the row's fault.
    expect(device.outbox.every((e) => e.attempts === 0)).toBe(true);

    const retried = await pushChanges(deps);
    expect(retried).toMatchObject({ pushed: 13, retryLater: false });
    expect(device.outbox).toHaveLength(0);
  });

  it('does not overwrite unsent local edits when it pulls', async () => {
    const { device, server, deps } = setup();
    server.offline = true;
    recordOffline(device);
    await syncOnce(deps);
    expect(device.table('card_reviews').size).toBe(12);
    expect(device.notified).toHaveLength(0);
  });
});

describe('push', () => {
  it('sends the full row plus the deletion when a row was created and deleted offline', async () => {
    const { device, server, deps } = setup();
    const id = uuid();
    device.localUpsert('courses', { id, name: 'Fizik', color: '#2A3FD1', catalog_key: null, archived_at: null, created_at: iso(1), updated_at: iso(1), deleted_at: null });
    device.localSoftDelete('courses', id, iso(2));

    const report = await pushChanges(deps);
    expect(report.pushed).toBe(1);
    expect(server.table('courses').get(id)).toMatchObject({ name: 'Fizik', deleted_at: iso(2), updated_at: iso(2), user_id: USER });
    expect(device.outbox).toHaveLength(0);
  });

  it('treats a deletion of a row the server never had as done', async () => {
    const { device, server, deps } = setup();
    device.localSoftDelete('homework', uuid(), iso(3));
    const report = await pushChanges(deps);
    expect(report).toMatchObject({ pushed: 1, retryLater: false });
    expect(server.rows('homework')).toHaveLength(0);
    expect(device.outbox).toHaveLength(0);
  });

  it('isolates a row the server refuses and sends the rest', async () => {
    const { device, server, deps } = setup();
    recordOffline(device);
    const bad = device.outbox[4].row_id;
    server.rejectIds.add(bad);

    const report = await pushChanges(deps);
    expect(report).toMatchObject({ pushed: 12, rejected: 1, retryLater: false });
    expect(server.rows('card_reviews')).toHaveLength(11);
    expect(device.outbox).toHaveLength(1);
    expect(device.outbox[0]).toMatchObject({ row_id: bad, attempts: 1 });
  });

  it('leaves a change out of automatic runs after repeated rejections, but keeps it', async () => {
    const { device, server, deps } = setup();
    const row = review(uuid(), 1);
    device.localUpsert('card_reviews', row);
    server.rejectIds.add(row.id);

    for (let i = 0; i < MAX_REJECTIONS; i++) await pushChanges(deps);
    expect(device.outbox[0].attempts).toBe(MAX_REJECTIONS);

    const skipped = await pushChanges(deps);
    expect(skipped).toMatchObject({ pushed: 0, rejected: 0 });

    server.rejectIds.clear();
    const atStart = await pushChanges(deps, { includeStuck: true });
    expect(atStart.pushed).toBe(1);
    expect(device.outbox).toHaveLength(0);
  });

  it('converts rows for Postgres: user_id, jsonb values, no device-only or server-owned columns', async () => {
    const { device, server, deps } = setup();
    const quizId = uuid();
    device.localUpsert('questions', {
      id: uuid(),
      quiz_id: quizId,
      stem: 'Hangisi asaldır?',
      options: JSON.stringify(['4', '6', '7', '9']),
      correct_index: 2,
      explanation: '',
      source_page: 3,
      topic: null,
      sort: 0,
      edited: 0,
      hidden: 0,
      created_at: iso(1),
      updated_at: iso(1),
      deleted_at: null,
    });
    device.localUpsert('documents', { id: uuid(), course_id: uuid(), title: 'Notlar', file_uri: 'file:///doc.pdf', quota_month: '2026-11', created_at: iso(1), updated_at: iso(1) });
    device.localUpsert('profile', { id: USER, nickname: 'Ada', plan: 'pro', consent_status: 'granted', created_at: iso(1), updated_at: iso(1) });

    await pushChanges(deps);
    expect(server.rows('questions')[0].options).toEqual(['4', '6', '7', '9']);
    expect(server.rows('documents')[0]).not.toHaveProperty('file_uri');
    expect(server.rows('profiles')[0]).toMatchObject({ id: USER, nickname: 'Ada' });
    expect(server.rows('profiles')[0]).not.toHaveProperty('user_id');
    // The server decides these (store webhook, parent consent).
    expect(server.rows('profiles')[0]).not.toHaveProperty('plan');
    expect(server.rows('profiles')[0]).not.toHaveProperty('consent_status');
  });
});

describe('pull', () => {
  it('writes rows from the server without queueing them and in app formats', async () => {
    const { device, server, deps } = setup();
    const examId = uuid();
    server.serverWrite('exams', {
      id: examId,
      user_id: USER,
      course_id: null,
      kind: 'official',
      title: 'LGS',
      date: '2027-06-12',
      time: '09:30:00',
      topic_ids: ['a', 'b'],
      official_key: 'LGS',
      score: null,
      created_at: '2026-11-04T08:00:00.123456+00:00',
      updated_at: '2026-11-04T08:00:00.123456+00:00',
      deleted_at: null,
    });

    const report = await pullChanges(deps);
    expect(report).toMatchObject({ received: 1, written: 1 });
    expect(device.outbox).toHaveLength(0);
    expect(device.table('exams').get(examId)).toEqual({
      id: examId,
      course_id: null,
      kind: 'official',
      title: 'LGS',
      date: '2027-06-12',
      time: '09:30',
      topic_ids: '["a","b"]',
      official_key: 'LGS',
      score: null,
      created_at: '2026-11-04T08:00:00.123Z',
      updated_at: '2026-11-04T08:00:00.123Z',
      deleted_at: null,
    });
    expect(device.notified).toEqual([['exams']]);
  });

  it('keeps a newer local edit but always takes server-owned columns', async () => {
    const { device, server, deps } = setup();
    device.table('profile').set(USER, { id: USER, nickname: 'Yeni', plan: 'free', consent_status: 'pending', updated_at: iso(30) });
    server.serverWrite('profiles', { id: USER, nickname: 'Eski', plan: 'pro', consent_status: 'granted', updated_at: iso(10), created_at: iso(1) });

    await pullChanges(deps);
    expect(device.table('profile').get(USER)).toMatchObject({ nickname: 'Yeni', plan: 'pro', consent_status: 'granted' });
  });

  it('takes the server version when it is newer', async () => {
    const { device, server, deps } = setup();
    const id = uuid();
    device.table('courses').set(id, { id, name: 'Mat', color: '#000', updated_at: iso(1) });
    server.serverWrite('courses', { id, user_id: USER, name: 'Matematik', color: '#000', created_at: iso(1), updated_at: iso(5), deleted_at: null });

    await pullChanges(deps);
    expect(device.table('courses').get(id)).toMatchObject({ name: 'Matematik', updated_at: iso(5) });
  });

  it('never overwrites the device-only file path of a document', async () => {
    const { device, server, deps } = setup();
    const id = uuid();
    device.table('documents').set(id, { id, title: 'Notlar', file_uri: 'file:///local.pdf', status: 'processing', updated_at: iso(1) });
    server.serverWrite('documents', { id, user_id: USER, title: 'Notlar', status: 'ready', storage_path: `${USER}/${id}.pdf`, updated_at: iso(2) });

    await pullChanges(deps);
    expect(device.table('documents').get(id)).toMatchObject({ file_uri: 'file:///local.pdf', status: 'ready' });
  });

  it('skips rows with local changes still waiting to be pushed', async () => {
    const { device, server, deps } = setup();
    const id = uuid();
    device.localUpsert('courses', { id, name: 'Kimya', color: '#111', created_at: iso(1), updated_at: iso(1) });
    server.serverWrite('courses', { id, user_id: USER, name: 'Biyoloji', color: '#111', created_at: iso(1), updated_at: iso(9) });

    await pullChanges(deps);
    expect(device.table('courses').get(id)).toMatchObject({ name: 'Kimya' });
  });

  it('does not rewrite append-only rows the device already has', async () => {
    const { device, server, deps } = setup();
    const row = review(uuid(), 1);
    device.table('card_reviews').set(row.id, row);
    server.serverWrite('card_reviews', { ...row, user_id: USER, rating: 1 });

    const report = await pullChanges(deps);
    expect(report.written).toBe(0);
    expect(device.table('card_reviews').get(row.id)).toMatchObject({ rating: 3 });
  });

  it('pages through large changes and moves the cursor', async () => {
    const { device, server, deps } = setup();
    for (let i = 0; i < 1203; i++) {
      server.serverWrite('cards', { id: uuid(), user_id: USER, deck_id: 'd', front: `Ön ${i}`, back: 'Arka', due: iso(1), created_at: iso(1), updated_at: iso(1) });
    }
    const first = await pullChanges(deps);
    expect(first.written).toBe(1203);
    expect(device.table('cards').size).toBe(1203);

    // The next run only re-reads the short overlap window and writes nothing.
    const second = await pullChanges(deps);
    expect(second.written).toBe(0);
  });

  it('stops and reports when the server cannot be reached', async () => {
    const { server, deps } = setup();
    server.offline = true;
    const report = await pullChanges(deps);
    expect(report.retryLater).toBe(true);
  });
});

describe('mergeEntries', () => {
  it('keeps one change per row and remembers every outbox entry it covers', () => {
    const merged = mergeEntries([
      { seq: 1, table_name: 'courses', row_id: 'a', op: 'upsert', payload: '{"id":"a","name":"x","updated_at":"1"}', attempts: 0, created_at: '' },
      { seq: 2, table_name: 'courses', row_id: 'a', op: 'upsert', payload: '{"id":"a","name":"y","updated_at":"2"}', attempts: 2, created_at: '' },
      { seq: 3, table_name: 'courses', row_id: 'b', op: 'delete', payload: '{"id":"b","deleted_at":"3","updated_at":"3"}', attempts: 0, created_at: '' },
    ]);
    expect(merged).toEqual([
      { table: 'courses', id: 'a', seqs: [1, 2], attempts: 2, op: 'upsert', payload: { id: 'a', name: 'y', updated_at: '2' } },
      { table: 'courses', id: 'b', seqs: [3], attempts: 0, op: 'delete', payload: { id: 'b', deleted_at: '3', updated_at: '3' } },
    ]);
  });
});
