# Statistics Definitions

Calculated in `src/domain/statistics/` from the saved answers and sessions. Nothing is stored twice,
so every number can be rebuilt. An answer is described as it was when answered, even if the question
was later changed or retired.

| Measure | Definition |
|---|---|
| Answers | Every submitted answer, including the same question answered again in another session |
| Different questions | How many separate questions those answers cover |
| Accuracy | Correct answers ÷ answers. Unanswered questions are not answers |
| Average time | Mean recorded time of answers that have one |
| Practice time | Session clock time, plus exam section time. Pauses and breaks are left out |
| Section, category, difficulty | The same, for part of the answers |
| By week | Weeks start on Monday, in the computer's time zone. Weeks with no answers are shown as empty |
| Retries | Answers given in a Review session to a question answered before. Counted separately, and in no other measure except practice time |
| Most recent answer | Any answer, including a retry. Used for "missed" |
| Exam raw score | Correct scored questions ÷ scored questions. Unanswered ones earn no point |

- Unscored exam questions count as answers, because they were answered, but not in raw scores.
- If a session is ended early, only answers already checked count.
- A question answered for the first time in Review, such as a bookmarked one, is not a retry.
- The average time of an answer stops at submission. It leaves out time with the window hidden.
- No scaled score is given.
