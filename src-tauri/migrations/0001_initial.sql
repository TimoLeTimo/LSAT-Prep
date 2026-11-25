-- Version 1. Never edit this file after release; add a new numbered migration instead.
-- Timestamps are UTC text such as 2026-11-24T12:00:00.000Z.

---------------------------------------------------------------- Content

CREATE TABLE question_categories (
  id TEXT PRIMARY KEY,
  section TEXT NOT NULL CHECK (section IN ('logical_reasoning', 'reading_comprehension')),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  UNIQUE (id, section)
) STRICT;

CREATE TABLE content_packages (
  package_id TEXT NOT NULL,
  package_version TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  content_hash TEXT,
  PRIMARY KEY (package_id, package_version)
) STRICT;

CREATE TABLE passages (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  passage_type TEXT NOT NULL CHECK (passage_type IN ('single', 'comparative')),
  content_version INTEGER NOT NULL CHECK (content_version >= 1),
  status TEXT NOT NULL CHECK (status IN ('draft', 'reviewed', 'approved', 'retired')),
  provenance_json TEXT NOT NULL CHECK (json_valid(provenance_json)),
  package_id TEXT NOT NULL,
  package_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (package_id, package_version)
    REFERENCES content_packages (package_id, package_version) ON DELETE RESTRICT
) STRICT;

CREATE TABLE passage_texts (
  passage_id TEXT NOT NULL REFERENCES passages (id) ON DELETE RESTRICT,
  label TEXT NOT NULL CHECK (label IN ('A', 'B')),
  text TEXT NOT NULL,
  PRIMARY KEY (passage_id, label)
) STRICT;

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  section TEXT NOT NULL,
  category_id TEXT NOT NULL,
  difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 4),
  stimulus TEXT,
  prompt TEXT NOT NULL,
  correct_choice_id TEXT NOT NULL,
  estimated_seconds INTEGER CHECK (estimated_seconds > 0),
  passage_id TEXT REFERENCES passages (id) ON DELETE RESTRICT,
  content_version INTEGER NOT NULL CHECK (content_version >= 1),
  status TEXT NOT NULL CHECK (status IN ('draft', 'reviewed', 'approved', 'retired')),
  provenance_json TEXT NOT NULL CHECK (json_valid(provenance_json)),
  quality_json TEXT NOT NULL CHECK (json_valid(quality_json)),
  package_id TEXT NOT NULL,
  package_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  -- LR has a stimulus and no passage; RC has a passage and no stimulus.
  CHECK (
    (section = 'logical_reasoning' AND stimulus IS NOT NULL AND passage_id IS NULL)
    OR (section = 'reading_comprehension' AND stimulus IS NULL AND passage_id IS NOT NULL)
  ),
  -- The category must belong to the same section.
  FOREIGN KEY (category_id, section)
    REFERENCES question_categories (id, section) ON DELETE RESTRICT,
  -- The correct choice must belong to this question. Checked at commit, because the
  -- question and its choices refer to each other.
  FOREIGN KEY (id, correct_choice_id)
    REFERENCES answer_choices (question_id, id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (package_id, package_version)
    REFERENCES content_packages (package_id, package_version) ON DELETE RESTRICT
) STRICT;

CREATE TABLE answer_choices (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions (id) ON DELETE RESTRICT,
  choice_label TEXT NOT NULL CHECK (choice_label IN ('A', 'B', 'C', 'D', 'E')),
  choice_text TEXT NOT NULL,
  explanation TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  UNIQUE (question_id, id),
  UNIQUE (question_id, choice_label)
) STRICT;

CREATE TABLE question_tags (
  question_id TEXT NOT NULL REFERENCES questions (id) ON DELETE RESTRICT,
  tag TEXT NOT NULL,
  PRIMARY KEY (question_id, tag)
) STRICT;

-- No link to content_packages: rejected files are recorded here too.
CREATE TABLE content_import_history (
  id TEXT PRIMARY KEY,
  package_id TEXT,
  package_version TEXT,
  schema_version INTEGER,
  display_name TEXT,
  attempted_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'rejected_validation', 'failed_rollback')),
  questions_added INTEGER NOT NULL DEFAULT 0,
  passages_added INTEGER NOT NULL DEFAULT 0,
  categories_added INTEGER NOT NULL DEFAULT 0,
  duplicates_skipped INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL,
  details_json TEXT CHECK (details_json IS NULL OR json_valid(details_json))
) STRICT;

---------------------------------------------------------------- User activity

CREATE TABLE practice_sessions (
  id TEXT PRIMARY KEY,
  session_type TEXT NOT NULL
    CHECK (session_type IN ('targeted', 'custom', 'test', 'full_simulation', 'review')),
  configuration_json TEXT NOT NULL CHECK (json_valid(configuration_json)),
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  current_position INTEGER NOT NULL DEFAULT 0,
  time_limit_seconds INTEGER CHECK (time_limit_seconds > 0),
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE session_questions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES practice_sessions (id) ON DELETE RESTRICT,
  question_id TEXT NOT NULL REFERENCES questions (id) ON DELETE RESTRICT,
  display_order INTEGER NOT NULL,
  selected_choice_id TEXT,
  is_flagged INTEGER NOT NULL DEFAULT 0 CHECK (is_flagged IN (0, 1)),
  answered_at TEXT,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0 CHECK (time_spent_seconds >= 0),
  -- Full copy of the question, choices, explanations, and passage as shown.
  content_snapshot_json TEXT NOT NULL CHECK (json_valid(content_snapshot_json)),
  UNIQUE (session_id, display_order),
  UNIQUE (id, session_id, question_id),
  FOREIGN KEY (question_id, selected_choice_id)
    REFERENCES answer_choices (question_id, id) ON DELETE RESTRICT
) STRICT;

