CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  menu_item_slug TEXT NOT NULL,
  author TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  ip_hash TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_reviews_menu_item_status_created
  ON reviews (menu_item_slug, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_status_created
  ON reviews (status, created_at DESC);
