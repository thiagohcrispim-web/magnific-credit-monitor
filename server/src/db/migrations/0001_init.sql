CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'magnific',
  renewal_day INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  taken_at TEXT NOT NULL,
  spent INTEGER NOT NULL,
  available INTEGER NOT NULL,
  total_plan INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snapshots_account_time ON snapshots(account_id, taken_at);

CREATE TABLE IF NOT EXISTS cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  start_at TEXT NOT NULL,
  end_at TEXT,
  start_spent INTEGER NOT NULL,
  end_spent INTEGER,
  detected_by TEXT NOT NULL DEFAULT 'renewal_day'
);
CREATE INDEX IF NOT EXISTS idx_cycles_account ON cycles(account_id, start_at);

CREATE TABLE IF NOT EXISTS projects (
  reference TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS creations (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  created_at TEXT NOT NULL,
  file_type TEXT NOT NULL,
  tool_name TEXT,
  model TEXT,
  project_reference TEXT,
  resolution TEXT,
  duration_seconds REAL,
  web_url TEXT,
  raw_metadata TEXT,
  estimated_cost REAL,
  cost_layer TEXT,
  attributed_cost REAL,
  confidence REAL,
  snapshot_from_id INTEGER,
  snapshot_to_id INTEGER,
  synced_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_creations_account_time ON creations(account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_creations_interval ON creations(snapshot_from_id, snapshot_to_id);

CREATE TABLE IF NOT EXISTS cost_table (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL CHECK (scope IN ('model','tool','file_type')),
  key TEXT NOT NULL,
  credits REAL NOT NULL,
  UNIQUE(scope, key)
);

CREATE TABLE IF NOT EXISTS settings (
  account_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (account_id, key)
);

CREATE TABLE IF NOT EXISTS sync_state (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id),
  last_creation_synced_at TEXT,
  last_snapshot_at TEXT
);
