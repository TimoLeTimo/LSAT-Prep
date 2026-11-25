# Implementation Roadmap

Build one milestone at a time. Do not ask an AI coding assistant to generate the entire app in one prompt.

## Milestone 0 — Environment and project skeleton

Follow `START_HERE_FIRST_SESSION.md` and use its paste-ready Claude Code prompt.

1. Inspect the workspace and identify any existing files before changing anything.
2. Identify Linux distribution/version and CPU architecture.
3. Check installed versions of Git, Node.js/npm, Rust/Cargo, and distribution-specific Tauri prerequisites.
4. Present a machine-specific setup plan. Obtain approval before sudo/system package installation.
5. Initialize React + TypeScript + Vite using current supported tooling.
6. Add Tailwind using the integration supported by the installed current version; do not blindly reuse obsolete setup tutorials.
7. Add `.gitignore`, a concise project README, and keep this documentation in `docs/`.
8. Run the starter app locally and verify it in the browser.
9. Review changed files and ensure no secrets, local environment files, or generated build artifacts are staged.
10. Initialize Git and make the first commit after user review.

**Done when:** the starter app runs reliably; exact setup/run commands are documented; Git is initialized and the first commit exists; `TASKS.md` reflects verified completion. Do not begin Milestone 1 until the user approves.

## Milestone 1 — Visual shell
- Build the application frame and navigation.
- Implement the six main-menu tiles.
- Apply the pink/rose design tokens.
- Add placeholder destination screens.
- Add settings entry point.
- Verify resizing and keyboard focus.

**Done when:** all navigation works and the design direction is consistent.

## Milestone 2 — Content model and question bank
- Define TypeScript types.
- Implement SQLite persistence.
- Create a small seed dataset of original test questions.
- Define and document the versioned JSON content-package contract.
- Implement a side-effect-free parser and validator.
- Add Settings → Question Bank Management with an Import Questions entry point.
- Implement local file selection, validation feedback, and a package preview.
- Detect duplicate package versions and duplicate content IDs; never silently overwrite.
- Require explicit confirmation and import approved items only.
- Write all package content atomically in one SQLite transaction; roll back on any failure.
- Add import history and verify that imports never modify user activity data.
- Implement category and difficulty filters.
- Build an internal content QA checklist.

**Done when:** a valid approved package can be imported offline; invalid/unsupported packages are rejected before writes; duplicate handling is visible; simulated write failures leave no partial content; and attempts, bookmarks, sessions, and statistics remain unchanged.

## Milestone 3 — Logical Reasoning practice
- Build question display and answer choices.
- Save selected answers.
- Support next/previous navigation.
- Add timed and untimed sessions.
- Add bookmarks and explanations.
- Save session state automatically.

**Done when:** a user can complete, close, reopen, and review an LR session without losing data.

## Milestone 4 — Reading Comprehension
- Build passage display.
- Associate questions with passages.
- Support comparative passages.
- Preserve passage position during question navigation.
- Save answers, timing, and bookmarks.

**Done when:** complete RC sets work from start to finish.

## Milestone 5 — Custom Practice
- Build the session configuration interface.
- Implement filters and question selection.
- Add randomization.
- Add saved templates.
- Validate question availability before starting.

**Done when:** the selected configuration creates the expected session without unintended repeats.

## Milestone 6 — Practice tests and exam simulator
- Build section/session framework.
- Add section timer and navigation.
- Add flagging and unanswered indicators.
- Add breaks and configurable exam structure.
- Add result and review screens.
- Verify exam rules against current LSAC guidance before release.

**Done when:** a full simulation can be completed and accurately reviewed.

## Milestone 7 — Review and statistics
- Build missed/bookmarked/retry views.
- Implement documented statistics calculations.
- Add charts and historical filters.
- Verify that retries do not corrupt original history.

**Done when:** statistics reconcile with underlying attempt records.

## Milestone 8 — Reliability and offline validation
- Disable network and test all core flows.
- Test app restart during untimed and timed sessions.
- Test crash/recovery behavior.
- Test backup and restore.
- Test database migrations.
- Check accessibility and keyboard navigation.

**Done when:** core use does not require internet and user data is recoverable.

## Milestone 9 — Tauri packaging and macOS testing
- Add Tauri 2 desktop shell.
- Configure app metadata and icon.
- Build/test on Linux as appropriate.
- Use the recipient's Mac for macOS build and installation testing.
- Check target CPU architecture.
- Sign and notarize if needed for smooth distribution.
- Test offline use after installation.

**Done when:** the app installs and runs on the recipient's Mac with persistent data.

## Suggested first release
A reasonable first release target:
- Both LR and RC practice.
- At least 300 reviewed questions.
- Detailed answer explanations.
- Custom practice sessions.
- Basic full-length simulator.
- Review and bookmarks.
- Separate statistics page.
- Automatic saving and backup/restore.
- Fully offline core functionality.

Do not delay a working first release solely to reach the long-term question-bank target.
