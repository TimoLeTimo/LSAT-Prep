# Task Tracker

Update this file as milestones are completed. Keep tasks small enough to verify.

## Milestone 0 — Environment and skeleton
- [x] Inspect workspace for existing files before edits.
- [x] Confirm Linux distribution, version, and CPU architecture.
- [x] Confirm Node.js/npm versions and check Rust/Cargo plus Tauri prerequisites.
- [x] Confirm VS Code/Claude availability; install/configure only with approval.
- [x] Review and approve machine-specific dependency installation plan.
- [x] Initialize React + TypeScript + Vite.
- [x] Add Tailwind using the current supported Vite integration.
- [x] Add project README and .gitignore.
- [x] Run starter app locally and verify it in browser.
- [x] Review staged files for secrets/build artifacts.
- [x] Create Git repository and first commit after user review.
- [x] Record exact setup/run commands in README.

## Milestone 1 — Visual shell
- [x] Define pink/rose design tokens.
- [x] Build app shell.
- [x] Build main menu with six navigation tiles.
- [x] Add placeholder screens and navigation.
- [x] Add settings entry point.
- [x] Check resizing and accessibility.

## Milestone 2 — Content and persistence
- [x] Add basic Tauri 2 desktop shell and verify it on Linux (moved from Milestone 9).
- [x] Define domain types.
- [x] Finalize database schema.
- [x] Add SQLite access layer.
- [x] Create content package format.
- [x] Define/version the JSON content-package contract.
- [x] Implement package parser and side-effect-free validation.
- [x] Add Settings → Question Bank Management.
- [x] Add Import Questions local file picker.
- [x] Build validation feedback and package preview.
- [x] Detect duplicate package versions and content IDs.
- [x] Require confirmation; import approved questions only.
- [x] Implement atomic SQLite import transaction and rollback tests.
- [x] Add content package registry and import history.
- [x] Verify imports do not change attempts, bookmarks, sessions, or statistics.
- [x] Add category and difficulty filters.
- [x] Create content QA checklist.
- [x] Confirm in the real window that re-importing a package is blocked and recorded.
- [x] Draft small original seed question set.
- [ ] Review, approve, and import the seed question set.

## Milestone 3 — Logical Reasoning
- [x] Try the practice screen in the real window (starting, answering, checking, and saving).
- [x] Session engine: start, save, recover, submit, finish, and end early (no screens yet).
- [x] Random question selection without repeats.
- [x] Question display.
- [x] Answer selection.
- [x] Next/previous navigation.
- [x] Timer.
- [x] Bookmarking.
- [x] Explanations.
- [x] Autosave and session recovery. (Resumed after closing the app; an abrupt quit is untested.)

## Milestone 4 — Reading Comprehension
- [x] Choose whole passage sets and start RC sessions.
- [x] Passage display.
- [x] Passage-question association.
- [x] Comparative passages.
- [x] Question navigation.
- [x] Autosave and timing.
- [x] Review with the passage visible.

## Milestone 5 — Custom Practice
- [x] Selection, subset, ordering, and answer-shuffling rules.
- [x] Section selection.
- [x] Question count.
- [x] Difficulty filters.
- [x] Category filters.
- [x] Timed/untimed/custom time.
- [x] Explanation timing.
- [x] Question subset filters.
- [x] Randomization.
- [x] Saved templates.
- [x] Availability validation.

## Milestone 6 — Practice tests
- [x] Exam formats as data, exam assembly, and the section engine.
- [x] Custom section tests.
- [x] Full exam configuration.
- [x] Section timers.
- [x] Flagging and navigation.
- [x] Break handling.
- [x] Results screen.
- [x] Post-test review.
- [ ] Verify current LSAC structure before release.

## Milestone 7 — Review and statistics
(Postponed, then resumed, on November 24, 2026.)
- [x] Calculations, retry rules, and records (no screens yet). Defined in STATISTICS.md.
- [x] Incorrect question review.
- [x] Bookmark review.
- [x] Retry workflow.
- [ ] Summary statistics.
- [ ] LR/RC comparison.
- [ ] Category/difficulty breakdown.
- [ ] Historical trends.
- [ ] Practice test history.

## Milestone 8 — Reliability
- [x] Offline test.
- [x] Restart/recovery test.
- [x] Timer suspension test. (The effect of a suspend, simulated in the real app; see RELIABILITY.md.)
- [x] Backup/export.
- [x] Restore test.
- [x] Migration test.
- [x] Keyboard/accessibility check. (A screen reader is untested.)

## Milestone 9 — Mac delivery
- [x] App icon and metadata.
- [x] Release build and package on Linux.
- [x] Mac build and test instructions (MAC_BUILD.md).
- [ ] Build on macOS. (Needs a Mac.)
- [ ] Test on recipient's Mac. (Needs a Mac.)
- [ ] Confirm architecture compatibility. (Needs a Mac.)
- [ ] Sign/notarize if distributing outside App Store. (Needs a Mac.)
- [ ] Verify offline operation after install. (Needs a Mac.)
