/** Runtime configuration, read from the environment (see .env.example). */
export interface AppConfig {
  host: string;
  port: number;
  logLevel: string;
  /** Postgres connection string. When absent, the API uses in-memory storage. */
  databaseUrl?: string;
  /** HS256 secret enabling dev login/token verification. Dev only. */
  authDevSecret?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const config: AppConfig = {
    host: env.HOST ?? '0.0.0.0',
    port: Number(env.PORT ?? '8080'),
    logLevel: env.LOG_LEVEL ?? 'info',
  };
  if (env.DATABASE_URL) config.databaseUrl = env.DATABASE_URL;
  if (env.AUTH_DEV_SECRET) config.authDevSecret = env.AUTH_DEV_SECRET;
  return config;
}
