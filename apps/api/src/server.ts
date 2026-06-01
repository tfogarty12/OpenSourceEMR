import { buildApp, defaultDependencies, dependenciesFor, type AppDependencies } from './app';
import { loadConfig } from './config';
import { createPool } from './db/pool';
import { runMigrations } from './db/migrate';
import { PostgresFhirStore } from './fhir-store/postgres-store';

const config = loadConfig();

async function buildDependencies(): Promise<AppDependencies> {
  if (!config.databaseUrl) {
    return defaultDependencies();
  }
  const pool = createPool(config.databaseUrl);
  const applied = await runMigrations(pool);
  if (applied.length > 0) {
    console.log(`Migrations applied: ${applied.join(', ')}`);
  }
  return dependenciesFor(new PostgresFhirStore(pool));
}

async function start(): Promise<void> {
  const deps = await buildDependencies();
  const app = buildApp({ logger: { level: config.logLevel } }, deps);

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
