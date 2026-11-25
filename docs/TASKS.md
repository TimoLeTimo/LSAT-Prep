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
- [ ] Add Settings → Question Bank Management.
- [ ] Add Import Questions local file picker.
- [ ] Build validation feedback and package preview.
- [ ] Detect duplicate package versions and content IDs.
- [ ] Require confirmation; import approved questions only.
- [ ] Implement atomic SQLite import transaction and rollback tests.
- [ ] Add content package registry and import history.
- [ ] Verify imports do not change attempts, bookmarks, sessions, or statistics.
- [ ] Create small original seed question set.

## Milestone 3 — Logical Reasoning
- [ ] Question display.
- [ ] Answer selection.
- [ ] Next/previous navigation.
- [ ] Timer.
- [ ] Bookmarking.
- [ ] Explanations.
- [ ] Autosave and session recovery.

## Milestone 4 — Reading Comprehension
- [ ] Passage display.
- [ ] Passage-question association.
- [ ] Comparative passages.
- [ ] Question navigation.
- [ ] Autosave and timing.

## Milestone 5 — Custom Practice
- [ ] Section selection.
- [ ] Question count.
- [ ] Difficulty filters.
- [ ] Category filters.
- [ ] Timed/untimed/custom time.
- [ ] Explanation timing.
- [ ] Question subset filters.
- [ ] Randomization.
- [ ] Saved templates.
- [ ] Availability validation.

## Milestone 6 — Practice tests
- [ ] Custom section tests.
- [ ] Full exam configuration.
- [ ] Section timers.
- [ ] Flagging and navigation.
- [ ] Break handling.
- [ ] Results screen.
- [ ] Post-test review.
- [ ] Verify current LSAC structure before release.

## Milestone 7 — Review and statistics
- [ ] Incorrect question review.
- [ ] Bookmark review.
- [ ] Retry workflow.
- [ ] Summary statistics.
- [ ] LR/RC comparison.
- [ ] Category/difficulty breakdown.
- [ ] Historical trends.
- [ ] Practice test history.

## Milestone 8 — Reliability
- [ ] Offline test.
- [ ] Restart/recovery test.
- [ ] Timer suspension test.
- [ ] Backup/export.
- [ ] Restore test.
- [ ] Migration test.
- [ ] Keyboard/accessibility check.

## Milestone 9 — Mac delivery
- [ ] App icon and metadata.
- [ ] Build on macOS.
- [ ] Test on recipient's Mac.
- [ ] Confirm architecture compatibility.
- [ ] Sign/notarize if distributing outside App Store.
- [ ] Verify offline operation after install.
