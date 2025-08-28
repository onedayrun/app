import { execSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import axios from 'axios';
import * as dotenv from 'dotenv';
import WebSocket from 'ws';

const ROOT = path.resolve(__dirname, '..');
const CWD = ROOT; // docker compose lives at repo root

// Load .env from root if present
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const NGINX_PORT = parseInt(process.env.NGINX_PORT || '8087', 10);
const YJS_PORT = parseInt(process.env.YJS_PORT || '4444', 10);
const BASE = `http://localhost:${NGINX_PORT}`;

function sh(cmd: string) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: CWD, env: process.env });
}

async function waitForHealth(timeoutMs = 60_000) {
  const start = Date.now();
  const url = `${BASE}/health`;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await axios.get(url, { timeout: 2000 });
      if (res.status === 200 && res.data?.status === 'healthy') {
        console.log('Health OK');
        return;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Health check timed out after ${timeoutMs}ms at ${url}`);
}

async function testHealth() {
  const res = await axios.get(`${BASE}/health`);
  if (!(res.status === 200 && res.data?.status === 'healthy')) {
    throw new Error('Health endpoint failed');
  }
}

async function testCreateProject() {
  const res = await axios.post(`${BASE}/api/projects`, { metadata: { from: 'e2e' } }, {
    headers: { 'Content-Type': 'application/json' }
  });
  if (res.status !== 200 || !res.data?.id) {
    throw new Error('Project creation failed');
  }
  return res.data.id as string;
}

async function testGetProject(id: string) {
  const res = await axios.get(`${BASE}/api/projects/${id}`);
  if (res.status !== 200 || res.data?.id !== id) {
    throw new Error('Fetch project failed');
  }
}

async function testFrontend() {
  const res = await axios.get(`${BASE}/`, { responseType: 'text' });
  const html: string = res.data;
  if (res.status !== 200 || !html.includes('<!DOCTYPE html>')) {
    throw new Error('Frontend root not served');
  }
}

async function testYjsDirect() {
  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${YJS_PORT}`);
    const to = setTimeout(() => {
      ws.terminate();
      reject(new Error('Yjs direct WS timeout'));
    }, 4000);
    ws.on('open', () => {
      clearTimeout(to);
      ws.close();
      resolve();
    });
    ws.on('error', (err) => {
      clearTimeout(to);
      reject(err);
    });
  });
}

async function testYjsViaNginx() {
  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${NGINX_PORT}/yjs`);
    const to = setTimeout(() => {
      ws.terminate();
      reject(new Error('Yjs via Nginx WS timeout'));
    }, 4000);
    ws.on('open', () => {
      clearTimeout(to);
      ws.close();
      resolve();
    });
    ws.on('error', (err) => {
      clearTimeout(to);
      reject(err);
    });
  });
}

async function run() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--up')) {
    sh('docker compose up -d --build');
    return;
  }
  if (args.has('--down')) {
    sh('docker compose down -v');
    return;
  }

  // Full e2e flow
  sh('docker compose up -d --build');
  await waitForHealth();

  const results: { name: string; ok: boolean; err?: any }[] = [];
  async function runTest(name: string, fn: () => Promise<any>) {
    try {
      await fn();
      console.log(`✔ ${name}`);
      results.push({ name, ok: true });
    } catch (err) {
      console.error(`✖ ${name}`);
      console.error(err);
      results.push({ name, ok: false, err });
    }
  }

  let projectId = '';
  await runTest('Health endpoint', testHealth);
  await runTest('Frontend root served', testFrontend);
  await runTest('Create project', async () => { projectId = await testCreateProject(); });
  if (projectId) {
    await runTest('Fetch created project', async () => testGetProject(projectId));
  }
  await runTest('Yjs WebSocket (direct)', testYjsDirect);
  await runTest('Yjs WebSocket (via Nginx)', testYjsViaNginx);

  const failed = results.filter(r => !r.ok);
  console.log('\nSummary:');
  for (const r of results) console.log(` - ${r.ok ? 'PASS' : 'FAIL'} ${r.name}`);

  // Always tear down unless KEEP_STACK=1 is set
  try {
    if (process.env.KEEP_STACK !== '1') sh('docker compose down -v');
  } catch {}

  if (failed.length) process.exit(1);
}

run().catch(err => {
  console.error(err);
  try { sh('docker compose down -v'); } catch {}
  process.exit(1);
});
