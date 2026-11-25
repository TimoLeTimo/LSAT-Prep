# Rules of Engagement for Creating LSAT-Style Practice Questions
## Operating standard for ChatGPT, Claude, and human review

**Project:** LSAT Prep  
**Purpose:** Create a reliable bank of original, high-quality LSAT-style practice questions for a private, offline study application.  
**Status:** Mandatory content-production policy.  
**Version:** 1.0 — November 24, 2026

---

## 1. Non-negotiable principles

1. **Originality:** Every item must be newly conceived. Do not copy, transcribe, paraphrase, translate, lightly edit, or create a close substitute for an LSAC question, passage, answer choice, explanation, or test form.
2. **Rights-respecting research:** Official LSAC materials may be used to understand publicly described test structure, question categories, interface conventions, and general skill demands. They are not a source from which to extract content for this app.
3. **One defensible answer:** Each multiple-choice question must have exactly one best answer under the information and assumptions stated in the question.
4. **Valid reasoning:** The key must be demonstrably correct. A plausible-sounding explanation is not proof.
5. **Fair distractors:** Every wrong answer must be wrong for a clear, explainable reason. Avoid ambiguous or accidentally correct alternatives.
6. **No hidden prerequisites:** Questions should test reasoning and reading, not specialist knowledge, trivia, or assumptions absent from the stimulus.
7. **Human approval:** AI-generated questions are drafts until independently checked and approved by a human reviewer.
8. **Traceability:** Every item must have a stable ID, provenance record, version, review status, and documented validation.
9. **No false official status:** The app and its content must not imply that questions are official LSAC questions, endorsed by LSAC, or predictive of an official score.
10. **Quality over volume:** Never lower the review standard to meet a question-count target.

If any rule conflicts with a request to generate more questions quickly, follow the rule and explain the conflict.

---

## 2. Official-materials boundary and copyright rules

LSAC's published terms state that LSAC materials are protected intellectual property and restrict copying, storing, transmitting, reproducing, creating derivative works, displaying, and distributing content without prior written consent. The LSAC Candidate Agreement also protects secure test material and states that publicly released practice/sample tests may not be copied, duplicated, or used in other works without prior written approval.

Therefore:

### Permitted project practice
- Read LSAC's public descriptions of the current test structure and timing.
- Use official practice tests personally through LawHub under the applicable account terms.
- Use official disclosed-test pages to understand the publicly described structure and to identify broad skills tested.
- Maintain a bibliography of official resources and the date checked.
- Describe high-level design observations in generic terms, such as “the question asks the reader to identify an assumption.”
- Create a new question from an independently conceived scenario, argument, passage, and answer set.

### Not permitted without written authorization
- Copying official questions, passages, answer choices, explanations, diagrams, or screenshots into the app or content repository.
- Asking an AI model to rewrite, paraphrase, “make a similar version of,” or change names/numbers in a specific official question.
- Using OCR, scraping, browser automation, bulk downloading, or extraction to harvest questions from LawHub or LSAC pages.
- Uploading official test PDFs, screenshots, or question text to ChatGPT/Claude for conversion into app content.
- Reconstructing secure, undisclosed questions from candidate recollections, leaked material, discussion boards, or answer keys.
- Building a question whose distinctive scenario, structure, wording, sequence of reasoning, and distractors track a particular official question too closely.
- Using LSAC's logo, trade dress, or branding in a way that suggests sponsorship, affiliation, or approval.
- Describing the app's question bank as “official,” “LSAC questions,” or “licensed” unless that is true and documented.

**Important:** Changing names, numbers, wording, or surface details does not automatically make a copied item original. “Inspired by question 42” is not an acceptable content brief.

This document is a conservative operational policy, not legal advice. If the project later seeks to include actual LSAC questions, contact LSAC about a written license before importing or distributing anything.

---

## 3. Official reference library: where to find many real tests

Use these as external study and research resources, not as content feeds for the app.

