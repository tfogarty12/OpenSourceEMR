import { randomUUID } from 'node:crypto';
import type { Resource } from '@osemr/fhir-model';
import { matchesSearch, stampMeta, type FhirStore, type SearchParams } from './store';

interface StoredEntry {
  versionId: number;
  lastUpdated: string;
  deleted: boolean;
  content: Resource;
}

/**
 * In-memory FhirStore for local dev and tests. Not durable, not for production,
 * but behaviorally identical to the Postgres store for the operations we
 * support (versioning, soft delete, search semantics) — that parity is what the
 * shared search registry in store.ts buys us.
 */
export class InMemoryFhirStore implements FhirStore {
  private readonly entries = new Map<string, StoredEntry>();

  private key(resourceType: string, id: string): string {
    return `${resourceType}/${id}`;
  }

  private now(): string {
    return new Date().toISOString();
  }

  create<T extends Resource>(resource: T): Promise<T> {
    const id = resource.id ?? randomUUID();
    const lastUpdated = this.now();
    const stamped = stampMeta({ ...resource, id }, 1, lastUpdated);
    this.entries.set(this.key(resource.resourceType, id), {
      versionId: 1,
      lastUpdated,
      deleted: false,
      content: structuredClone(stamped),
    });
    return Promise.resolve(stamped);
  }

  read(resourceType: string, id: string): Promise<Resource | undefined> {
    const entry = this.entries.get(this.key(resourceType, id));
    if (!entry || entry.deleted) return Promise.resolve(undefined);
    return Promise.resolve(structuredClone(entry.content));
  }

  update<T extends Resource>(resource: T): Promise<T> {
    if (!resource.id) throw new Error('update requires resource.id');
    const k = this.key(resource.resourceType, resource.id);
    const prior = this.entries.get(k);
    const versionId = (prior?.versionId ?? 0) + 1;
    const lastUpdated = this.now();
    const stamped = stampMeta(resource, versionId, lastUpdated);
    this.entries.set(k, {
      versionId,
      lastUpdated,
      deleted: false,
      content: structuredClone(stamped),
    });
    return Promise.resolve(stamped);
  }

  remove(resourceType: string, id: string): Promise<boolean> {
    const entry = this.entries.get(this.key(resourceType, id));
    if (!entry || entry.deleted) return Promise.resolve(false);
    entry.deleted = true;
    entry.versionId += 1;
    entry.lastUpdated = this.now();
    return Promise.resolve(true);
  }

  search(resourceType: string, params: SearchParams): Promise<Resource[]> {
    const results: Resource[] = [];
    for (const entry of this.entries.values()) {
      if (entry.deleted) continue;
      if (entry.content.resourceType !== resourceType) continue;
      if (matchesSearch(resourceType, entry.content, params)) {
        results.push(structuredClone(entry.content));
      }
    }
    return Promise.resolve(results);
  }
}
