/** Runtime configuration, read from the environment (see .env.example). */
export interface AppConfig {
  host: string;
  port: number;
  logLevel: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    host: env.HOST ?? '0.0.0.0',
    port: Number(env.PORT ?? '8080'),
    logLevel: env.LOG_LEVEL ?? 'info',
  };
}
