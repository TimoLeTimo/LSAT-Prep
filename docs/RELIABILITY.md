# Reliability Checks

**Checked:** November 24, 2026, on Ubuntu 24.04, with the real app window, engine, and database.
The app was built from a temporary copy with two changes: a way to run page scripts, and fixed
paths in place of the native file pickers. Keyboard checks used real key presses. These checks need
repeating on macOS.

| Area | What was done | Result |
|---|---|---|
| Offline | Ran with no working network interface: import, practice, custom, tests, simulation, review | Everything worked |
| Hard kill | Killed the app right after answering, 10 times | No answer lost; integrity check passed |
| Normal close | Closed mid-session | Clock saved; the database file is complete by itself |
| Timed practice | Closed, killed, and let time run out | Paused while closed; saved answers submitted |
| Simulation | Killed and closed mid-section, mid-break, and in the last section | Timer kept running; correct phase on return; results available |
| Marking | Compared 13 attempts with the keys in the database | All correct |
| Shuffled answers | 8 questions, checked by text | Choices, key, explanations, and records agreed |
| Custom filters | Category, difficulty, both with a passage, missed, new, shuffled order, timed; chosen questions compared with the database | All matched. "Exclude correct" and a bookmarked session were checked only by unit tests |
| Migration | Opened copies of version 1, 2, and 3 databases | Upgraded, data kept, backup made |
| Restoring a backup | Opened automatic backups in clean folders | Data present |
| Backup and restore | Saved, compared, restored, undid, reopened | Data matched each time |
| Bad backups | Hidden code, junk, damaged, wrong type, missing | Refused; data unchanged |
| Killed during a restore | 12 times, at random moments | Always entirely the old or the new data; checks passed |
| Unreadable data | Restored a backup over it | Recovered; the old file kept |
| Two copies of the app | Opened a second on the same data | Refused; the first kept working; lock freed after a kill |
| Damage | Damaged the header, then a middle page | Refused, file unchanged |
| Read-only data | Removed write permission | Clear error |
| Accessibility | Names, labels, IDs, headings, contrast, and target size on 25 screens, with a control | No problems found |
| Keyboard | Tab order, focus rings, Enter, letters, arrows, dialog, Escape | Worked |

Simulated time: the section start and break end times were moved back in the test database, rather
than waiting 35 and 10 minutes.

**Not checked:** real suspend, power loss, a full disk, a screen reader, the native
file pickers (opening a file was confirmed by hand; saving was not), and macOS.
