-- Sections of a test or full simulation. Times are milliseconds; started_ms and ended_ms
-- are UTC milliseconds since 1970, because a simulation's clock keeps running while the app
-- is closed.
CREATE TABLE exam_sections (
  session_id TEXT NOT NULL REFERENCES practice_sessions (id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK (position >= 0),
  section TEXT NOT NULL CHECK (section IN ('logical_reasoning', 'reading_comprehension')),
  time_limit_ms INTEGER NOT NULL CHECK (time_limit_ms > 0),
  break_after_ms INTEGER NOT NULL DEFAULT 0 CHECK (break_after_ms >= 0),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'done')),
  elapsed_ms INTEGER NOT NULL DEFAULT 0 CHECK (elapsed_ms >= 0),
  started_ms INTEGER,
  ended_ms INTEGER,
  PRIMARY KEY (session_id, position)
) STRICT;

-- Null outside exams.
ALTER TABLE session_questions ADD COLUMN exam_section INTEGER;
ALTER TABLE session_questions ADD COLUMN is_scored INTEGER NOT NULL DEFAULT 1 CHECK (is_scored IN (0, 1));
