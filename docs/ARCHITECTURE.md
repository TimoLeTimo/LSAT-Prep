# Technical Architecture

## 1. Guiding principle
Keep the implementation understandable and avoid unnecessary infrastructure. The initial app is local-first and single-user, but its domain model should not prevent future multi-device or multi-user support.

## 2. Suggested stack
- React + TypeScript: UI and most application behavior.
- Vite: development server and frontend build.
- Tailwind CSS: styling.
- Tauri 2: desktop shell and native packaging.
- SQLite: local database.
- A lightweight chart library such as Recharts only when statistics screens are implemented.

Avoid adding libraries without a concrete need. Do not introduce a backend server, cloud database, account system, API dependency, or AI feature in the initial version.

## 3. Suggested project organization
Adapt as needed, but keep boundaries clear:

```text
lsat-prep/
  src/
    app/                 # app shell, routes, navigation
    components/          # shared UI components
    features/
      logical-reasoning/
      reading-comprehension/
      custom-practice/
      practice-tests/
      review/
      statistics/
      settings/
    domain/              # reusable rules and types
    data/                # repositories and data access interfaces
    styles/
    assets/
  src-tauri/
    src/                 # minimal native integration
    tauri.conf.json
  content/
    packages/            # versioned question/passage content packages
  docs/
  tests/
```

This is a suggested structure, not a requirement to create every folder immediately.

## 4. Application layers
1. UI: React components and screens.
2. Domain: question selection, session rules, scoring, timing rules, and statistics calculations.
3. Data access: repositories that read/write local data.
4. Persistence: SQLite and versioned content imports.
5. Desktop integration: Tauri commands/plugins only where needed.

Keep domain logic testable without rendering React. Avoid putting all logic into large components.

## 5. Local data and content
- User progress and settings live in a writable app data directory, not inside the installed app bundle.
- Use SQLite transactions for related writes.
- Store question content separately from user attempt records.
- Provide a content import/update mechanism using versioned packages.
- Validate content packages before importing them.
- Do not overwrite historical attempts when content changes.
- Store timestamps consistently (UTC internally is recommended) and convert for display.
- Back up the database before schema migrations and provide user-accessible export/restore.

## 5A. Question package import subsystem
Implement import as a distinct domain workflow, not as ad hoc logic inside a React screen.

Suggested boundaries:
- UI feature under `features/settings` or `features/question-bank-management`.
- A package parser/schema validator that has no database side effects.
- An import preview/result model used by the UI.
- An import service that rechecks validation and writes approved content through repositories inside one SQLite transaction.
- A repository query for existing package IDs/versions and content IDs to detect duplicates.
- An import-history repository/table.

Use the Tauri file picker (or another supported local file selection mechanism) to select a local JSON file. Do not upload the file or call a network service. Keep the package format versioned independently from the SQLite schema version. Reject unsupported schema versions and malformed or oversized files before database writes. Never execute content from a package.

Import policy is additive: existing content is never silently replaced. Duplicate handling must be deterministic and visible in preview. Any required validation or database write failure must roll back the full import; no partially imported package may remain. User activity tables are outside the import write set and must remain unchanged.


## 6. Offline requirements
The app must not need network access for:
- Opening the app.
- Browsing question categories.
- Starting and completing practice.
- Timers and exam simulation.
- Saving answers.
- Reviewing explanations.
- Viewing statistics.
- Exporting or restoring local backups.

Do not load fonts, images, scripts, analytics, or other essential assets from remote URLs at runtime.

## 7. Timer and session reliability
- Persist session state, section start/expiry timestamps, answers, flags, and current position.
- Do not rely only on an in-memory interval counter; calculate remaining time from persisted timestamps.
- Handle app suspension and restart.
- Define what happens when a timed section expires.
- Avoid losing the current answer during navigation or shutdown.

## 8. Future expansion
Keep user identity and sync concerns out of the first release. Use stable IDs and repository boundaries so future sync could be added without rewriting question and practice logic. Do not build speculative sync infrastructure now.

## 9. macOS build and delivery
Develop on Linux, but validate the actual macOS build on a Mac. Confirm Tauri's current platform build prerequisites. Plan for:
- macOS app bundle.
- DMG installer.
- Apple signing and notarization if distributing outside the App Store without Gatekeeper warnings.
- Testing on the recipient's Mac.
- Confirming Apple Silicon / Intel compatibility based on the target Mac.
