-- FHIR store schema.
--
-- Resources are stored as JSONB. `fhir_resource` holds the current state of
-- each resource; `fhir_resource_history` keeps every version (the audit trail
-- and the basis for vread / $history). Deletes are soft (deleted = true).

CREATE TABLE IF NOT EXISTS fhir_resource (
  resource_type text        NOT NULL,
  id            text        NOT NULL,
  version_id    integer     NOT NULL,
  last_updated  timestamptz NOT NULL DEFAULT now(),
  deleted       boolean     NOT NULL DEFAULT false,
  content       jsonb       NOT NULL,
  PRIMARY KEY (resource_type, id)
);

CREATE TABLE IF NOT EXISTS fhir_resource_history (
  resource_type text        NOT NULL,
  id            text        NOT NULL,
  version_id    integer     NOT NULL,
  last_updated  timestamptz NOT NULL DEFAULT now(),
  deleted       boolean     NOT NULL DEFAULT false,
  content       jsonb       NOT NULL,
  PRIMARY KEY (resource_type, id, version_id)
);

-- Fast filter to live resources of a type.
CREATE INDEX IF NOT EXISTS fhir_resource_live_type_idx
  ON fhir_resource (resource_type)
  WHERE deleted = false;

-- Containment / membership queries on the JSONB body (e.g. identifier search).
CREATE INDEX IF NOT EXISTS fhir_resource_content_gin
  ON fhir_resource USING gin (content jsonb_path_ops);
