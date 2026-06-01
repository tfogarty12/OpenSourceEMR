import { buildApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const app = buildApp({ logger: { level: config.logLevel } });

app
  .listen({ host: config.host, port: config.port })
  .then((address) => {
    app.log.info(`OpenSourceEMR API listening at ${address}`);
  })
  .catch((err: unknown) => {
    app.log.error(err);
    process.exit(1);
  });