### A. LawHub — primary official library
- Official LSAT practice tests page: https://www.lsac.org/lsat/prepare/official-lsat-practice-tests
- LawHub: https://lawhub.org/
- LSAC's official prep overview: https://www.lsac.org/lsat/prep

LSAC's current practice-test page reports **four full four-section Official LSAT PrepTests available free through LawHub** and describes LawHub Advantage as providing one year of access to an extensive library of full official PrepTests. The exact catalog, plan price, and number of available tests can change; check the live LawHub account rather than hard-coding a count into this project.

Recommended use:
1. Create/use an individual LawHub account.
2. Complete the free tests in LawHub's own interface.
3. If the user wants a larger official library, review the current LawHub Advantage offer and terms directly.
4. Keep official test-taking and the private app's original-question practice separate.

### B. LSAC disclosed tests — public PDFs
- Official disclosed tests page: https://www.lsac.org/lsat-disclosed-tests

LSAC currently lists disclosed tests from the 2023–2024, 2024–2025, and 2025–2026 testing cycles. LSAC explicitly says these disclosed tests are **not Official LSAT PrepTests**. The page provides disclosure booklets with three scored sections from the relevant administrations.

Use them to:
- Familiarize yourself with public examples and broad content patterns.
- Check that the app's section taxonomy remains aligned with the modern test.
- Observe the general mix of reasoning and reading skills.

Do not copy the disclosed questions into the app. Public disclosure does not itself grant reuse rights.

### C. Official LSAT prep books
- LSAC prep-books catalog: https://www.lsac.org/lsat/lsat-prep/prep-books
- Official LSAT SuperPrep: https://www.lsac.org/lsat/lsat-prep/prep-books-ebooks/official-lsat-superprepr

LSAC's catalog lists the SuperPrep titles and many New Official LSAT TriplePrep volumes. The page describes the TriplePrep series as reflecting the LSAT design beginning with the August 2024 administration; verify the exact edition and contents of each book before relying on it for current-format familiarization. Some older books are historical resources and may contain legacy material.

The catalog currently lists TriplePrep Volumes 2 through 20, plus SuperPrep and SuperPrep II. This is a useful catalogue of many official published resources, but it is not a grant to digitize or redistribute their questions.

### D. Official licensed prep providers
- LSAC prep overview and licensed-content information: https://www.lsac.org/lsat/prep

LSAC maintains a list of companies that license Official LSAT content. A licensee may be able to provide lawful access to official questions under its own product terms. A user's subscription to a provider does not automatically give this project permission to copy its content into a separate app.

### E. LSAC policies to re-check
- LSAC website terms: https://www.lsac.org/about/lsac-policies/terms-conditions-use
- Candidate Agreement (2026–2027): https://www.lsac.org/about/lsac-policies/lsac-candidate-agreement/2026-2027

The policy pages can change. Re-check them before any future decision to ingest, share, or license official material.

---

## 4. Current test blueprint and taxonomy

The app should represent the current multiple-choice LSAT, not the pre-August-2024 version with an Analytical Reasoning / Logic Games section.

At the time this guide was prepared, the multiple-choice test is described by LSAC as four sections: two scored Logical Reasoning sections, one scored Reading Comprehension section, and one unscored experimental section that may be LR or RC. The standard section time is 35 minutes, with a 10-minute intermission after section two. Verify current LSAC rules before release because test structure and administration policies may change.

### Logical Reasoning skill taxonomy
Use stable categories and permit future edits:
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

Avoid treating these labels as perfectly exclusive. Store one primary category and optional secondary tags.

### Reading Comprehension skill taxonomy
- Main idea / primary purpose
- Author's attitude or perspective
- Inference
- Detail / textual support
- Function of a paragraph or sentence
- Passage organization / structure
- Meaning in context
- Application of a principle
- Implication
- Comparative passage agreement / disagreement
- Relationship between authors' arguments
- How one author would respond to the other

### Difficulty
Use four internal levels, but do not pretend these are official LSAC difficulty labels:
- **1 — Introductory:** Shorter, direct reasoning; fewer moving parts.
- **2 — Standard:** Typical complexity; moderate inference or argument structure.
- **3 — Challenging:** Subtle gap, competing considerations, denser structure, or close distractors.
- **4 — Advanced:** Multiple interacting reasoning steps or unusually demanding passage integration.

