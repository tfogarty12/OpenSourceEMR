import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { Resource } from '@osemr/fhir-model';
import {
  normalizeReference,
  SEARCH_PARAMS,
  stampMeta,
  RESULT_PARAMS,
  type FhirStore,
  type SearchParams,
} from './store';

/**
 * Postgres-backed FhirStore. Resources are stored as JSONB in `fhir_resource`
 * (current state) with every version also appended to `fhir_resource_history`.
 * Writes run in a transaction so current + history stay consistent. Search is
 * built from the same SEARCH_PARAMS registry the in-memory store uses.
 */
export class PostgresFhirStore implements FhirStore {
  constructor(private readonly pool: Pool) {}

  private async tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private async writeVersion(
    client: PoolClient,
    resource: Resource,
    versionId: number,
    lastUpdated: string,
    deleted: boolean,
  ): Promise<void> {
    const { resourceType, id } = resource;
    const content = JSON.stringify(resource);
    await client.query(
      `INSERT INTO fhir_resource (resource_type, id, version_id, last_updated, deleted, content)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (resource_type, id)
       DO UPDATE SET version_id = EXCLUDED.version_id,
                     last_updated = EXCLUDED.last_updated,
                     deleted = EXCLUDED.deleted,
                     content = EXCLUDED.content`,
      [resourceType, id, versionId, lastUpdated, deleted, content],
    );
    await client.query(
      `INSERT INTO fhir_resource_history (resource_type, id, version_id, last_updated, deleted, content)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [resourceType, id, versionId, lastUpdated, deleted, content],
    );
  }

  create<T extends Resource>(resource: T): Promise<T> {
    const id = resource.id ?? randomUUID();
    const lastUpdated = new Date().toISOString();
    const stamped = stampMeta({ ...resource, id }, 1, lastUpdated);
    return this.tx(async (client) => {
      await this.writeVersion(client, stamped, 1, lastUpdated, false);
      return stamped;
    });
  }

  async read(resourceType: string, id: string): Promise<Resource | undefined> {
    const { rows } = await this.pool.query<{ content: Resource }>(
      `SELECT content FROM fhir_resource
       WHERE resource_type = $1 AND id = $2 AND deleted = false`,
      [resourceType, id],
    );
    return rows[0]?.content;
  }

  update<T extends Resource>(resource: T): Promise<T> {
    if (!resource.id) throw new Error('update requires resource.id');
    const lastUpdated = new Date().toISOString();
    return this.tx(async (client) => {
      const { rows } = await client.query<{ version_id: number }>(
        `SELECT version_id FROM fhir_resource
         WHERE resource_type = $1 AND id = $2 FOR UPDATE`,
        [resource.resourceType, resource.id],
      );
      const versionId = (rows[0]?.version_id ?? 0) + 1;
      const stamped = stampMeta(resource, versionId, lastUpdated);
      await this.writeVersion(client, stamped, versionId, lastUpdated, false);
      return stamped;
    });
  }

  remove(resourceType: string, id: string): Promise<boolean> {
    const lastUpdated = new Date().toISOString();
    return this.tx(async (client) => {
      const { rows } = await client.query<{
        version_id: number;
        deleted: boolean;
        content: Resource;
      }>(
        `SELECT version_id, deleted, content FROM fhir_resource
         WHERE resource_type = $1 AND id = $2 FOR UPDATE`,
        [resourceType, id],
      );
      const current = rows[0];
      if (!current || current.deleted) return false;
      const versionId = current.version_id + 1;
      const tombstone = stampMeta(current.content, versionId, lastUpdated);
      await this.writeVersion(client, tombstone, versionId, lastUpdated, true);
      return true;
    });
  }

  async search(resourceType: string, params: SearchParams): Promise<Resource[]> {
    const conditions = ['resource_type = $1', 'deleted = false'];
    const values: unknown[] = [resourceType];
    const next = (value: unknown): string => {
      values.push(value);
      return `$${values.length}`;
    };

    const defs = SEARCH_PARAMS[resourceType] ?? {};
    for (const [name, raw] of Object.entries(params)) {
      if (raw === undefined || raw === '' || RESULT_PARAMS.has(name)) continue;
      const def = defs[name];
      if (!def) continue; // unknown params ignored (FHIR lenient default)

      switch (def.kind) {
        case 'id':
          conditions.push(`id = ${next(raw)}`);
          break;
        case 'equals':
          conditions.push(`content->>'${def.field}' = ${next(raw)}`);
          break;
        case 'reference':
          conditions.push(
            `content->'${def.field}'->>'reference' = ${next(normalizeReference(def.targetType, raw))}`,
          );
          break;
        case 'token-identifier': {
          const [a, b] = raw.split('|');
          if (b === undefined) {
            conditions.push(
              `EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(content->'identifier','[]'::jsonb)) i
                       WHERE i->>'value' = ${next(a)})`,
            );
          } else {
            conditions.push(
              `content->'identifier' @> ${next(JSON.stringify([{ system: a, value: b }]))}::jsonb`,
            );
          }
          break;
        }
        case 'string': {
          const like = `%${raw}%`;
          const placeholder = next(like);
          const ors = def.paths.map((p) =>
            p === 'name.family'
              ? `EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(content->'name','[]'::jsonb)) nm
                         WHERE nm->>'family' ILIKE ${placeholder})`
              : `EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(content->'name','[]'::jsonb)) nm,
                                jsonb_array_elements_text(COALESCE(nm->'given','[]'::jsonb)) gv
                         WHERE gv ILIKE ${placeholder})`,
          );
          conditions.push(`(${ors.join(' OR ')})`);
          break;
        }
      }
    }

    const { rows } = await this.pool.query<{ content: Resource }>(
      `SELECT content FROM fhir_resource WHERE ${conditions.join(' AND ')}
       ORDER BY last_updated DESC`,
      values,
    );
    return rows.map((r) => r.content);
  }
}
