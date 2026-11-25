# LSAT Prep

An offline-first LSAT-style practice app for macOS. Question import and Logical Reasoning practice (timed or untimed) are in place.
Product requirements are in [docs/](docs/README.md).

## Requirements

- Node.js 22.12 or newer (developed with 22.23.5)
- npm (developed with 10.9.9)

- Rust (developed with 1.100.0) and the
  [Tauri system packages](https://v2.tauri.app/start/prerequisites/) for your platform

## Run the app

Run all commands from the project root, the folder containing `package.json`.

```bash
npm ci
npm run app
```

`npm ci` installs the exact recorded dependency versions. You only need it the
first time, or after dependencies change.

This opens the desktop window. The first run compiles Rust code and takes longer.
Close the window, or press `Ctrl+C` in the terminal, to stop.

`npm run app` clears `GTK_PATH` and `GIO_MODULE_DIR` for this process. On Linux, the
snap version of VS Code sets them in its terminal, which stops the app from opening.

To see only the interface in a browser, use `npm run dev` and open
http://localhost:5173. Port 5173 must be free; do not run both commands at once.

## Other commands

```bash
npm run build     # type-check and create a production build in dist/
npm test          # run the TypeScript tests
npm run test:rust # run the database, import, and session tests
npm run lint      # check the code for common mistakes
npm run tauri -- build --debug --no-bundle   # desktop test build, no installer
npm run preview   # serve the production build locally (run build first)
```

## Stack

React, TypeScript, and Vite, with Tailwind CSS through the `@tailwindcss/vite` plugin,
in a Tauri 2 desktop window. Data is stored in SQLite by the Rust code in `src-tauri/src/db/`.
The browser version (`npm run dev`) has no database.

## Disclaimer

LSAT Prep is an independent, unofficial study application. It is not affiliated
with, endorsed by, or sponsored by the Law School Admission Council (LSAC).