Difficulty must be assigned after validation, not simply based on how long or complicated the wording looks.

---

## 5. The required question-generation workflow

Do not ask ChatGPT to “make 100 LSAT questions” in one pass. Generate small batches with a blueprint and validate every item.

### Step 1 — Define the batch blueprint
Before drafting, specify:
- Section and primary question category.
- Number of items.
- Target difficulty distribution.
- Intended reasoning skill.
- Whether the items are independent or linked to a passage.
- Any desired variation in subject matter and argument form.
- Excluded topics or repeated scenarios from recent batches.

A typical batch should contain 5–10 draft questions, not dozens. Smaller batches make quality control practical.

### Step 2 — Invent a genuinely new source scenario
For LR, invent a fresh argument, policy, study, observation, causal claim, recommendation, or comparison. Do not begin with an official question's wording, story, logical skeleton, or answer pattern.

For RC, write a new passage from scratch. Choose a topic that can be understood from the passage alone. Do not imitate a known passage's distinctive thesis, sequence, examples, named entities, or paragraph architecture.

Vary domains naturally: science, history, arts, public policy, economics, technology, law, environment, linguistics, and everyday institutions. Do not require outside factual knowledge.

### Step 3 — Establish the reasoning key before writing choices
The author must state internally:
- What the stimulus/passage establishes.
- What it does not establish.
- The precise task asked by the stem.
- The correct answer's logical basis.
- Why the answer is entailed, required, or best supported.
- Which tempting inferences must be rejected.

For assumption questions, explicitly identify the gap between premises and conclusion. For inference questions, test whether the answer must follow rather than merely seem plausible.

### Step 4 — Write the stem and answer choices
- Use five answer choices, A–E, unless a specific task explicitly calls for another format.
- Keep choices parallel in grammatical form and comparable in specificity.
- Ensure one and only one best answer.
- Avoid clues based on answer length, unusual vocabulary, absolute wording, or grammatical mismatch.
- Avoid “all of the above” and “none of the above.”
- Do not make the correct choice systematically longer or more qualified.
- Avoid ambiguous pronouns, undefined terms, and accidental double negatives.
- Make distractors plausible to a reader who makes a recognizable reasoning error.

### Step 5 — Write complete explanations
For every item, explain:
1. The task the stem asks the reader to perform.
2. The relevant evidence or argument structure.
3. Why the correct answer is correct.
4. Why A, B, C, D, and E are each correct or incorrect, explicitly.
5. The exact logical error or unsupported leap in each wrong answer.

Explanations must be self-contained and must not rely on “because it is the answer key.”

### Step 6 — Run independent validation
Use a separate validation pass that is not shown the intended answer first. The validator should solve the item from scratch, then compare its result with the key.

A separate reviewer should attempt to:
- Find a second defensible answer.
- Find a hidden assumption that invalidates the key.
- Find an answer choice that is not actually wrong.
- Identify ambiguous wording.
- Identify an answer that requires external knowledge.
- Identify a mismatch between stem and task.
- Identify a copied or derivative structure.

If the validator disagrees or identifies a credible ambiguity, the item fails and must be revised or discarded. Do not “vote” between AI models to decide truth. Resolve the logic explicitly.

### Step 7 — Human review and approval
A human reviewer must read the complete item and explanations. Mark the item approved only after the key, distractors, and explanations have passed.

### Step 8 — Import only approved items
Draft items belong in a staging area. Only approved content can be included in a release package.

---

## 6. Logical Reasoning-specific standards

### Argument construction
A typical LR stimulus should contain a coherent argument or set of statements. Ensure the conclusion is identifiable when the task requires one. Avoid artificial, nonsensical premises unless the task is explicitly about formal relationships.

