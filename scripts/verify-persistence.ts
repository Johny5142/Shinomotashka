import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { db, client } from '../src/server/db';
import { leads } from '../src/server/schema';

const origin = process.env.APP_ORIGIN || 'http://localhost:8080';
const before = (await db.select({ id: leads.id }).from(leads)).map(row => row.id).sort();
let stopped = false;
try {
  assert.equal(process.env.DEMO_MODE, 'true', 'Use a local demo only');
  assert.equal(spawnSync('docker', ['compose', 'stop', 'db'], { stdio: 'inherit' }).status, 0);
  stopped = true;
  assert.equal((await fetch(`${origin}/api/health`)).status, 503);
  assert.equal((await fetch(origin)).status, 503);
  console.log('PASS: database outage returns HTTP 503 for the page and API.');
} finally {
  if (stopped) assert.equal(spawnSync('docker', ['compose', 'start', 'db'], { stdio: 'inherit' }).status, 0);
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    const response = await fetch(`${origin}/api/health`);
    if (response.ok) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.equal(ready, true, 'Database must recover');
  const after = (await db.select({ id: leads.id }).from(leads)).map(row => row.id).sort();
  assert.deepEqual(after, before);
  console.log('PASS: recovery after PostgreSQL restart preserves all existing lead IDs.');
} finally { await client.end(); }
