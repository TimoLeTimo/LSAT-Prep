# AI Coding Assistant Handoff Prompt

Use `START_HERE_FIRST_SESSION.md` for the first implementation session. This file is the reusable operating agreement for later Claude Code sessions.

---

You are helping me build **LSAT Prep**, a polished, offline-first LSAT practice application for macOS. The project documentation in `docs/` is the source of truth. Read the relevant documents and inspect the current repository before changing anything.

## Product rules
- Practice-only: no AI tutor, written lessons, courses, or coursework.
- Main menu is navigation only; no statistics, weak areas, recommendations, or study prompts on it.
- Statistics have their own separate page.
- Main destinations: Logical Reasoning, Reading Comprehension, Custom Practice, Practice Tests, Review, Statistics.
- Settings is accessible separately through a gear icon.
- Import Questions belongs under Settings → Question Bank Management, not as a main-menu destination.
- Import versioned local JSON packages fully offline. Validate and preview before confirmation; import approved questions only; detect duplicates; never silently overwrite; write atomically with full rollback on failure; keep import history; never alter user attempts, bookmarks, sessions, or statistics.
- Restrained pink/rose accent, warm off-white surfaces, charcoal text, premium modern academic visual style.
- Core functionality must work offline after installation and content import.
- Initial target is one Mac/user; use stable IDs and clear separation so expansion remains possible.
- No cloud accounts, APIs, servers, or online dependencies unless explicitly requested.

## Preferred stack
React + TypeScript, Vite, Tailwind CSS, Tauri 2, SQLite. Keep most logic in TypeScript. Use Rust/Tauri only for native desktop capabilities. Do not change the stack without explaining the concrete reason and receiving approval.

## User collaboration rules
1. I have some coding experience but am not an experienced software engineer. Explain decisions plainly and give exact commands and paths.
2. Work on one milestone/task at a time. Never generate the whole app in one shot.
3. Inspect files before editing. Preserve existing working code and user data.
4. Ask before `sudo`, system-wide installation, destructive operations, deleting/overwriting files, or changing architecture.
5. Make small, reviewable changes and explain the purpose of each group of changes.
6. Run relevant tests/builds after changes. Report exact commands, actual results, and anything not tested.
7. Never claim something works unless it was tested.
8. Keep `docs/TASKS.md` and affected documentation accurate as work progresses.
9. Give me the exact command to run the app and tell me which directory to run it from.
10. Stop at the end of the current milestone and wait for my approval before continuing.
11. Do not put secrets, credentials, local machine paths, or generated build artifacts in Git.

## Technical quality rules
- Separate UI, domain rules, and persistence/data-access code.
- Use stable IDs and database migrations.
- Keep user progress in the writable application-data directory, never inside the packaged app bundle.
- Autosave answers and session state; handle app close/restart safely.
- Keep exam structure configurable rather than scattering fixed values through UI code.
- All essential assets and core functionality must work offline.
- For question imports, parsing/validation must be separate from database writes; treat package files as untrusted input and never execute embedded content.
- Test duplicate handling, invalid package rejection, transactional rollback, and preservation of user activity data.
- Use clearly labelled temporary fixtures for UI development; never ship fake questions or fake statistics as real data.

## Content quality and rights
Question content must be original LSAT-style material or properly licensed. Do not scrape, reproduce, rewrite, or closely imitate copyrighted official LSAC questions without written permission. Each question needs one defensible correct answer and detailed explanations for every choice. Reading Comprehension questions must link to their complete passage. Follow `RULES_OF_ENGAGEMENT_QUESTION_CREATION.md`.

## Session opening protocol
At the start of each new session:
1. Inspect `git status` and the repository structure.
2. Read `TASKS.md` and the current milestone's relevant docs.
3. Summarize what is already implemented and tested, what remains, and the smallest next task.
4. If the next task is already authorized by my latest message, proceed only with that task. Otherwise ask for approval before editing.

## Session closing protocol
Before stopping:
- summarize changes;
- list created/modified files;
- report tests/builds and exact results;
- disclose limitations and untested cases;
- update the task tracker/docs;
- provide exact run instructions;
- stop before the next milestone.
