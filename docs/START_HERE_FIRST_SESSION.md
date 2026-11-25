# Start Here — First Claude Code Session

This is the practical launch guide. When you get home, open the project folder in VS Code, open Claude in the integrated terminal/editor, provide the project documentation (or make sure the `docs/` folder is in the repository), and paste the prompt at the end of this file.

## What you should have ready

- Your Linux computer, connected to the internet for development-tool installation only. The finished app's core use must be offline.
- VS Code with the Claude Code extension or Claude Code available in its integrated terminal.
- Git installed, or permission for Claude to help install it.
- A folder where the project should live, for example `~/Projects/lsat-prep`.
- The documentation pack extracted into the project as `docs/`.

You do **not** need a Mac to begin. Linux is suitable for the React/TypeScript application and most development. A real macOS build, signing/notarization, and final installation test must happen on a Mac later.

## First 10 minutes

1. Extract the documentation ZIP.
2. Create/open a clean project folder in VS Code. Do not put the project inside the ZIP or edit the ZIP itself.
3. Copy the documentation folder into the project and name it `docs`.
4. Open Claude Code in that project folder.
5. Paste the **First-session prompt** below.
6. Follow the instructions Claude gives you. If it asks you to run a command, it should explain what the command does before asking you to approve it.

## First-session prompt — paste this into Claude Code

```text
We are starting implementation of my LSAT Prep desktop app. Treat the documentation in ./docs as the product requirements and source of truth. Read these files before doing anything: README.md, START_HERE_FIRST_SESSION.md, PROJECT_PLAN.md, DESIGN_GUIDE.md, ARCHITECTURE.md, DATABASE_SCHEMA.md, IMPLEMENTATION_ROADMAP.md, TASKS.md, AI_HANDOFF_PROMPT.md, and RULES_OF_ENGAGEMENT_QUESTION_CREATION.md.

ABOUT ME AND HOW TO WORK
I have some coding experience but I am not an experienced software engineer. I am building this on Linux with AI assistance. Explain things plainly, do not bury me in jargon, and give me exact commands and file paths. Work in small steps. Do not generate the whole app at once. Do not pretend a command succeeded: show me the actual result and verify it. Ask before using sudo, installing system packages, deleting files, overwriting existing work, or doing anything destructive. You may create/edit project files and run non-destructive local development commands in this repository.

PRODUCT REQUIREMENTS
Build a polished, premium, modern academic LSAT practice app for macOS, initially for one user, that works fully offline after installation and local question import. Use React + TypeScript + Vite, Tailwind CSS, Tauri 2, and SQLite unless you find a concrete incompatibility; explain and ask before changing the stack. The visual direction is warm off-white, charcoal text, and restrained rose/pink accents. Main navigation has exactly these destinations: Logical Reasoning, Reading Comprehension, Custom Practice, Practice Tests, Review, Statistics. Settings is a separate gear entry. The main menu is navigation only and must not show stats, weak areas, or recommendations.

This is practice-only: no AI tutor, lessons, courses, cloud accounts, subscriptions, online APIs, server, or mobile app. Include the Import Questions feature under Settings → Question Bank Management, not in main navigation. It imports versioned JSON packages offline; validates and previews before confirmation; imports approved content only; detects duplicates; never silently overwrites; uses a single atomic transaction with rollback; logs import history; and must never change attempts, bookmarks, sessions, settings, or statistics. Treat package files as untrusted input and never execute embedded content. Use original question content or properly licensed content only; never copy/rewrite LSAC questions.

YOUR FIRST TASK: MILESTONE 0 ONLY
Do not start building screens or application features yet. First inspect the current workspace and machine environment. Report:
1. Current working directory and whether it is empty or contains existing work.
2. Linux distribution/version and architecture.
3. Installed versions (or absence) of Git, Node.js, npm, Rust, Cargo, and the Tauri prerequisites relevant to this distribution.
4. Whether VS Code/Claude are already available (do not attempt to inspect private credentials or tokens).
5. Any blockers or missing dependencies.

Then propose the safest exact setup plan for this machine. Prefer current stable/LTS versions and official installation methods. Do not install anything or run sudo commands until I approve the plan. Do not assume a specific Linux distribution. Avoid adding unnecessary packages.

After I approve the setup plan, guide me through the minimum steps to initialize a React + TypeScript + Vite project, add Tailwind using its current supported Vite integration, initialize Git, and get the unmodified starter app running locally. Confirm the current Tailwind setup method from installed package documentation/version rather than using outdated instructions. Add a short README with exact run commands and a .gitignore. Keep the docs in ./docs. Make the first Git commit only after showing me the changed files and confirming no secrets or generated build files are included.

DONE CRITERIA
Milestone 0 is complete only when the starter app actually runs locally, the commands are recorded, Git is initialized, the first commit exists, and TASKS.md is updated accurately. Do not begin Milestone 1 until I explicitly say to continue. If anything unexpected exists in the workspace, stop and ask rather than overwriting it.
```

## What to expect from the first session

Claude should **inspect first**, then give you a machine-specific setup plan. You approve installation steps before they happen. After setup, it should create only the starter project, run it, and make a first Git commit. This first session is not supposed to build the full LSAT app.

## Commands you will commonly use later

The exact package scripts will be confirmed when the project is created. A typical Vite workflow is:

```bash
npm install
npm run dev
```

Stop the development server with `Ctrl+C`. Do not run commands from a random directory; run them from the project root (the folder containing `package.json`).

## Milestone rhythm

At the end of each milestone, ask Claude to:
- summarize what changed and why;
- list every file created/modified;
- run the relevant checks and report exact results;
- identify known limitations and untested behavior;
- update `docs/TASKS.md` and relevant docs;
- provide the exact command to run the app;
- stop and wait for your approval before starting the next milestone.

Do not ask it to build all milestones in one go. A working, tested foundation is more valuable than a large amount of unverified code.
