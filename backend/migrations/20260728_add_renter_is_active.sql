BEGIN;

ALTER TABLE renters
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS ix_renters_is_active ON renters (is_active);

COMMIT;
