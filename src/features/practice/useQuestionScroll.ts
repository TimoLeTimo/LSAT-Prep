import { useEffect, type RefObject } from 'react'

interface QuestionRefs {
  screen: RefObject<HTMLElement | null>
  questionPane: RefObject<HTMLElement | null>
  heading: RefObject<HTMLElement | null>
}

/**
 * A new question starts at the top, with keyboard focus on its heading. Beside a passage,
 * only the question's side returns to the top.
 */
export function useQuestionScroll(refs: QuestionRefs, position: number, hasPassage: boolean) {
  const { screen, questionPane, heading } = refs
  useEffect(() => {
    questionPane.current?.scrollTo(0, 0)
    if (hasPassage) screen.current?.scrollIntoView({ block: 'start' })
    else window.scrollTo(0, 0)
    heading.current?.focus({ preventScroll: true })
  }, [screen, questionPane, heading, position, hasPassage])
}
