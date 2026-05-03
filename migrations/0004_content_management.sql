CREATE TABLE IF NOT EXISTS site_content (
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

-- Insert default demo content
INSERT OR IGNORE INTO site_content (id, page, field, content, hero_title, hero_subtitle, hero_video_url) VALUES
('home-hero', 'home', 'hero', NULL, 'Welcome to KIKUZUKI', 'Authentic Japanese Robatayaki Experience in Krabi', '/videos/hero-video.mp4'),
('about-hero', 'about', 'hero', NULL, 'About KIKUZUKI', 'Discover Our Story', NULL),
('about-story', 'about', 'story', '<p class="text-xl font-medium text-gray-900 border-l-4 border-black pl-6 py-2">Welcome to KIKUZUKI, where Japanese tradition meets tropical paradise.</p><p>Experience the art of robatayaki grilling and fresh sushi in the heart of Krabi.</p>', NULL, NULL, NULL),
('contact-hero', 'contact', 'hero', NULL, 'Contact Us', 'Get in Touch with KIKUZUKI', NULL),
('contact-intro', 'contact', 'intro', '<p>For an unparalleled Japanese culinary experience in Krabi, Kikuzuki beckons you to transcend the virtual and savor the exquisite reality.</p><p>Contact us to transform your online curiosity into a reservation.</p>', NULL, NULL, NULL),
('reservations-hero', 'reservations', 'hero', NULL, 'Reserve a Table', 'Book Your Authentic Japanese Experience', NULL);

CREATE TABLE IF NOT EXISTS staff_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  bio TEXT,
  image_url TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS awards_recognition (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  year INTEGER,
  issuer TEXT,
  image_url TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_order ON staff_profiles (order_index, active);
CREATE INDEX IF NOT EXISTS idx_awards_recognition_order ON awards_recognition (order_index, active);
