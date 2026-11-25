import validPackage from '../../../tests/fixtures/valid-package.json?raw'
import type { Section } from './types'

/**
 * TEST DATA ONLY. These are not practice questions and must never ship as content.
 * The Rust import tests use the same file. Values are loosely typed so tests can
 * break them in any way.
 */
// oxlint-disable-next-line typescript/no-explicit-any
type Loose = any

export function testPackage(): Loose {
  return JSON.parse(validPackage)
}

export function testQuestion(section: Section = 'logical_reasoning'): Loose {
  return testPackage().questions.find((question: Loose) => question.section === section)
}
