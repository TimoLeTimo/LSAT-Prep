# Exam Formats

The formats are data in `src/domain/exam/formats.ts`. LSAC can change the exam, so check its pages
again before each release. Only the format was read. No questions or passages were used.

**Checked:** November 24, 2026

## Current format (August 2024 through June 2027)
| Fact | Source |
|---|---|
| Four 35-minute sections, three scored and one unscored | [Types of LSAT Questions](https://www.lsac.org/lsat/about/types-lsat-questions) |
| Two scored LR, one scored RC, and one unscored LR or RC | [LSAT FAQ](https://www.lsac.org/lsat/frequently-asked-questions-about-lsat) |
| The unscored section can be anywhere | [Types of LSAT Questions](https://www.lsac.org/lsat/about/types-lsat-questions) |
| 10-minute intermission after section two; the full time must be taken, and the user continues to the next section | [About the 10-Minute Intermission](https://www.lsac.org/lsat/taking-lsat/about-10-minute-intermission) |
| 27 scored RC and 50 scored LR questions | [August 2027 changes](https://www.lsac.org/lsat-will-look-little-different-starting-august-2027) |

## From August 2027
All from [The LSAT Will Look a Little Different Starting August 2027](https://www.lsac.org/lsat-will-look-little-different-starting-august-2027):
- RC first: 52 minutes, 6 passages, 40 questions (4 passages and 27 questions scored).
- Then two LR sections: 45 minutes and 32 questions each (25 scored).
- 10-minute breaks after the first and second sections.
- Unscored questions are mixed in and are not identified.

## Scoring
[LSAT Scoring](https://www.lsac.org/lsat/lsat-scoring): every question counts the same, with no
deduction for wrong answers. Scores are scaled from 120 to 180, but no conversion table is
published there, so the app shows raw scores only.

## Our assumptions
- **LR sections have exactly 25 scored questions.** LSAC's total is 50. Search results from its site
  mention 25 or 26 in a section.
- **RC may have 26 to 28 scored questions**, because passages in our bank vary in length. An exact
  27 is used when possible. The unscored RC part allows one question either way too.
- **The scored sections are in random order** in the current format. LSAC states only that the
  unscored section can be anywhere.
- **The last month of the current format is June 2027**, inferred from the August 2027 change.
- **Single and comparative passages are not balanced.** LSAC describes a typical mix, which the app
  does not yet enforce.
- **Users may move freely within a section and cannot return to an earlier one.** The pages above do
  not state this.

## Custom tests
Tests built from chosen sections use the same engine. Their clock pauses when the user leaves, and
breaks can be skipped. A full simulation's clock keeps running, and breaks cannot be skipped.
