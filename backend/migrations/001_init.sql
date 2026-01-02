CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outbox (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  aggregate_id BIGINT NOT NULL REFERENCES events(id),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ NULL,
  UNIQUE (tenant_id, event_id)
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'events_isolation' AND tablename = 'events'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY events_isolation ON events
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
    $policy$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'outbox_isolation' AND tablename = 'outbox'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY outbox_isolation ON outbox
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
    $policy$;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox (published_at) WHERE published_at IS NULL;
