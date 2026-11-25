# Project Plan

## 1. Product vision
Build a high-quality LSAT practice platform that feels like a finished desktop product. Its value comes from a strong question bank, flexible practice, realistic test simulation, reliable review, and useful statistics.

The app should be simple to navigate and dependable offline.

## 2. Explicit scope

### Included in the initial product
- Logical Reasoning practice.
- Reading Comprehension practice, including comparative passages.
- Custom practice-session builder.
- Practice tests and a configurable full-length exam simulator.
- Answer explanations.
- Bookmarks and question review.
- Local statistics and practice history.
- Automatic saving and recovery of unfinished sessions.
- Local backup/export and restore.
- Offline operation after installation and content import.

### Explicitly excluded for now
- AI tutor or generative AI inside the app.
- Written lessons, courses, or guided coursework.
- Cloud accounts, subscriptions, multiplayer, or online leaderboards.
- Cloud database or mandatory internet connection.
- Mobile applications.
- Automated AI recommendations on the main menu.

Do not add excluded features unless the product owner explicitly changes scope.

## 3. Main menu and navigation
The main menu is a navigation hub only. It should not display performance metrics, weak areas, recommendations, goals, or study prompts.

Primary destinations:
1. Logical Reasoning
2. Reading Comprehension
3. Custom Practice
4. Practice Tests
5. Review
6. Statistics

Settings may be accessed separately through a gear icon.

## 4. Feature requirements

### Logical Reasoning
Support targeted or mixed practice across categories such as:
- Identify the conclusion
- Identify premises / evidence
- Main point
- Role of a statement
- Method of reasoning
- Strengthen
- Weaken
- Necessary assumption
- Sufficient assumption
- Flaw
- Inference / must be true
- Resolve or explain
- Principle: application or justification
- Evaluate an argument
- Parallel reasoning
- Parallel flaw

Question taxonomy should be data-driven so categories can be edited without rewriting the practice engine.

### Reading Comprehension
- Store complete passages separately from their questions.
- Support single passages and comparative passage pairs.
- Display passage and associated questions in a usable split or responsive layout.
- Support question types including main idea, purpose, author attitude, inference, vocabulary in context, structure, detail, application, paragraph function, and passage relationship.
- Preserve passage context when navigating between its questions.

### Custom Practice
Allow users to configure:
- Section: Logical Reasoning, Reading Comprehension, or a supported mix.
- Number of questions.
- Difficulty mix or selected difficulty.
- Question categories.
- Timed or untimed mode and custom time limit.
- Explanations after each question or at session end.
- Hints on/off only if curated hints are authored for that question.
- New questions, previously missed, bookmarked, or other eligible subsets.
- Exclude previously correct questions if desired.
- Randomize question order and answer order.
- Save and reuse practice templates.

The builder must validate that enough eligible questions exist before creating a session. Never silently repeat questions unless the user explicitly allows it.

### Practice Tests
Provide:
- Custom section-based tests.
- A separate full-length LSAT simulator.
- Section timers, answer navigation, flagging, and unanswered-question indicators.
- A controlled break between sections where applicable.
- A results screen and post-test review.

The exam structure must be configuration-driven, not hard-coded throughout the UI. Verify the current LSAC exam format and timing from LSAC before release; exam rules can change. The intended current baseline has four multiple-choice sections of 35 minutes each: two scored Logical Reasoning, one scored Reading Comprehension, and one unscored experimental LR or RC section, with a 10-minute intermission after section two. Treat this as a configurable baseline, not an immutable rule.

### Review
- Incorrect answers.
- Bookmarked questions.
- Previously attempted questions.
- Retry questions without revealing the correct answer first.
- Show the original answer and attempt details after retry/review.
- Display the authored explanation for the correct answer and each distractor.
- Keep review activity separate from original attempts so history remains accurate.

### Statistics
Statistics are a separate navigation destination, not part of the main menu content.

Track and display:
- Total questions answered.
- Overall accuracy.
- Average time per question.
- Total practice time.
- Logical Reasoning vs Reading Comprehension performance.
- Accuracy by question category.
- Accuracy by difficulty.
- Practice-session history.
- Practice-test results and score history.
- Performance trends over time.

Clearly define metric calculations. For example, decide whether unanswered questions count in denominators (normally they should not count as answered questions). Avoid implying an official LSAT scaled score unless a defensible, documented conversion is implemented.

### Question Bank Management and Import Questions
Provide an **Import Questions** action under **Settings → Question Bank Management**. It is a content-management utility, not a seventh main-menu destination.

The initial importer accepts versioned, offline JSON content packages created for this app. The flow is:
1. Choose a local package file using the native file picker.
2. Parse and validate the complete package without writing to the database.
3. Show a preview: package name/version, total questions, LR/RC counts, category counts, passage count, and any warnings or errors.
4. Identify duplicate package/question/passage/category IDs and explain what will be skipped or rejected. Never silently overwrite existing content.
5. Require explicit confirmation before import.
6. Import the approved content in one database transaction. If any required validation or write fails, roll back the entire import.
7. Show the final result and record an import-history entry.

Safeguards:
- Only questions marked `approved` and passing the content QA requirements may be imported into the usable question bank. If any question is not approved, the whole package is rejected. Draft or merely reviewed items are not practice-eligible.
- Validate schema version, package identity/version, stable IDs, section/category references, exactly five choices, one valid correct choice, explanations for all choices, and valid RC passage references.
- Detect duplicate IDs and duplicate package versions before writing. Do not replace existing questions or passages during normal import. A future explicit content-update workflow would need its own review and approval.
- Do not alter, delete, or reset user attempts, bookmarks, session history, statistics, or settings during content import.
- Keep an import history with timestamp, package identity/version, counts added/skipped, and outcome/error summary.
- Import and validation must work entirely offline. Treat package files as untrusted input; enforce reasonable file-size and field-length limits and never execute embedded content.

The JSON package contract and validation rules are in `CONTENT_PACKAGE_FORMAT.md`. The interface should be understandable to a nontechnical user and should explain validation failures in plain language.


## 5. Question bank goals
Targets, not existing content:
- Initial release: 200 Logical Reasoning questions and 100 Reading Comprehension question items.
- First major expansion: 1,000 LR and 400 RC question items.
- Long-term target: 3,500 LR and 1,500 RC question items.

Prioritize quality over raw count. Each RC question must reference its complete passage.

Each question should include:
- Stable unique ID.
- Section and category.
- Difficulty.
- Prompt/stem.
- Five answer choices for standard LSAT-style multiple choice.
- Correct choice.
- Explanation for the correct choice.
- Explanation for every incorrect choice.
- Tags and estimated time.
- Passage ID when applicable.
- Content version and review/approval status.

Use original LSAT-style material or properly licensed material. Do not scrape or reproduce copyrighted LSAC questions without permission. Each item should be independently checked for one defensible correct answer, ambiguity, logical validity, and explanation quality.

## 6. Quality principles
- Correctness before quantity.
- Save user answers automatically.
- Never lose a completed answer because the app closes.
- Keep old attempt records stable when question content is revised.
- Make the app usable offline.
- Keep the main menu uncluttered.
- Use accessible contrast and readable typography.
- Make timers reliable and resilient to app suspension/restart.
- Provide clear confirmation before destructive actions.
