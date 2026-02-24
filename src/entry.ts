#!/usr/bin/env node

// MCP Stdio Guard
// Redirects console.log to stderr before any imports to prevent stdout pollution

if (!process.env.MCP_TRANSPORT || process.env.MCP_TRANSPORT === 'stdio') {
  console.log = (...args: unknown[]) => {
    process.stderr.write(
      args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ') + '\n'
    );
  };
}

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
try {
  const projectRoot = resolve(__dirname, '..');
  const envPath = existsSync(resolve(process.cwd(), '.env'))
    ? resolve(process.cwd(), '.env')
    : resolve(projectRoot, '.env');
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
} catch {
  // No .env file
}

import('./index.js').catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
