import { describe, expect, it } from 'vitest'
import { defaultCategories } from './categories'
import { LIMITS } from './limits'
import { testPackage, testQuestion } from './testPackage'
import { validatePackageBytes, validatePackageData, type IssueCode } from './validatePackage'

const encode = (text: string) => new TextEncoder().encode(text)
const validate = (data: unknown) => validatePackageBytes(encode(JSON.stringify(data)))

type Edit = (pkg: ReturnType<typeof testPackage>) => void

function edited(edit: Edit) {
  const pkg = testPackage()
  edit(pkg)
  return pkg
}

describe('valid packages', () => {
  it('accepts a package and returns the same data', () => {
    expect(validate(testPackage())).toEqual({ ok: true, package: testPackage(), warnings: [] })
  })

  it('accepts a UTF-8 byte order mark', () => {
    expect(validatePackageBytes(encode('﻿' + JSON.stringify(testPackage()))).ok).toBe(true)
  })

  const accepted: [string, Edit][] = [
    ['plain less-than signs', (p) => (p.questions[0].stimulus = 'If a < b and c > d, then x <y.')],
    ['accents, dashes and emoji', (p) => (p.questions[0].prompt = 'Café — “naïve” 🙂?')],
    ['line breaks and tabs', (p) => (p.questions[0].stimulus = 'One.\n\n\tTwo.')],
    ['a category defined in the package', (p) => (p.questions[0].primary_category = 'test-category')],
    ['no time estimate', (p) => (p.questions[0].estimated_time_seconds = null)],
    ['text exactly at its limit', (p) => (p.questions[0].prompt = 'x'.repeat(LIMITS.prompt))],
    ['a single passage', (p) => {
      p.passages[0].passage_type = 'single'
      p.passages[0].texts.pop()
    }],
    ['licensed content with its reference', (p) => {
      p.questions[0].provenance.origin = 'licensed'
      p.questions[0].provenance.license_reference = 'Test agreement 1'
    }],
  ]
  it.each(accepted)('accepts %s', (_, edit) => {
    expect(validate(edited(edit))).toMatchObject({ ok: true })
  })

  it('accepts a passage that is already in the app', () => {
    const pkg = edited((p) => (p.passages = []))
    const context = { categories: defaultCategories, approvedPassageIds: new Set(['test-passage-1']) }
    expect(validatePackageData(pkg, context).ok).toBe(true)
    expect(validatePackageData(pkg).ok).toBe(false)
  })

  it('warns about a passage with no questions', () => {
    const result = validate(edited((p) => p.questions.pop()))
    expect(result).toMatchObject({ ok: true, warnings: [{ code: 'unused_passage' }] })
  })
})

