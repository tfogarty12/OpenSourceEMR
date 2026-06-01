/** Runtime configuration, read from the environment (see .env.example). */
export interface AppConfig {
  host: string;
  port: number;
  logLevel: string;
  /** Postgres connection string. When absent, the API uses in-memory storage. */
  databaseUrl?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const config: AppConfig = {
    host: env.HOST ?? '0.0.0.0',
    port: Number(env.PORT ?? '8080'),
    logLevel: env.LOG_LEVEL ?? 'info',
  };
  if (env.DATABASE_URL) config.databaseUrl = env.DATABASE_URL;
  return config;
}