### Correct-answer proof
- **Strengthen:** The answer increases support for the conclusion or addresses a relevant gap; it need not prove the conclusion.
- **Weaken:** The answer undermines a premise, inference, causal link, comparison, or assumption relevant to the conclusion.
- **Necessary assumption:** If negated, the answer damages the argument; the argument requires it.
- **Sufficient assumption:** Added to the premises, the answer makes the conclusion follow.
- **Flaw:** The answer accurately describes the specific reasoning error, not merely a generic flaw.
- **Inference:** The answer must follow from the stated information; “could be true” is not enough.
- **Resolve/explain:** The answer provides a plausible explanation that allows both stated facts to coexist.
- **Principle:** The answer applies or expresses the relevant general rule without changing its scope.
- **Parallel reasoning/flaw:** Match the abstract logical structure, not merely the topic or vocabulary.
- **Evaluate:** The answer identifies information whose resolution would materially affect assessment of the argument.

### Distractor design
Use distinct error types where appropriate:
- Reverses a conditional.
- Confuses necessary and sufficient conditions.
- Treats correlation as causation.
- Attacks a premise irrelevant to the conclusion.
- Uses evidence that is consistent with, but does not establish, the conclusion.
- Overgeneralizes from a limited sample.
- Confuses a possibility with a certainty.
- Misstates the conclusion.
- Shifts comparison groups or time periods.
- Introduces an irrelevant consideration.

Do not force these errors into every item. Distractors must arise naturally from the particular question.

### Formal logic checks
For conditional reasoning, write the relationships in plain language or symbolic notation during internal validation. Test contrapositives and avoid invalid reversals. For “must be true” items, check every possible case or construct a counterexample for each rejected choice.

---

## 7. Reading Comprehension-specific standards

### Passage originality
- Write passages from scratch.
- Do not summarize or paraphrase an existing LSAC passage, textbook excerpt, article, or copyrighted essay.
- Use fictional or carefully checked factual contexts.
- Do not present fabricated research findings as real-world facts.
- If a passage uses a hypothetical study, make that status clear.
- If it describes real history or science, verify the claims from reputable sources and record citations in internal metadata; do not require the learner to know facts not stated in the passage.

### Passage structure
Use a natural progression of ideas. A passage may:
- Introduce a debate.
- Explain a theory.
- Present evidence.
- Compare competing interpretations.
- Identify a limitation.
- Defend or qualify a conclusion.

Do not force every passage into the same paragraph pattern. Vary voice, structure, and rhetorical purpose while keeping the prose coherent.

### Question quality
Every answer must be grounded in the passage. Distinguish:
- Explicitly stated information.
- Strongly supported inference.
- Author's view versus a view being described.
- A critic's position versus the author's response.
- The function of a detail versus the detail itself.

For comparative passages, make the relationship between the two texts clear enough to support questions about agreement, disagreement, qualification, and response. Do not make one passage merely repeat the other.

### Passage set integrity
A passage and all its questions form a content unit. Do not shuffle questions away from their passage. If a passage is revised, increment its version and revalidate every linked question.

---

## 8. Item data contract

Every approved question must be stored with at least:

```json
{
  "id": "lr-strengthen-000001",
  "section": "logical_reasoning",
  "primary_category": "strengthen",
  "secondary_tags": ["causal_reasoning"],
  "difficulty": 2,
  "prompt": "Original question stem and stimulus...",
  "choices": [
    {"label": "A", "text": "Choice text..."},
    {"label": "B", "text": "Choice text..."},
    {"label": "C", "text": "Choice text..."},
    {"label": "D", "text": "Choice text..."},
    {"label": "E", "text": "Choice text..."}
  ],
  "correct_choice": "C",
  "explanations": {
    "A": "Why A is wrong...",
    "B": "Why B is wrong...",
    "C": "Why C is correct...",
    "D": "Why D is wrong...",
    "E": "Why E is wrong..."
  },
  "estimated_time_seconds": 90,
  "passage_id": null,
  "content_version": 1,
  "provenance": {
    "origin": "original_ai_assisted_human_reviewed",
    "source_material_used": "No official question text or passage used",
    "authoring_batch": "2026-11-lr-strengthen-01"
  },
  "quality": {
    "draft_status": "approved",
    "independent_solve": "passed",
    "ambiguity_review": "passed",
    "human_review": "passed",
    "reviewer_notes": ""
  }
}
```

