import { Pool } from 'pg';

/** Create a Postgres connection pool from a connection string (DATABASE_URL). */
export function createPool(connectionString: string | undefined = process.env.DATABASE_URL): Pool {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set; cannot create a Postgres pool');
  }
  return new Pool({ connectionString });
}
