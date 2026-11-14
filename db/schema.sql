-- true-fit schema for Supabase (Postgres). Loaded by `yarn db:migrate` / `yarn db:sql`.
-- The JSON files in data/ stay the source of truth: the migration replaces table
-- contents from them on every run. All people and companies are synthetic.
--
-- Row-level security is on for every table with no policies, so the publishable
-- (anon) key gets nothing through Supabase's REST/GraphQL APIs. Only the server reads
-- the data, over a direct Postgres connection (lib/db.ts).

-- ── ESCO subset (data/esco) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS esco_meta (
  dataset    text PRIMARY KEY,           -- 'skills' | 'occupations'
  source     text,
  licence    text,
  retrieved  text
);

CREATE TABLE IF NOT EXISTS esco_skills (
  id          text PRIMARY KEY,
  label       text NOT NULL,
  skill_group text NOT NULL,
  uri         text,
  match       text,                       -- how the local skill maps to ESCO: exact | close | …
  esco_label  text,
  keywords    text[] NOT NULL DEFAULT '{}',
  labels      jsonb NOT NULL DEFAULT '{}', -- { fi, sv, … }
  alt_labels  text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS esco_skill_relations (
  skill_id   text NOT NULL REFERENCES esco_skills (id) ON DELETE CASCADE,
  related_id text NOT NULL REFERENCES esco_skills (id) ON DELETE CASCADE,
  weight     real NOT NULL,
  PRIMARY KEY (skill_id, related_id)
);

CREATE TABLE IF NOT EXISTS esco_occupations (
  id           text PRIMARY KEY,
  uri          text NOT NULL,
  label        text NOT NULL,
  isco         text,
  labels       jsonb NOT NULL DEFAULT '{}', -- { en, fi, sv, … }
  alt_labels   jsonb NOT NULL DEFAULT '{}', -- { en: [...], fi: [...] }
  extra_titles text[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS esco_occupation_skills (
  occupation_id text NOT NULL REFERENCES esco_occupations (id) ON DELETE CASCADE,
  skill_id      text NOT NULL REFERENCES esco_skills (id) ON DELETE CASCADE,
  position      int  NOT NULL,
  PRIMARY KEY (occupation_id, skill_id)
);

-- ── Synthetic seeds (data/seed) ─────────────────────────────────────────────
-- `position` keeps the seed files' order, so reads match the JSON exactly.

CREATE TABLE IF NOT EXISTS companies (
  id       text PRIMARY KEY,
  name     text NOT NULL,
  blurb    text,
  sector   text,
  location text,
  position int
);

CREATE TABLE IF NOT EXISTS needs (
  id                     text PRIMARY KEY,
  company_id             text NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  title                  text NOT NULL,
  occupation_id          text REFERENCES esco_occupations (id),
  summary                text,
  language               text NOT NULL CHECK (language IN ('English OK', 'Finnish required', 'Finnish or English')),
  mode                   text NOT NULL CHECK (mode IN ('On-site', 'Hybrid', 'Remote')),
  submitted_weeks_before int,
  position               int
);

CREATE TABLE IF NOT EXISTS need_skills (
  need_id  text NOT NULL REFERENCES needs (id) ON DELETE CASCADE,
  skill_id text NOT NULL REFERENCES esco_skills (id),
  kind     text NOT NULL CHECK (kind IN ('must', 'nice')),
  position int  NOT NULL,
  PRIMARY KEY (need_id, skill_id)
);

CREATE TABLE IF NOT EXISTS talent (
  id             text PRIMARY KEY,
  reveal_name    text NOT NULL,           -- only shown after mutual opt-in
  headline       text,
  previous_field text,
  availability   text,
  mode           text NOT NULL CHECK (mode IN ('On-site', 'Hybrid', 'Remote', 'Any')),
  position       int
);

CREATE TABLE IF NOT EXISTS talent_skills (
  talent_id text NOT NULL REFERENCES talent (id) ON DELETE CASCADE,
  skill_id  text NOT NULL REFERENCES esco_skills (id),
  level     text NOT NULL CHECK (level IN ('evidenced', 'claimed')),
  position  int  NOT NULL,
  PRIMARY KEY (talent_id, skill_id)
);

CREATE TABLE IF NOT EXISTS talent_evidence (
  talent_id text NOT NULL REFERENCES talent (id) ON DELETE CASCADE,
  position  int  NOT NULL,
  kind      text NOT NULL CHECK (kind IN ('scenario', 'voice', 'sample')),
  prompt    text,
  excerpt   text,
  skills    text[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (talent_id, position)
);

CREATE TABLE IF NOT EXISTS talent_languages (
  talent_id text NOT NULL REFERENCES talent (id) ON DELETE CASCADE,
  lang      text NOT NULL,
  level     text NOT NULL CHECK (level IN ('Native', 'Fluent', 'Working', 'Learning')),
  position  int,
  PRIMARY KEY (talent_id, lang)
);

-- Protected attributes, kept apart from the profile: aggregate fairness checks only,
-- never read by matching.
CREATE TABLE IF NOT EXISTS talent_audit (
  talent_id text PRIMARY KEY REFERENCES talent (id) ON DELETE CASCADE,
  origin    text NOT NULL CHECK (origin IN ('Finland', 'EU/EEA', 'Outside EU')),
  education text NOT NULL CHECK (education IN ('University', 'Vocational', 'Self-taught / bootcamp')),
  path      text NOT NULL CHECK (path IN ('Linear', 'Career changer'))
);

-- ── Scraped public data (data/scraped, research only) ───────────────────────

CREATE TABLE IF NOT EXISTS scraped_sources (
  source    text PRIMARY KEY,
  title     text,
  origin    text,
  kind      text,
  notes     text,
  status    text,
  retrieved timestamptz,
  count     int,
  failed    int,
  extra     jsonb
);

CREATE TABLE IF NOT EXISTS scraped_items (
  source  text NOT NULL REFERENCES scraped_sources (source) ON DELETE CASCADE,
  item_id text NOT NULL,                  -- the source's id, or the page URL
  url     text,
  title   text,
  data    jsonb NOT NULL,
  PRIMARY KEY (source, item_id)
);

CREATE INDEX IF NOT EXISTS scraped_items_data_gin ON scraped_items USING gin (data jsonb_path_ops);

-- ── Lock the tables away from the public API ────────────────────────────────

ALTER TABLE esco_meta              ENABLE ROW LEVEL SECURITY;
ALTER TABLE esco_skills            ENABLE ROW LEVEL SECURITY;
ALTER TABLE esco_skill_relations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE esco_occupations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE esco_occupation_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies              ENABLE ROW LEVEL SECURITY;
ALTER TABLE needs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE need_skills            ENABLE ROW LEVEL SECURITY;
ALTER TABLE talent                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE talent_skills          ENABLE ROW LEVEL SECURITY;
ALTER TABLE talent_evidence        ENABLE ROW LEVEL SECURITY;
ALTER TABLE talent_languages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE talent_audit           ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraped_sources        ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraped_items          ENABLE ROW LEVEL SECURITY;