-- One row per submitted answer. A retry belongs to its own session.
CREATE TABLE attempts (
  id TEXT PRIMARY KEY,
  session_question_id TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  selected_choice_id TEXT NOT NULL,
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  time_spent_seconds INTEGER CHECK (time_spent_seconds >= 0),
  attempted_at TEXT NOT NULL,
  attempt_kind TEXT NOT NULL CHECK (attempt_kind IN ('original', 'retry', 'review')),
  FOREIGN KEY (session_question_id, session_id, question_id)
    REFERENCES session_questions (id, session_id, question_id) ON DELETE RESTRICT,
  FOREIGN KEY (question_id, selected_choice_id)
    REFERENCES answer_choices (question_id, id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL UNIQUE REFERENCES questions (id) ON DELETE RESTRICT,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE saved_practice_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  configuration_json TEXT NOT NULL CHECK (json_valid(configuration_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL CHECK (json_valid(value_json)),
  updated_at TEXT NOT NULL
) STRICT;

---------------------------------------------------------------- History protection

CREATE TRIGGER attempts_are_permanent BEFORE UPDATE ON attempts
BEGIN
  SELECT RAISE(ABORT, 'submitted attempts cannot be changed');
END;

CREATE TRIGGER snapshots_are_permanent
BEFORE UPDATE OF id, session_id, question_id, content_snapshot_json ON session_questions
BEGIN
  SELECT RAISE(ABORT, 'a saved question copy cannot be changed');
END;

---------------------------------------------------------------- Indexes

CREATE INDEX questions_by_filter ON questions (status, section, category_id, difficulty);
CREATE INDEX questions_by_passage ON questions (passage_id);
CREATE INDEX questions_by_category ON questions (category_id, section);
CREATE INDEX session_questions_by_question ON session_questions (question_id);
CREATE INDEX attempts_by_question ON attempts (question_id);
CREATE INDEX attempts_by_session ON attempts (session_id);
CREATE INDEX attempts_by_date ON attempts (attempted_at);
CREATE INDEX sessions_by_status ON practice_sessions (status, created_at);

---------------------------------------------------------------- Starting categories
-- Must match src/domain/content/categories.ts. A test compares them.

INSERT INTO question_categories (id, section, name, sort_order) VALUES
  ('lr-identify-conclusion', 'logical_reasoning', 'Identify the conclusion', 10),
  ('lr-identify-premises', 'logical_reasoning', 'Identify premises / evidence', 20),
  ('lr-main-point', 'logical_reasoning', 'Main point', 30),
  ('lr-role-of-statement', 'logical_reasoning', 'Role of a statement', 40),
  ('lr-method-of-reasoning', 'logical_reasoning', 'Method of reasoning', 50),
  ('lr-strengthen', 'logical_reasoning', 'Strengthen', 60),
  ('lr-weaken', 'logical_reasoning', 'Weaken', 70),
  ('lr-necessary-assumption', 'logical_reasoning', 'Necessary assumption', 80),
  ('lr-sufficient-assumption', 'logical_reasoning', 'Sufficient assumption', 90),
  ('lr-flaw', 'logical_reasoning', 'Flaw', 100),
  ('lr-inference', 'logical_reasoning', 'Inference / must be true', 110),
  ('lr-resolve-explain', 'logical_reasoning', 'Resolve or explain', 120),
  ('lr-principle', 'logical_reasoning', 'Principle: application or justification', 130),
  ('lr-evaluate', 'logical_reasoning', 'Evaluate an argument', 140),
  ('lr-parallel-reasoning', 'logical_reasoning', 'Parallel reasoning', 150),
  ('lr-parallel-flaw', 'logical_reasoning', 'Parallel flaw', 160),
  ('rc-main-idea', 'reading_comprehension', 'Main idea / primary purpose', 10),
  ('rc-author-attitude', 'reading_comprehension', 'Author''s attitude or perspective', 20),
  ('rc-inference', 'reading_comprehension', 'Inference', 30),
  ('rc-detail', 'reading_comprehension', 'Detail / textual support', 40),
  ('rc-function', 'reading_comprehension', 'Function of a paragraph or sentence', 50),
  ('rc-structure', 'reading_comprehension', 'Passage organization / structure', 60),
  ('rc-meaning-in-context', 'reading_comprehension', 'Meaning in context', 70),
  ('rc-application', 'reading_comprehension', 'Application of a principle', 80),
  ('rc-implication', 'reading_comprehension', 'Implication', 90),
  ('rc-comparative-agreement', 'reading_comprehension', 'Comparative passage agreement / disagreement', 100),
  ('rc-argument-relationship', 'reading_comprehension', 'Relationship between authors'' arguments', 110),
  ('rc-author-response', 'reading_comprehension', 'How one author would respond to the other', 120);
