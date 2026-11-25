# LSAT Prep — Project Documentation

**Purpose:** A polished, offline-first macOS LSAT practice application, initially for one user and designed so it can grow later.

**Current product decisions**
- Practice-only: no AI tutor, no written lessons, no coursework.
- Main menu is navigation only; it does not show stats or recommendations.
- Statistics live on a separate page.
- Question imports are available under Settings → Question Bank Management; importing is not a main-menu destination.
- Accent color: pink / rose.
- Visual direction: clean, modern academic, premium and minimal; warm off-white surfaces, charcoal text, subtle pink accents.
- Initial platform: macOS.
- Development machine: Linux.
- Development workflow: ChatGPT for planning and code guidance; Claude in VS Code for implementation/refinement.
- User can test the final application on the recipient's Mac.

## Main navigation
1. Logical Reasoning
2. Reading Comprehension
3. Custom Practice
4. Practice Tests
5. Review
6. Statistics

Settings can be accessible from a gear icon without becoming a primary study area.

## Recommended technology
- React + TypeScript for the UI and most application logic.
- Vite for local development and frontend builds.
- Tailwind CSS for styling.
- Tauri 2 for the native desktop shell and packaging.
- SQLite for local persistent storage.
- Keep application/domain logic independent of the UI where practical.

Use the smallest practical number of dependencies. Avoid cloud services, accounts, APIs, AI integrations, and server infrastructure in the initial release.

## Important development constraint
Develop and test most of the app on Linux. A final macOS build, signing, notarization, and real installation testing require access to macOS. Do not assume a Linux build can produce a fully signed/notarized macOS installer.

## Start implementation
When ready to begin on Linux, follow `START_HERE_FIRST_SESSION.md`. It contains the exact first Claude Code prompt, environment-inspection steps, approval boundaries, and Milestone 0 completion criteria. You should be able to paste that prompt directly into Claude Code after opening the project folder in VS Code.

## Read order
1. `START_HERE_FIRST_SESSION.md`
2. `PROJECT_PLAN.md`
2. `DESIGN_GUIDE.md`
3. `ARCHITECTURE.md`
4. `DATABASE_SCHEMA.md`
5. `IMPLEMENTATION_ROADMAP.md`
6. `OFFICIAL_LSAT_PRACTICE_TEST_DIRECTORY.md`
7. `RULES_OF_ENGAGEMENT_QUESTION_CREATION.md`
8. `CONTENT_PACKAGE_FORMAT.md`
9. `AI_HANDOFF_PROMPT.md`

This documentation describes the intended product. It is not authorization to generate the entire application in one shot. Implement in small, reviewable milestones.
