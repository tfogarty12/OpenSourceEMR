-- Append-only, tamper-evident audit log.
--
-- recorded_at is stored as text (the exact ISO-8601 instant used when hashing)
-- so the hash chain round-trips byte-for-byte. seq is the chain order; prev_hash
-- and hash form the tamper-evident links. Rows are never updated or deleted.

CREATE TABLE IF NOT EXISTS audit_event (
  seq              bigint  PRIMARY KEY,
  recorded_at      text    NOT NULL,
  actor            text    NOT NULL,
  action           text    NOT NULL,
  resource_type    text    NOT NULL,
  resource_id      text,
  outcome          text    NOT NULL,
  source_ip        text,
  emergency_access boolean NOT NULL DEFAULT false,
  reason           text,
  prev_hash        text    NOT NULL,
  hash             text    NOT NULL
);

-- Common investigative lookups: by actor and by the resource touched.
CREATE INDEX IF NOT EXISTS audit_event_actor_idx ON audit_event (actor);
CREATE INDEX IF NOT EXISTS audit_event_resource_idx ON audit_event (resource_type, resource_id);
