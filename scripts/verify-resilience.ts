import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import postgres from 'postgres';

// All destructive reset checks are confined to a newly created disposable database.
const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) throw new Error('DATABASE_URL is required');
const root = postgres(baseUrl, { max: 1 });
const databaseName = `workshop_test_${randomUUID().replaceAll('-', '')}`;
const testUrl = new URL(baseUrl);
testUrl.pathname = `/${databaseName}`;
let testClient: { end: () => Promise<void> } | undefined;

try {
  await root.unsafe(`CREATE DATABASE "${databaseName}"`);
  process.env.DATABASE_URL = testUrl.toString();
  process.env.DEMO_MODE = 'true';
  const migration = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/migrate.ts'], {
    env: process.env, encoding: 'utf8',
  });
  assert.equal(migration.status, 0, migration.stderr);
  const { db, client } = await import('../src/server/db');
  testClient = client;
  const { leads, services, settings } = await import('../src/server/schema');
  const { eq } = await import('drizzle-orm');
  const { notifyLead } = await import('../src/server/telegram');
  const { resetDemoIfDue } = await import('../src/server/demo');
  const id = randomUUID();
  await db.insert(leads).values({
    id, name: 'Тест отказа уведомления', phone: '+7 000 000-00-00',
    serviceName: 'Балансировка', comment: '',
  });
  process.env.TELEGRAM_BOT_TOKEN = 'test-token-never-sent';
  process.env.TELEGRAM_DEMO_CHAT_ID = 'test-demo-chat';
  process.env.TELEGRAM_CHAT_ID = 'production-chat-must-not-be-used';
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, init) => {
      assert.equal(JSON.parse(String(init?.body)).chat_id, 'test-demo-chat');
      throw new Error('Simulated network failure containing a secret URL');
    };
    await notifyLead(id);
    const [failed] = await db.select().from(leads).where(eq(leads.id, id));
    assert.ok(failed);
    assert.equal(failed.notificationStatus, 'error');
    assert.doesNotMatch(failed.notificationError || '', /secret|token/);
    globalThis.fetch = async () => new Response(JSON.stringify({ ok: true }));
    await notifyLead(id);
    const [sent] = await db.select().from(leads).where(eq(leads.id, id));
    assert.equal(sent?.notificationStatus, 'sent');
    globalThis.fetch = async () => { throw new Error('A sent message must not be sent again'); };
    await notifyLead(id);
    assert.equal((await db.select().from(leads).where(eq(leads.id, id)))[0]?.notificationStatus, 'sent');
  } finally { globalThis.fetch = originalFetch; }
  await db.update(settings).set({ resetAt: new Date(Date.now() - 25 * 3600000), name: 'Изменённое название' });
  await db.update(services).set({ price: 12345 }).where(eq(services.id, 2));
  process.env.DEMO_MODE = 'false';
  await resetDemoIfDue();
  assert.equal((await db.select().from(settings))[0]?.name, 'Изменённое название');
  assert.equal((await db.select().from(services).where(eq(services.id, 2)))[0]?.price, 12345);
  process.env.DEMO_MODE = 'true';
  await Promise.all([resetDemoIfDue(), resetDemoIfDue()]);
  assert.equal((await db.select().from(settings))[0]?.name, 'Точка колеса');
  assert.equal((await db.select().from(services).where(eq(services.id, 2)))[0]?.price, 240000);
  assert.equal((await db.select().from(leads)).length, 1);
  console.log('PASS: Telegram failure, retry, demo chat isolation, reset, concurrent reset, production reset guard.');
} finally {
  await testClient?.end();
  await root.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await root.end();
}