This is an illustrative schema. Adapt field names to the app's final database design. Store passages separately and reference them by stable ID. Keep a separate change log for revisions.

---

## 9. Quality scoring and release gates

Score each dimension from 0 to 2:
- 0 = fails.
- 1 = acceptable but needs revision.
- 2 = strong.

Dimensions:
1. Correctness of key.
2. Uniqueness of correct answer.
3. Stem clarity.
4. Distractor plausibility.
5. Explanation completeness.
6. Category fit.
7. Difficulty fit.
8. Originality/provenance.
9. Reading quality and fairness.
10. Metadata completeness.

**Release threshold:** 18/20, with mandatory 2/2 for correctness, unique answer, and originality/provenance. Any failed mandatory dimension blocks release regardless of total score.

A score is a workflow aid, not a substitute for reviewer judgment.

### Automatic rejection conditions
- More than one defensible correct answer.
- No defensible correct answer.
- Key contradicts the stimulus or passage.
- Explanation does not support the key.
- Wrong choice could reasonably be correct.
- External specialist knowledge is needed.
- Passage or question is copied, closely paraphrased, or derived from protected material.
- Required passage or answer choice is missing.
- Item metadata is incomplete.
- Item contains a factual error that affects the answer.
- Item has not received human approval.

---

## 10. Batch management and diversity

For every generation batch:
- Create a batch ID.
- Specify category and difficulty distribution.
- Keep a record of scenarios and logical structures already used.
- Avoid repeating names, settings, argument patterns, and distractor patterns.
- Avoid demographic stereotypes or culturally narrow assumptions.
- Use inclusive, neutral examples.
- Keep reading load appropriate to the intended task.
- Review category balance and difficulty distribution after each batch.

Do not interpret a large number of generated items as a large number of usable items. Track:
- Drafted.
- Validated.
- Needs revision.
- Rejected.
- Approved.
- Retired.

Only approved questions count toward release targets.

---

## 11. ChatGPT operating prompts

### Prompt A — Create a small original LR batch
> You are an LSAT-style assessment item writer for an independent practice app. Follow the attached Rules of Engagement exactly. Create **5 original Logical Reasoning questions** in the category [CATEGORY], with difficulty distribution [DISTRIBUTION]. Do not use, imitate, paraphrase, or adapt any official LSAC question or passage. Invent fresh scenarios and argument structures. For each item, provide the stem, five choices, keyed answer, a rigorous proof of the key, an explanation for every choice, category, difficulty, estimated time, and metadata. Before presenting the batch, audit each item for one uniquely defensible answer, ambiguity, external-knowledge dependence, and originality. If an item fails, revise or discard it rather than lowering the standard. Label all output DRAFT — NOT APPROVED.

### Prompt B — Create an original RC passage set
> Follow the attached Rules of Engagement. Write one entirely original Reading Comprehension passage of approximately [LENGTH] words on [BROAD TOPIC], with a natural and coherent structure. Do not summarize, paraphrase, or imitate an existing LSAC passage or published article. Then write [NUMBER] questions covering [QUESTION-TYPE MIX], each with five choices. For every question, cite the exact passage idea that supports the key, explain why the key is correct, and explain why each distractor is wrong. Ensure every answer is passage-grounded. If comparative reading is requested, write two independently original passages with a meaningful relationship, not a copied or lightly altered pair. Label output DRAFT — NOT APPROVED.

### Prompt C — Blind independent solve
> Validate the following draft as if you did not know the intended answer. First solve it independently and state your selected answer with reasoning. Then inspect every choice for possible defensibility, ambiguity, unstated assumptions, factual dependence, and stem/category mismatch. For LR, test the relevant logical relationship explicitly. For RC, identify the passage support and distinguish explicit statement from inference. Do not try to agree with the provided key. If another answer is defensible or the key is unsupported, mark FAIL and explain exactly why. Do not rewrite the item until the diagnosis is complete.

