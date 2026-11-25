# Task Tracker

Update this file as milestones are completed. Keep tasks small enough to verify.

## Milestone 0 — Environment and skeleton
- [ ] Inspect workspace for existing files before edits.
- [ ] Confirm Linux distribution, version, and CPU architecture.
- [ ] Confirm Node.js/npm versions and check Rust/Cargo plus Tauri prerequisites.
- [ ] Confirm VS Code/Claude availability; install/configure only with approval.
- [ ] Review and approve machine-specific dependency installation plan.
- [ ] Initialize React + TypeScript + Vite.
- [ ] Add Tailwind using the current supported Vite integration.
- [ ] Add project README and .gitignore.
- [ ] Run starter app locally and verify it in browser.
- [ ] Review staged files for secrets/build artifacts.
- [ ] Create Git repository and first commit after user review.
- [ ] Record exact setup/run commands in README.

## Milestone 1 — Visual shell
- [ ] Define pink/rose design tokens.
- [ ] Build app shell.
- [ ] Build main menu with six navigation tiles.
- [ ] Add placeholder screens and navigation.
- [ ] Add settings entry point.
- [ ] Check resizing and accessibility.

## Milestone 2 — Content and persistence
- [ ] Define domain types.
- [ ] Finalize database schema.
- [ ] Add SQLite access layer.
- [ ] Create content package format.
- [ ] Define/version the JSON content-package contract.
- [ ] Implement package parser and side-effect-free validation.
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
- [ ] Add Tauri desktop shell.
- [ ] App icon and metadata.
- [ ] Build on macOS.
- [ ] Test on recipient's Mac.
- [ ] Confirm architecture compatibility.
- [ ] Sign/notarize if distributing outside App Store.
- [ ] Verify offline operation after install.
