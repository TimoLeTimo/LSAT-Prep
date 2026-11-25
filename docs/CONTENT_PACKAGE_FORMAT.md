# Content Package Format — Schema Version 1

A package is one UTF-8 JSON file. The validator in `src/domain/content/validatePackage.ts`
enforces these rules; its types are in `types.ts` and its limits in `limits.ts`.

The version of this format is separate from the SQLite schema version. A change that
alters the meaning of existing fields needs a new `schema_version`.

## General rules
- Every field shown below is required. Use `null` only where stated.
- Unknown fields are rejected, so spelling mistakes are not silently ignored.
- If anything is invalid, the whole package is rejected. Nothing is partially imported.
- All text is plain text. HTML tags, control characters, and hidden direction characters are
  rejected. The app must still display package text as text, never as HTML.
- IDs use lowercase letters and numbers, separated by single hyphens or underscores.
- IDs must be unique within their own list (categories, passages, or questions).

## Top level
| Field | Rule |
|---|---|
| `format` | `"lsat-prep-package"` |
| `schema_version` | `1` |
| `package_id` | ID that stays the same across versions of the package |
| `package_version` | Three numbers, such as `"1.0.0"` |
| `display_name` | Name shown to the user |
| `created_at` | UTC date and time, such as `"2026-11-24T12:00:00Z"` |
| `categories` | List; may be empty. Only needed for categories the app does not have |
| `passages` | List; may be empty |
| `questions` | List with at least one question |

## Category
`id`, `section`, `name`, `description` (may be empty), and `sort_order` (whole number).
`section` is `logical_reasoning` or `reading_comprehension`. A category cannot change sections.
The app's starting categories are in `src/domain/content/categories.ts`.

## Passage
| Field | Rule |
|---|---|
| `id`, `title` | Required |
| `passage_type` | `single` or `comparative` |
| `texts` | One `{"label": "A", "text": "..."}` for single; A then B for comparative |
| `content_version` | Whole number, 1 or more |
| `status` | `approved` |
| `provenance` | See below |

A passage with no questions produces a warning, not an error.

## Question
| Field | Rule |
|---|---|
| `id` | Required |
| `section` | `logical_reasoning` or `reading_comprehension` |
| `primary_category` | A category in this package or in the app, from the same section |
| `secondary_tags` | List of IDs; may be empty; no repeats |
| `difficulty` | 1, 2, 3, or 4 |
| `stimulus` | LR: the argument or statements. RC: `null` |
| `prompt` | The question being asked |
| `choices` | Exactly five `{"label", "text"}` items, A through E in order, all different |
| `correct_choice` | One of A–E |
| `explanations` | Non-empty text for each of A–E |
| `estimated_time_seconds` | Whole number from 10 to 1800, or `null` |
| `passage_id` | RC: a passage in this package or an approved one in the app. LR: `null` |
| `content_version` | Whole number, 1 or more |
| `provenance` | See below |
| `quality` | `draft_status` is `approved`; `independent_solve`, `ambiguity_review`, and `human_review` are `passed`; `reviewer_notes` may be empty |

A choice's stable database ID is its question ID, a colon, and its label, such as `lr-000001:C`.

## Provenance
| Field | Rule |
|---|---|
| `origin` | `original_human_written`, `original_ai_assisted_human_reviewed`, or `licensed` |
| `source_material_used` | Non-empty description |
| `authoring_batch` | Non-empty batch name |
| `license_reference` | Required when `origin` is `licensed`; otherwise `null` |

The app can check that approval fields are filled in. It cannot check that a review really
happened or that content is original. Those remain human responsibilities.

## Limits
| Item | Limit |
|---|---|
| File | 20 MB |
| Categories / passages / questions | 200 / 500 / 2,000 |
| Tags per question | 20 |
| ID / short text | 100 / 200 characters |
| Stimulus / prompt | 5,000 / 2,000 characters |
| Choice / explanation | 1,000 / 4,000 characters |
| Each passage text | 12,000 characters |
| Notes, descriptions, sources, licenses | 4,000 characters |
| Errors listed | First 500, plus a total count |

## Known limitation
If one JSON object repeats the same field name, standard JSON parsing keeps the last value.
The validator cannot detect the earlier one.
