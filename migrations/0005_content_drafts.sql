CREATE TABLE IF NOT EXISTS site_content_drafts (
  id TEXT PRIMARY KEY,
  page TEXT NOT NULL,
  field TEXT NOT NULL,
  content TEXT,
  hero_title TEXT,
  hero_subtitle TEXT,
  hero_video_url TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE(page, field)
);
