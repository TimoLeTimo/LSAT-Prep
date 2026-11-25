# Database Schema — Initial Design

This is a conceptual schema for planning. Final SQL should be written only after the entities and workflows are reviewed. Use migrations from the beginning.

## 1. Core content tables

### `questions`
- `id` — stable text/UUID primary key.
- `section` — `logical_reasoning` or `reading_comprehension`.
- `category_id` — category reference.
- `difficulty` — controlled value.
- `prompt` — question stem.
- `correct_choice_id` — correct answer identifier.
- `estimated_seconds` — optional estimate.
- `passage_id` — nullable reference for RC.
- `content_version` — version identifier.
- `status` — draft, reviewed, approved, retired.
- `created_at`, `updated_at`.

### `answer_choices`
- `id` — stable ID.
- `question_id` — question reference.
- `choice_label` — A–E.
- `choice_text`.
- `explanation` — why this choice is right/wrong.
- `display_order`.

### `passages`
- `id`.
- `title` or short internal label.
- `passage_text`.
- `passage_type` — single or comparative/group.
- `content_version`.
- `status`.

### `question_categories`
- `id`.
- `section`.
- `name`.
- `description` (internal metadata, not a lesson).
- `sort_order`.
- `active`.

## 2. User activity tables

### `practice_sessions`
- `id`.
- `session_type` — targeted, custom, test, full_simulation, review.
- `configuration_json` — frozen configuration used to create the session.
- `status` — in_progress, completed, abandoned.
- `started_at`, `completed_at`.
- `time_limit_seconds` — nullable.
- `created_at`.

### `session_questions`
- `id`.
- `session_id`.
- `question_id`.
- `display_order`.
- `selected_choice_id` — nullable.
- `is_flagged`.
- `answered_at`.
- `time_spent_seconds`.
- `question_content_snapshot` or content version reference, to preserve the exact content shown during the attempt.

### `attempts`
Use a durable attempt record for each submitted answer/retry. Fields:
- `id`.
- `session_id`.
- `question_id`.
- `selected_choice_id`.
- `is_correct`.
- `time_spent_seconds`.
- `attempted_at`.
- `attempt_kind` — original, retry, review.

Do not treat opening a question as an answered attempt. Define whether answer changes create one final attempt or a separate event history; keep the initial implementation simple and documented.

### `bookmarks`
- `id`.
- `question_id`.
- `created_at`.
- Optional note field.

### `saved_practice_templates`
- `id`.
- `name`.
- `configuration_json`.
- `created_at`, `updated_at`.

### `app_settings`
- key/value or typed settings table.
- Include preferences such as appearance, default timing mode, and explanation behavior.

### `content_packages`
- `package_id` — stable package identifier from the JSON manifest.
- `package_version` — package release/version string.
- `schema_version` — package-format version.
- `display_name` — human-readable package name.
- `imported_at` — timestamp of successful import.
- `content_hash` — optional hash of the package bytes for audit/deduplication.
- Unique constraint on (`package_id`, `package_version`).

### `content_import_history`
- `id` — stable import-event ID.
- `package_id`, `package_version`, `schema_version`.
- `display_name`.
- `attempted_at`.
- `status` — `succeeded`, `rejected_validation`, or `failed_rollback`.
- Counts: questions/passage/category items added and duplicates skipped, where applicable.
- `summary` — concise user-readable result; optionally retain structured validation details.

Record successful package imports in `content_packages`; record attempted imports in `content_import_history`. A failed validation or rolled-back write must not create partial content rows. Import history itself may record the failed attempt after rollback.


## 3. Statistics
Prefer deriving statistics from durable attempts and sessions rather than maintaining many duplicate counters. If performance requires cached aggregates later, they must be rebuildable from source records.

Document calculations:
- Questions answered = submitted answer attempts under the chosen counting rule.
- Accuracy = correct final answers / answered questions.
- Average time = total measured question time / questions with valid time measurements.
- Practice time = elapsed active session time, with clear handling of pauses and app suspension.
- Avoid counting repeated retries as separate unique questions in a metric labelled “unique questions completed.”

## 4. Data integrity
- Foreign keys enabled.
- Transactions for answer saves and session state updates.
- Stable IDs for content.
- Index common filters: section, category, difficulty, passage, session, attempt date.
- Schema migrations with backup and rollback strategy where feasible.
- Do not cascade-delete historical attempts when a content item is retired.
- Test restore on a clean database.

## 5. Content package
A content package should include:
- Package ID and version.
- Schema version.
- Questions.
- Answer choices and explanations.
- Passages.
- Categories/tags.
- Review metadata.

The package manifest should contain at least:
- `package_id`, `package_version`, `display_name`, `schema_version`, and creation metadata.
- Content arrays for categories/tags, passages, and questions.
- Provenance and QA/review metadata for each question.

Import eligibility and validation rules:
- Only `approved` questions are eligible for the active question bank. Draft/review-only items must be rejected or explicitly excluded with a clear preview; they must never become practice-eligible.
- Every imported question must have a stable unique ID, valid section/category, supported difficulty, prompt, exactly five uniquely identified choices, exactly one correct choice that references one of those choices, and a non-empty explanation for every choice.
- Every RC question must reference an existing passage in the same package or a valid already-imported passage. Comparative sets must preserve all required passage relationships.
- Reject duplicate IDs within the package. Compare package ID/version and item IDs against the local database before confirmation.
- Normal import is additive only. Never update or overwrite existing content, attempts, bookmarks, saved templates, statistics, or settings. Do not delete content.
- Parse and validate the entire package before writing. Then perform all content writes and the successful package record in a single transaction. On any write error, roll back all content writes. Record the failed attempt separately after rollback.
- Revalidate at import time to guard against changes between preview and confirmation.
- Enforce file-size and field-length limits, reject unsupported schema versions, and treat all package text as untrusted data. Do not execute scripts, HTML, or other embedded active content.


Validate IDs, references, answer count, correct-answer existence, passage links, and required explanations before importing.
