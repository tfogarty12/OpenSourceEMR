import {
  buildApp,
  defaultDependencies,
  dependenciesFor,
  type AppDependencies,
  type DependencyParts,
} from './app';
import { loadConfig } from './config';
import { createPool } from './db/pool';
import { runMigrations } from './db/migrate';
import { PostgresFhirStore } from './fhir-store/postgres-store';
import { InMemoryFhirStore } from './fhir-store/in-memory-store';
import { InMemoryAuditLog } from './audit/audit-log';
import { PostgresAuditLog } from './audit/postgres-audit-log';
import { DevTokenVerifier } from './identity/token';
import { registerDevLogin } from './identity/plugin';

const config = loadConfig();

async function buildDependencies(): Promise<AppDependencies> {
  const parts: DependencyParts = {};
  if (config.authDevSecret) {
    parts.tokenVerifier = new DevTokenVerifier(config.authDevSecret);
  }

  if (!config.databaseUrl) {
    parts.auditLog = new InMemoryAuditLog();
    return dependenciesFor(new InMemoryFhirStore(), parts);
  }

  const pool = createPool(config.databaseUrl);
  const applied = await runMigrations(pool);
  if (applied.length > 0) {
    console.log(`Migrations applied: ${applied.join(', ')}`);
  }
  parts.auditLog = new PostgresAuditLog(pool);
  return dependenciesFor(new PostgresFhirStore(pool), parts);
}

async function start(): Promise<void> {
  const deps =
    config.databaseUrl || config.authDevSecret ? await buildDependencies() : defaultDependencies();
  const app = buildApp({ logger: { level: config.logLevel } }, deps);

  if (config.authDevSecret) {
    registerDevLogin(app, config.authDevSecret);
  } else {
    app.log.warn('AUTH_DEV_SECRET not set — protected routes will reject all requests (401).');
  }
  if (!config.databaseUrl) {
    app.log.warn('DATABASE_URL not set — using in-memory storage (data is not persisted).');
  }

  const address = await app.listen({ host: config.host, port: config.port });
  app.log.info(`OpenSourceEMR API listening at ${address}`);
}

start().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
