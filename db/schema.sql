-- true-fit schema (Postgres: Tiger Data, or Supabase). Applied by `yarn db:migrate`.
-- The database is the source of truth: the app reads every row from it, with no local copy.
-- `yarn db:dump` snapshots it to JSON, and `yarn db:migrate --from <dir>` loads a snapshot
-- back (replacing table contents). All people and companies are synthetic.
--
-- Row-level security is on for every table with no policies, so the publishable
-- (anon) key gets nothing through Supabase's REST/GraphQL APIs. Only the server reads
-- the data, over a direct Postgres connection (lib/db.ts).

-- ── ESCO subset ────────────────────────────────────────────────────────────

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
  alt_labels  text[] NOT NULL DEFAULT '{}',
  position    int
);

CREATE TABLE IF NOT EXISTS esco_skill_relations (
  skill_id   text NOT NULL REFERENCES esco_skills (id) ON DELETE CASCADE,
  related_id text NOT NULL REFERENCES esco_skills (id) ON DELETE CASCADE,
  weight     real NOT NULL,
  position   int,
  PRIMARY KEY (skill_id, related_id)
);

CREATE TABLE IF NOT EXISTS esco_occupations (
  id           text PRIMARY KEY,
  uri          text NOT NULL,
  label        text NOT NULL,
  isco         text,
  labels       jsonb NOT NULL DEFAULT '{}', -- { en, fi, sv, … }
  alt_labels   jsonb NOT NULL DEFAULT '{}', -- { en: [...], fi: [...] }
  extra_titles text[] NOT NULL DEFAULT '{}',
  fi_title     text,                         -- everyday Finnish title when ESCO's is awkward
  position     int
);

CREATE TABLE IF NOT EXISTS esco_occupation_skills (
  occupation_id text NOT NULL REFERENCES esco_occupations (id) ON DELETE CASCADE,
  skill_id      text NOT NULL REFERENCES esco_skills (id) ON DELETE CASCADE,
  position      int  NOT NULL,
  PRIMARY KEY (occupation_id, skill_id)
);

-- Columns added after the first release, for databases created before them.
ALTER TABLE esco_skills          ADD COLUMN IF NOT EXISTS position int;
ALTER TABLE esco_skill_relations ADD COLUMN IF NOT EXISTS position int;
ALTER TABLE esco_occupations     ADD COLUMN IF NOT EXISTS fi_title text;
ALTER TABLE esco_occupations     ADD COLUMN IF NOT EXISTS position int;

-- ── Synthetic seeds ────────────────────────────────────────────────────────
-- `position` keeps the authored order (the UI lists rows in it).

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

-- Mock personal info (synthetic), kept apart from the profile: only shown to a company
-- after both sides opt in, never read by matching and never sent to the AI.
CREATE TABLE IF NOT EXISTS talent_contact (
  talent_id text PRIMARY KEY REFERENCES talent (id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email     text NOT NULL CHECK (email LIKE '%@example.com'),
  phone     text NOT NULL,
  city      text NOT NULL
);

-- ── Scraped public data (yarn scrape, research only) ───────────────────────

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

-- ── Demo pipeline state (written by the app at runtime) ──────────────────────
-- Everything people do in the demo: the organiser's decisions, requests and yeses, Espoo
-- interviews, company interviews, offers, feedback, the audit log and the cards they create.
-- Synthetic data only. `yarn db:migrate` creates these tables and never empties them.

CREATE TABLE IF NOT EXISTS pipeline_pairs (
  pair_key       text PRIMARY KEY,                -- "<need id>::<talent id>"
  need_id        text NOT NULL,
  talent_id      text NOT NULL,
  decision       jsonb,                           -- organiser: invited to Espoo interview / not now, with reason
  opt_in         jsonb,                           -- { company?: bool, talent?: bool }
  screening      jsonb,                           -- Espoo interview: answer, slot, result, reason
  interview_slot text,                            -- company interview time
  offer          jsonb,                           -- job offer and the candidate's answer
  feedback       jsonb,                           -- both sides' feedback after the interview
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pipeline_pairs_talent ON pipeline_pairs (talent_id);
CREATE INDEX IF NOT EXISTS pipeline_pairs_need ON pipeline_pairs (need_id);

CREATE TABLE IF NOT EXISTS pipeline_audit (
  id          text PRIMARY KEY,
  at          timestamptz NOT NULL,
  actor       text NOT NULL,
  action      text NOT NULL,
  need_id     text NOT NULL,
  talent_id   text NOT NULL,
  from_status text NOT NULL,
  to_status   text NOT NULL,
  reason      text NOT NULL,
  note        text
);

CREATE TABLE IF NOT EXISTS demo_cards (
  id         text PRIMARY KEY,
  kind       text NOT NULL CHECK (kind IN ('need', 'talent')),
  data       jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Job seekers who signed up in the app (mock sign-in: name + email, no password). Each
-- gets their own id, so many people can build profiles at once without touching anyone
-- else's. A demo reset keeps these accounts and their profiles.
CREATE TABLE IF NOT EXISTS job_seeker_accounts (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  email      text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Companies that signed up in the app (same mock sign-in). Each posts its own roles; the
-- demo companies in the seed are view-only.
CREATE TABLE IF NOT EXISTS company_accounts (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  email      text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Each job seeker's own profile as they build it (background, answers, CV import,
-- contact details), autosaved per signed-in account by app/api/talent/profile so it is
-- there when they come back. The finished card is published to demo_cards when they join.
CREATE TABLE IF NOT EXISTS candidate_profiles (
  talent_id  text PRIMARY KEY,
  draft      jsonb NOT NULL,
  joined     boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS demo_state_meta (
  id      int PRIMARY KEY CHECK (id = 1),
  version bigint NOT NULL DEFAULT 0
);

INSERT INTO demo_state_meta (id, version) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;

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
ALTER TABLE talent_contact         ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraped_sources        ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraped_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_pairs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_audit         ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_cards             ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_seeker_accounts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_accounts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_state_meta        ENABLE ROW LEVEL SECURITY;
