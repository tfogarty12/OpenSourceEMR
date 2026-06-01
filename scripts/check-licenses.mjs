#!/usr/bin/env node
// Enforces the split-licensing rule (see licensing.md):
//   apps/*     must be AGPL-3.0-only
//   packages/* must be Apache-2.0
// Fails (non-zero exit) on any violation so CI can gate it.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const rules = [
  { dir: 'apps', expected: 'AGPL-3.0-only' },
  { dir: 'packages', expected: 'Apache-2.0' },
];

const problems = [];

for (const { dir, expected } of rules) {
  if (!existsSync(dir)) continue;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pkgPath = join(dir, entry.name, 'package.json');
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (pkg.license !== expected) {
      problems.push(`${pkgPath}: license is "${pkg.license ?? '(none)'}", expected "${expected}"`);
    }
  }
}

if (problems.length > 0) {
  console.error('License boundary violations:');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

console.log('License boundary OK: apps/* = AGPL-3.0-only, packages/* = Apache-2.0');