### Prompt D — Distractor adversarial audit
> Act as a skeptical assessment editor. Assume the item may be flawed. For each wrong answer, construct the strongest plausible argument that it could be correct. Then determine whether the stimulus/passage actually defeats that argument. Identify any answer that is ambiguous, partly correct in a way that makes it competitive, or wrong for an unstated reason. Check whether the correct answer is accidentally signaled by length, wording, grammar, or specificity. Return PASS only if one answer is uniquely best and every distractor is clearly wrong.

### Prompt E — Explanation audit
> Audit the explanation set against the exact question and answer choices. Verify that it explains the actual reasoning, not merely restates the answer. Check all five choices individually. Flag unsupported claims, logical leaps, terminology errors, and explanations that accidentally make a distractor sound correct. Do not invent facts absent from the stimulus/passage.

### Prompt F — Human review packet
> Prepare a reviewer packet for this question. Show the complete item, answer key, explanation for every choice, category, difficulty, provenance, and the independent validation results. Add a short checklist for a human reviewer to confirm: originality, unique answer, reasoning validity, fairness, clarity, and metadata. Do not mark it approved; approval is a human decision.

### Prompt G — Batch diversity audit
> Compare these draft items only against the other original items in this project batch/library. Identify repeated scenarios, names, surface settings, argument structures, correct-answer patterns, distractor patterns, and category mislabeling. Do not compare by copying from official tests. Recommend which items should be revised or replaced to improve variety without reducing quality.

---

## 12. Rules for using official tests as a benchmark

When the user studies official tests in LawHub:
- Record only high-level observations in a separate benchmark log.
- Example acceptable note: “This item tests whether the reader can distinguish a necessary assumption from a claim that merely strengthens the argument.”
- Do not record the original stimulus, exact answer choices, or a close paraphrase.
- Do not ask ChatGPT to generate a near-copy from a question number or screenshot.
- Do not use official answer keys as an answer source for app content.
- Do not infer that a generated item is equivalent in difficulty just because it has similar length or a similar label.
- Use independent, qualitative calibration and human review.

Suggested benchmark-log fields:
- Date observed.
- Official source name (e.g., LawHub practice session).
- Broad skill category.
- General structural observation in abstract terms.
- UI/interaction observation.
- No copied text or protected content.
- Reviewer initials.

---

## 13. Release and maintenance

Before each content release:
1. Run schema validation.
2. Confirm every question has exactly five choices.
3. Confirm the keyed choice exists.
4. Confirm every choice has an explanation.
5. Confirm every RC item points to a valid passage.
6. Confirm every item is approved.
7. Run duplicate and near-duplicate checks within the original app bank.
8. Re-run independent solve on changed items.
9. Record content package version and release notes.
10. Preserve retired questions and historical attempts; do not silently rewrite the user's past sessions.

If a defect is found after release:
- Mark the item for review immediately.
- Stop selecting it for new sessions if correctness is in doubt.
- Preserve the historical attempt record.
- Fix or retire it through a versioned content update.
- Document the correction.

---

## 14. Disclaimer and product naming

The app should include a modest disclaimer in About or Settings:

> LSAT Prep is an independent, unofficial study application. It is not affiliated with, endorsed by, or sponsored by the Law School Admission Council (LSAC). Questions in this application are original practice materials unless otherwise explicitly identified and licensed.

Do not use LSAC logos or official branding in the app icon, splash screen, or marketing. Use “LSAT-style practice” rather than “official LSAT questions” when describing original content.

---

## 15. Final operating rule

**ChatGPT may draft. ChatGPT may critique. ChatGPT may not self-certify.**

A question is not ready because an AI says it is good. It is ready only after:
- the reasoning has been independently checked,
- the answer is uniquely defensible,
- all distractors have been audited,
- the explanations are complete,
- provenance is clean,
- and a human reviewer approves it.

When uncertain, reject or revise the item. The reputation of the app depends more on trustworthiness than on the size of its question bank.
