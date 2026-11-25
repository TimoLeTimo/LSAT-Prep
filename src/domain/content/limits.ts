/** Upper bounds for untrusted package files. Text lengths are in characters. */
export const LIMITS = {
  fileBytes: 20 * 1024 * 1024,
  categories: 200,
  passages: 500,
  questions: 2000,
  tags: 20,
  id: 100,
  shortText: 200,
  notes: 4000,
  stimulus: 5000,
  prompt: 2000,
  choice: 1000,
  explanation: 4000,
  passage: 12000,
  reportedIssues: 500,
} as const