describe('invalid packages', () => {
  const rejected: [string, IssueCode, string, Edit][] = [
    ['another format', 'unsupported_format', 'format', (p) => (p.format = 'other')],
    ['a newer version', 'unsupported_format', 'schema_version', (p) => (p.schema_version = 2)],
    ['a version as text', 'unsupported_format', 'schema_version', (p) => (p.schema_version = '1')],
    ['a bad package ID', 'invalid_value', 'package_id', (p) => (p.package_id = '../Evil')],
    ['a bad package version', 'invalid_value', 'package_version', (p) => (p.package_version = 'v1')],
    ['an impossible date', 'invalid_value', 'created_at', (p) => (p.created_at = '2026-02-30T00:00:00Z')],
    ['no questions', 'invalid_value', 'questions', (p) => (p.questions = [])],
    ['questions that are not a list', 'wrong_type', 'questions', (p) => (p.questions = {})],
    ['a null question', 'wrong_type', 'questions[0]', (p) => (p.questions[0] = null)],
    ['a missing field', 'missing_field', 'questions[0].prompt', (p) => delete p.questions[0].prompt],
    ['an unknown field', 'unknown_field', 'questions[0]', (p) => (p.questions[0].extra = 1)],
    ['blank text', 'invalid_value', 'questions[0].prompt', (p) => (p.questions[0].prompt = '  ')],
    ['text that is a number', 'wrong_type', 'questions[0].prompt', (p) => (p.questions[0].prompt = 5)],
    ['an unknown section', 'invalid_value', 'questions[0].section', (p) => (p.questions[0].section = 'logic_games')],
    ['difficulty 5', 'invalid_value', 'questions[0].difficulty', (p) => (p.questions[0].difficulty = 5)],
    ['a bad time estimate', 'invalid_value', 'questions[0].estimated_time_seconds', (p) => (p.questions[0].estimated_time_seconds = 1.5)],
    ['four choices', 'invalid_value', 'questions[0].choices', (p) => p.questions[0].choices.pop()],
    ['six choices', 'too_many', 'questions[0].choices', (p) => p.questions[0].choices.push({ label: 'F', text: 'F' })],
    ['a repeated choice label', 'invalid_value', 'questions[0].choices[1].label', (p) => (p.questions[0].choices[1].label = 'A')],
    ['repeated choice text', 'duplicate', 'questions[0].choices[1].text', (p) => (p.questions[0].choices[1].text = ' test  CHOICE a')],
    ['a correct choice that does not exist', 'invalid_value', 'questions[0].correct_choice', (p) => (p.questions[0].correct_choice = 'F')],
    ['a missing explanation', 'missing_field', 'questions[0].explanations.D', (p) => delete p.questions[0].explanations.D],
    ['an empty explanation', 'invalid_value', 'questions[0].explanations.D', (p) => (p.questions[0].explanations.D = '')],
    ['LR without a stimulus', 'wrong_type', 'questions[0].stimulus', (p) => (p.questions[0].stimulus = null)],
    ['LR with a passage', 'invalid_value', 'questions[0].passage_id', (p) => (p.questions[0].passage_id = 'test-passage-1')],
    ['RC without a passage', 'wrong_type', 'questions[1].passage_id', (p) => (p.questions[1].passage_id = null)],
    ['RC with a stimulus', 'invalid_value', 'questions[1].stimulus', (p) => (p.questions[1].stimulus = 'x')],
    ['an unknown passage', 'bad_reference', 'questions[1].passage_id', (p) => (p.questions[1].passage_id = 'nope')],
    ['an unknown category', 'bad_reference', 'questions[0].primary_category', (p) => (p.questions[0].primary_category = 'nope')],
    ['a category from the other section', 'bad_reference', 'questions[0].primary_category', (p) => (p.questions[0].primary_category = 'rc-detail')],
    ['a category redefined in the other section', 'bad_reference', 'categories[0].section', (p) => (p.categories[0].id = 'rc-detail')],
    ['a duplicate question ID', 'duplicate', 'questions[2].id', (p) => p.questions.push(testQuestion())],
    ['a duplicate passage ID', 'duplicate', 'passages[1].id', (p) => p.passages.push(p.passages[0])],
    ['a duplicate category ID', 'duplicate', 'categories[1].id', (p) => p.categories.push(p.categories[0])],
    ['a duplicate tag', 'duplicate', 'questions[0].secondary_tags[1]', (p) => p.questions[0].secondary_tags.push('test_tag')],
    ['a comparative passage with one text', 'invalid_value', 'passages[0].texts', (p) => p.passages[0].texts.pop()],
    ['a single passage with two texts', 'invalid_value', 'passages[0].texts', (p) => (p.passages[0].passage_type = 'single')],
    ['an unapproved passage', 'not_approved', 'passages[0].status', (p) => (p.passages[0].status = 'draft')],
    ['a draft question', 'not_approved', 'questions[0].quality.draft_status', (p) => (p.questions[0].quality.draft_status = 'draft')],
    ['a failed independent solve', 'not_approved', 'questions[0].quality.independent_solve', (p) => (p.questions[0].quality.independent_solve = 'failed')],
    ['a pending ambiguity review', 'not_approved', 'questions[0].quality.ambiguity_review', (p) => (p.questions[0].quality.ambiguity_review = 'pending')],
    ['no human review', 'not_approved', 'questions[0].quality.human_review', (p) => (p.questions[0].quality.human_review = null)],
    ['an unknown origin', 'invalid_value', 'questions[0].provenance.origin', (p) => (p.questions[0].provenance.origin = 'copied')],
    ['licensed content without a reference', 'invalid_value', 'questions[0].provenance.license_reference', (p) => (p.questions[0].provenance.origin = 'licensed')],
  ]
  it.each(rejected)('rejects %s', (_, code, path, edit) => {
    const result = validate(edited(edit))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors).toContainEqual(expect.objectContaining({ code, path }))
  })

  it('rejects the whole package and names the unapproved question', () => {
    const result = validate(edited((p) => (p.questions[1].quality.draft_status = 'reviewed')))
    expect(result).not.toHaveProperty('package')
    expect(result).toMatchObject({ ok: false, errorCount: 1 })
    if (!result.ok) expect(result.errors[0].message).toContain('test-rc-1')
  })

  it('reports several problems at once', () => {
    const result = validate(edited((p) => {
      p.package_id = ''
      p.questions[0].difficulty = 9
      p.passages[0].title = ''
    }))
    expect(result).toMatchObject({ ok: false, errorCount: 3 })
  })
})

