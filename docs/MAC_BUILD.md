# Building and Testing on a Mac

Nothing in this document has been run yet: it needs a Mac. The app was built and tested on Linux
only (see `RELIABILITY.md`). Sources, read November 24, 2026: Tauri's pages on
[prerequisites](https://v2.tauri.app/start/prerequisites/),
[app bundles](https://v2.tauri.app/distribute/macos-application-bundle/),
[DMG](https://v2.tauri.app/distribute/dmg/), and
[signing](https://v2.tauri.app/distribute/sign/macos/). Items marked † are general knowledge that
those pages do not state, so check them as you go.

## 1. Check the Mac that will use the app
Apple menu → About This Mac. Write down:
- **Chip:** Apple (M1 or later) or Intel.
- **macOS version:** 13.3 or later is required. The interface uses features that need Safari 16.4.

## 2. Prepare the Mac that will build it
It can be the same Mac. Each command is safe to run again.
1. Apple's command-line tools: `xcode-select --install`
2. Rust, then open a new Terminal window: `curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh`
3. Node.js 22.12 or newer, from https://nodejs.org
4. Copy the project folder over **without** `node_modules`, `dist`, or `src-tauri/target`.

## 3. Check before building
From the folder containing `package.json`:
```bash
npm ci
npm test
npm run test:rust
npm run lint
npm run app
```
The app should open. Close it before continuing.

## 4. Build
```bash
npm run build:mac
```
The `.app` and `.dmg` should be in `src-tauri/target/release/bundle/` †. They run only on the same
kind of chip as the Mac that built them.

For one file that runs on both kinds †:
```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run build:mac -- --target universal-apple-darwin
```
Confirm the kinds it supports †: `lipo -archs "path/to/LSAT Prep.app/Contents/MacOS/lsat-prep"`

## 5. Sign
**Without a paid Apple Developer account**, sign locally ("ad hoc"):
```bash
APPLE_SIGNING_IDENTITY=- npm run build:mac
```
If that is not accepted, set `bundle.macOS.signingIdentity` to `"-"` in `tauri.conf.json`. Apple
Silicon needs at least this for apps from the internet. The Mac will still ask the user to allow the
app in System Settings → Privacy & Security, once.

**With a paid account**, the app opens without that step. Create a *Developer ID Application*
certificate; only the account holder can. Then, in the Terminal only:
```bash
security find-identity -v -p codesigning
export APPLE_SIGNING_IDENTITY="the name shown above"
export APPLE_ID="..." APPLE_PASSWORD="an app-specific password" APPLE_TEAM_ID="..."
npm run build:mac
```
Never put these values, certificates, or keys in the project folder or in Git.

Check the result †: `spctl -a -vv "LSAT Prep.app"` and `codesign --verify --deep --strict "LSAT Prep.app"`

## 6. Test on the recipient's Mac
Install from the `.dmg`, then turn Wi-Fi off.
- [ ] The app opens from Applications, with its icon in the Dock.
- [ ] Copy and paste, Cmd+Q, and the red button work. Reopening keeps the data.
- [ ] Settings → Question Bank Management: the file picker opens and a package imports.
- [ ] Logical Reasoning, Reading Comprehension, and Custom Practice: answer, check, finish, review.
- [ ] Quit in the middle of a session with Cmd+Q. Resume keeps the answers, place, and time.
- [ ] Force-quit (Cmd+Option+Esc) after answering. The answer is kept.
- [ ] A timed session: close the lid for two minutes. The timer should not have counted it.
- [ ] A simulation: close the lid for two minutes. The timer should have counted it.
- [ ] Back up to a file, then restore it. Both file windows work.
- [ ] Opening a second copy on the same data is refused, or the first window comes forward.
- [ ] Headings, passages, and the number row are readable, and a narrow window stacks the passage.
- [ ] VoiceOver (Cmd+F5) can read a question, choose an answer, and finish.
- [ ] Restart the Mac. The data is still there.

Data should be in `~/Library/Application Support/com.lsatprep.desktop` †.

## 7. Before giving it to anyone
- [ ] Questions are approved and imported (`CONTENT_QA_CHECKLIST.md`).
- [ ] The current LSAT format is checked again (`EXAM_FORMATS.md`).
- [ ] Review and Statistics are built, or their tiles are dealt with.
- [ ] Their data is backed up before any update.
