CREATE TABLE IF NOT EXISTS alerts_sent (
  account_id TEXT NOT NULL,
  cycle_start_at TEXT NOT NULL,
  threshold INTEGER NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  recipients TEXT NOT NULL,
  PRIMARY KEY (account_id, cycle_start_at, threshold)
);
