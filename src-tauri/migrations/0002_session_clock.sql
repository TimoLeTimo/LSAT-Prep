-- Time the session clock has run, not counting pauses.
ALTER TABLE practice_sessions ADD COLUMN active_ms INTEGER NOT NULL DEFAULT 0 CHECK (active_ms >= 0);
