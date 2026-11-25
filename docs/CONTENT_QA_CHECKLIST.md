# Content QA Checklist

Use one copy for each question. The policy is in `RULES_OF_ENGAGEMENT_QUESTION_CREATION.md`;
this page is the working checklist. An AI may draft and critique, but only a person may approve.

Question ID: ________  Version: ____  Reviewer: ________  Date: ________

## 1. Solve it without the key
- [ ] I answered it before seeing the key or explanations. My answer: ____
- [ ] My answer matches the key. If not, stop: revise or discard the question.

## 2. Reasoning
- [ ] The key is correct, and I can explain why using only the stimulus or passage.
- [ ] I tried to defend each wrong choice, and each one clearly fails.
- [ ] No specialist knowledge or unstated assumption is needed.
- [ ] LR: I tested the relevant logic, such as negating an assumption or finding a counterexample.
- [ ] RC: I found the lines that support the key, and the key does not go beyond them.

## 3. Wording
- [ ] The question and stimulus are clear, with no ambiguous pronouns or undefined terms.
- [ ] The correct choice does not stand out by length, wording, grammar, or detail.
- [ ] The choices have a similar form. None is "all of the above" or "none of the above."
- [ ] The content is fair and free of stereotypes.

## 4. Explanations and details
- [ ] All five choices are explained, and each explanation gives the real reason.
- [ ] The category fits, and the difficulty was set after solving.
- [ ] It does not repeat the scenario or structure of another question in the bank.

## 5. Originality
- [ ] It was newly conceived and is not copied, paraphrased, or adapted from any LSAC material.
- [ ] The provenance record is complete and true.
- [ ] Any real-world fact was checked, and its source recorded.

## 6. Score
Score each from 0 to 2. Release needs 18 of 20, with a 2 in each starred row.

| Dimension | Score |
|---|---|
| Correctness of key * | |
| Only one correct answer * | |
| Stem clarity | |
| Distractor plausibility | |
| Explanation completeness | |
| Category fit | |
| Difficulty fit | |
| Originality and provenance * | |
| Reading quality and fairness | |
| Metadata completeness | |
| **Total** | |

Decision: [ ] Approve  [ ] Revise  [ ] Reject

## After the whole batch is approved
1. Copy the file from `content/drafts/` to `content/packages/`, and remove "draft" from its name.
2. For each approved question, set `draft_status` to `approved` and the three reviews to `passed`,
   but only if each review really happened. Record the reviewer in `reviewer_notes`.
3. Set each approved passage's `status` to `approved`.
4. Set `origin` to the value that is now true.
5. Remove every question and passage that was not approved.
6. Import the file in the app. Anything missed is refused.

If a passage changes, increase its version and review all of its questions again.
