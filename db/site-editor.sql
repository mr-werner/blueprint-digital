-- Client site editor (portal /portal/editor/, api/site-editor.js). Safe to run more than once.
ALTER TABLE demos ADD COLUMN IF NOT EXISTS editor_enabled boolean NOT NULL DEFAULT false;

-- Each site's edits, stored as overrides (field key -> value) on top of the content built into the site
CREATE TABLE IF NOT EXISTS site_content (
  demo_id integer PRIMARY KEY REFERENCES demos(id) ON DELETE CASCADE,
  draft jsonb,
  draft_updated_at timestamptz,
  published jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  published_version integer
);

-- Every publish, so a client (or the studio) can go back to an earlier one
CREATE TABLE IF NOT EXISTS site_content_versions (
  id serial PRIMARY KEY,
  demo_id integer NOT NULL REFERENCES demos(id) ON DELETE CASCADE,
  content jsonb NOT NULL,
  account_id integer REFERENCES client_accounts(id) ON DELETE SET NULL,
  author text,
  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS site_content_versions_demo ON site_content_versions (demo_id, created_at DESC);

-- Images clients upload in the editor; the id is a hash of the bytes
CREATE TABLE IF NOT EXISTS site_assets (
  id text PRIMARY KEY,
  demo_id integer NOT NULL REFERENCES demos(id) ON DELETE CASCADE,
  account_id integer REFERENCES client_accounts(id) ON DELETE SET NULL,
  filename text,
  content_type text NOT NULL,
  size_bytes integer NOT NULL,
  data bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS site_assets_demo ON site_assets (demo_id, created_at DESC);
