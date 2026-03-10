CREATE TABLE authors (
  author_id INTEGER PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  display_name TEXT,
  profile_url TEXT,
  avatar_url TEXT,
  is_verified INTEGER,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE tweets (
  tweet_id TEXT PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES authors(author_id),
  tweet_url TEXT NOT NULL,
  created_at TEXT,
  captured_at TEXT NOT NULL,
  body_text TEXT,
  reply_count TEXT,
  repost_count TEXT,
  like_count TEXT,
  bookmark_count TEXT,
  view_count TEXT,
  raw_html_path TEXT,
  raw_json_path TEXT
);

CREATE TABLE media_assets (
  media_id INTEGER PRIMARY KEY,
  canonical_source_url TEXT NOT NULL UNIQUE,
  media_kind TEXT NOT NULL,
  sha256 TEXT,
  local_path TEXT,
  preview_path TEXT,
  width INTEGER,
  height INTEGER,
  duration_ms INTEGER,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE tweet_media_usages (
  usage_id INTEGER PRIMARY KEY,
  tweet_id TEXT NOT NULL REFERENCES tweets(tweet_id),
  media_id INTEGER NOT NULL REFERENCES media_assets(media_id),
  position_index INTEGER NOT NULL,
  role_in_tweet TEXT,
  pairing_text TEXT,
  pairing_text_summary TEXT,
  usage_notes TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(tweet_id, media_id, position_index)
);

CREATE TABLE media_usage_analysis (
  analysis_id INTEGER PRIMARY KEY,
  usage_id INTEGER NOT NULL REFERENCES tweet_media_usages(usage_id),
  analyzer TEXT NOT NULL,
  analyzer_version TEXT,
  caption TEXT,
  ocr_text TEXT,
  entities_json TEXT,
  scene_description TEXT,
  conveys TEXT,
  user_intent TEXT,
  rhetorical_role TEXT,
  metaphor TEXT,
  humor_mechanism TEXT,
  emotional_tone TEXT,
  cultural_reference TEXT,
  safety_notes TEXT,
  embedding_ref TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE media_asset_summary (
  media_id INTEGER PRIMARY KEY REFERENCES media_assets(media_id),
  usage_count INTEGER NOT NULL DEFAULT 0,
  unique_author_count INTEGER NOT NULL DEFAULT 0,
  canonical_caption TEXT,
  aggregate_scene_description TEXT,
  aggregate_conveys TEXT,
  aggregate_user_intent TEXT,
  aggregate_rhetorical_role TEXT,
  aggregate_metaphor TEXT,
  aggregate_emotional_tone TEXT,
  aggregate_usage_patterns TEXT,
  representative_tweet_id TEXT REFERENCES tweets(tweet_id),
  last_summarized_at TEXT
);

CREATE TABLE retrieval_chunks (
  chunk_id INTEGER PRIMARY KEY,
  owner_type TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding_ref TEXT,
  created_at TEXT NOT NULL
);