describe('untrusted files', () => {
  it('rejects an oversized file', () => {
    const result = validatePackageBytes(new Uint8Array(LIMITS.fileBytes + 1))
    expect(result).toMatchObject({ ok: false, errors: [{ code: 'file_too_large' }] })
  })

  it('rejects invalid UTF-8', () => {
    const result = validatePackageBytes(new Uint8Array([0x7b, 0xff, 0xfe]))
    expect(result).toMatchObject({ ok: false, errors: [{ code: 'not_utf8' }] })
  })

  it.each(['', '{', 'not json', '{"a":1,}'])('rejects malformed JSON: %j', (text) => {
    expect(validatePackageBytes(encode(text))).toMatchObject({ errors: [{ code: 'not_json' }] })
  })

  it.each(['null', '[]', '5', '"text"', '{}'])('rejects JSON that is not a package: %s', (text) => {
    expect(validatePackageBytes(encode(text))).toMatchObject({ errors: [{ code: 'unsupported_format' }] })
  })

  it.each([
    '<script>alert(1)</script>',
    '<script async src=x>',
    '<SCRIPT\n>',
    '<img src=x onerror=alert(1)>',
    '<svg/onload=alert(1)>',
    '<a href="javascript:alert(1)">x</a>',
    '</div>',
    'hidden‮text',
    'null\u0000byte',
    'escape\u001B[2J',
    'broken \uD800 text',
  ])('rejects unsafe text: %j', (text) => {
    const result = validate(edited((p) => (p.questions[0].stimulus = text)))
    expect(result).toMatchObject({ ok: false, errors: [{ code: 'unsafe_text' }] })
  })

  it('rejects over-long text and lists', () => {
    const result = validate(edited((p) => {
      p.questions[0].prompt = 'x'.repeat(LIMITS.prompt + 1)
      p.questions[0].secondary_tags = Array(LIMITS.tags + 1).fill('t')
      p.categories = Array(LIMITS.categories + 1).fill(null)
    }))
    if (result.ok) throw new Error('expected a failure')
    expect(result.errors.map(({ code }) => code).toSorted()).toEqual(['too_long', 'too_many', 'too_many'])
  })

  it('rejects __proto__ fields without changing any object', () => {
    const text = JSON.stringify(testPackage()).replace('{', '{"__proto__":{"polluted":true},')
    const result = validatePackageBytes(encode(text))
    expect(result).toMatchObject({ ok: false, errors: [{ code: 'unknown_field' }] })
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('does not crash on deep nesting', () => {
    const deep = '['.repeat(100_000) + ']'.repeat(100_000)
    const text = JSON.stringify(testPackage())
    for (const field of ['"schema_version":1', '"difficulty":2', '"draft_status":"approved"']) {
      const name = field.split(':')[0]
      expect(validatePackageBytes(encode(text.replace(field, `${name}:${deep}`))).ok).toBe(false)
    }
  })

  it('limits the number and length of reported errors', () => {
    const result = validate(edited((p) => {
      p.questions = Array(LIMITS.questions).fill(null)
      p.package_id = 'X'.repeat(90)
    }))
    if (result.ok) throw new Error('expected a failure')
    expect(result.errorCount).toBe(LIMITS.questions + 1)
    expect(result.errors).toHaveLength(LIMITS.reportedIssues)
    expect(result.errors[0].message.length).toBeLessThan(250)
  })

  it('does not change its input', () => {
    const pkg = edited((p) => (p.questions[0].difficulty = 9))
    const before = structuredClone(pkg)
    validatePackageData(pkg)
    expect(pkg).toEqual(before)
  })
})

describe('default categories', () => {
  it('has 16 LR and 12 RC categories with unique IDs', () => {
    const count = (section: string) => defaultCategories.filter((c) => c.section === section).length
    expect([count('logical_reasoning'), count('reading_comprehension')]).toEqual([16, 12])
    expect(new Set(defaultCategories.map(({ id }) => id)).size).toBe(28)
  })
})
