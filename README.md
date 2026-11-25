# LSAT Prep

An offline-first LSAT-style practice app for macOS. The visual shell is in place; practice features are not built yet.
Product requirements are in [docs/](docs/README.md).

## Requirements

- Node.js 22.12 or newer (developed with 22.23.5)
- npm (developed with 10.9.9)

Rust and Tauri are not needed yet.

## Run the app

Run all commands from the project root, the folder containing `package.json`.

```bash
npm ci
npm run dev
```

`npm ci` installs the exact recorded dependency versions. You only need it the
first time, or after dependencies change.

Open http://localhost:5173. If that port is busy, use the address Vite prints.
Stop the server with `Ctrl+C`.

## Other commands

```bash
npm run build     # type-check and create a production build in dist/
npm run lint      # check the code for common mistakes
npm run preview   # serve the production build locally (run build first)
```

## Stack

React, TypeScript, and Vite, with Tailwind CSS through the `@tailwindcss/vite` plugin.
Tauri 2 and SQLite are planned for later milestones.

## Disclaimer

LSAT Prep is an independent, unofficial study application. It is not affiliated
with, endorsed by, or sponsored by the Law School Admission Council (LSAC).
