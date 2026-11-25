import { defaultCategories } from './categories'
import { LIMITS } from './limits'
import {
  CHOICE_LABELS,
  DIFFICULTIES,
  ORIGINS,
  PACKAGE_FORMAT,
  SCHEMA_VERSION,
  SECTIONS,
  type Category,
  type ContentPackage,
  type Passage,
  type Provenance,
  type Question,
  type Section,
} from './types'

export type IssueCode =
  | 'file_too_large'
  | 'not_utf8'
  | 'not_json'
  | 'unsupported_format'
  | 'missing_field'
  | 'unknown_field'
  | 'wrong_type'
  | 'invalid_value'
  | 'too_long'
  | 'too_many'
  | 'unsafe_text'
  | 'duplicate'
  | 'bad_reference'
  | 'not_approved'
  | 'unused_passage'

export interface Issue {
  code: IssueCode
  /** Where the problem is, e.g. `questions[2].prompt`. */
  path: string
  /** Plain-language explanation for the user. */
  message: string
}

export type ValidationResult =
  | { ok: true; package: ContentPackage; warnings: Issue[] }
  | { ok: false; errors: Issue[]; errorCount: number; warnings: Issue[] }

/** Content already in the app that a package may refer to. */
export interface ValidationContext {
  categories: readonly Pick<Category, 'id' | 'section'>[]
  approvedPassageIds: ReadonlySet<string>
}

const defaultContext: ValidationContext = {
  categories: defaultCategories,
  approvedPassageIds: new Set(),
}

type JsonObject = Record<string, unknown>

const ID_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/
const VERSION_PATTERN = /^\d{1,6}\.\d{1,6}\.\d{1,6}$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/
// Package text is always displayed as plain text; this is an extra check that also
// catches content pasted from web pages. Plain uses of "<" remain allowed.
const HTML_PATTERN =
  /<\s*[/!]?\s*(?:(?:script|iframe|object|embed|svg|img|style|link|meta|html|head|body|div|span|form|input|button|video|audio|base|template)(?=[\s/>])|(?:p|br|a)(?:\s+[a-z-]+\s*=|\s*\/?>))/i

/** Control characters and invisible direction overrides can disguise text. */
function hasUnsafeCharacters(text: string): boolean {
  for (const character of text) {
    const code = character.codePointAt(0)!
    if (code < 0x20 && code !== 0x0a && code !== 0x09) return true
    if (code >= 0x7f && code <= 0x9f) return true
    if (code >= 0x202a && code <= 0x202e) return true
    if (code >= 0x2066 && code <= 0x2069) return true
    if (code >= 0xd800 && code <= 0xdfff) return true
  }
  return false
}

/** Shortens untrusted text before it appears in a message. */
function quote(value: unknown): string {
  if (Array.isArray(value)) return 'a list'
  if (typeof value === 'object' && value !== null) return 'an object'
  const text = String(value)
  const short = text.length > 60 ? `${Array.from(text.slice(0, 120)).slice(0, 60).join('')}…` : text
  return `“${hasUnsafeCharacters(short) ? '(unreadable text)' : short}”`
}

/**
 * Checks values and records problems. A failed check returns a harmless stand-in so
 * checking can continue; the data is only used if no errors were recorded.
 */
class Checker {
  readonly errors: Issue[] = []
  readonly warnings: Issue[] = []
  errorCount = 0

  error(code: IssueCode, path: string, message: string) {
    this.errorCount++
    if (this.errors.length < LIMITS.reportedIssues) this.errors.push({ code, path, message })
  }

  warn(code: IssueCode, path: string, message: string) {
    if (this.warnings.length < LIMITS.reportedIssues) this.warnings.push({ code, path, message })
  }

  /** Requires an object with exactly these fields. */
  object(value: unknown, path: string, fields: readonly string[]): JsonObject {
    if (value === undefined) return {} // already reported as missing
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      this.error('wrong_type', path, 'This must be an object with named fields.')
      return {}
    }
    const object = value as JsonObject
    for (const field of fields) {
      if (!Object.hasOwn(object, field)) {
        this.error('missing_field', join(path, field), `The required field “${field}” is missing.`)
      }
    }
    for (const field of Object.keys(object)) {
      if (!fields.includes(field)) {
        this.error('unknown_field', path, `The field ${quote(field)} is not part of this format.`)
      }
    }
    return object
  }

  array(value: unknown, path: string, max: number): unknown[] {
    if (value === undefined) return []
    if (!Array.isArray(value)) {
      this.error('wrong_type', path, 'This must be a list.')
      return []
    }
    if (value.length > max) {
      this.error('too_many', path, `This list has ${value.length} items; the limit is ${max}.`)
      return []
    }
    return value
  }

  text(value: unknown, path: string, max: number, allowEmpty = false): string {
    if (value === undefined) return ''
    if (typeof value !== 'string') {
      this.error('wrong_type', path, 'This must be text.')
      return ''
    }
    if (value.length > max) {
      this.error('too_long', path, `This text is ${value.length} characters; the limit is ${max}.`)
      return ''
    }
    if (!allowEmpty && value.trim() === '') {
      this.error('invalid_value', path, 'This text must not be empty.')
    }
    if (hasUnsafeCharacters(value)) {
      this.error('unsafe_text', path, 'This text contains hidden or control characters.')
    }
    if (HTML_PATTERN.test(value)) {
      this.error('unsafe_text', path, 'This text contains HTML. Only plain text is allowed.')
    }
    return value
  }

  id(value: unknown, path: string): string {
    const id = this.text(value, path, LIMITS.id, true)
    if (typeof value === 'string' && value.length <= LIMITS.id && !ID_PATTERN.test(id)) {
      this.error(
        'invalid_value',
        path,
        `${quote(id)} is not a valid ID. Use lowercase letters and numbers, separated by single hyphens or underscores.`,
      )
    }
    return id
  }

  integer(value: unknown, path: string, min: number, max: number): number {
    if (value === undefined) return min
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
      this.error('invalid_value', path, `This must be a whole number from ${min} to ${max}.`)
      return min
    }
    return value
  }

  oneOf<T extends string | number>(value: unknown, path: string, allowed: readonly T[]): T {
    if (value !== undefined && !allowed.includes(value as T)) {
      this.error('invalid_value', path, `${quote(value)} is not allowed. Use: ${allowed.join(', ')}.`)
    }
    return allowed.includes(value as T) ? (value as T) : allowed[0]
  }

  /** Requires an approval value, and names the item when it is missing. */
  approval<T extends string>(value: unknown, path: string, required: T, item: string): T {
    if (value !== undefined && value !== required) {
      this.error(
        'not_approved',
        path,
        `${item} is not approved: this must be “${required}”, not ${quote(value)}.`,
      )
    }
    return required
  }

  unique(ids: readonly string[], listPath: string, idField: string, what: string) {
    const seen = new Set<string>()
    ids.forEach((id, index) => {
      if (id === '') return
      if (seen.has(id)) {
        const path = `${listPath}[${index}]${idField}`
        this.error('duplicate', path, `The ${what} ${quote(id)} appears more than once.`)
      }
      seen.add(id)
    })
  }
}

function join(path: string, field: string) {
  return path === '' ? field : `${path}.${field}`
}

function failure(code: IssueCode, path: string, message: string): ValidationResult {
  return { ok: false, errors: [{ code, path, message }], errorCount: 1, warnings: [] }
}

/** Validates the raw bytes of a package file. Has no side effects. */
export function validatePackageBytes(
  bytes: Uint8Array,
  context: ValidationContext = defaultContext,
): ValidationResult {
  if (bytes.byteLength > LIMITS.fileBytes) {
    const limit = LIMITS.fileBytes / 1024 / 1024
    return failure('file_too_large', '', `This file is larger than the ${limit} MB limit.`)
  }

  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return failure('not_utf8', '', 'This file is not readable UTF-8 text.')
  }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return failure('not_json', '', 'This file is not valid JSON. It may be damaged or incomplete.')
  }

  return validatePackageData(data, context)
}

/** Validates parsed JSON. Exported for testing; files go through validatePackageBytes. */
export function validatePackageData(
  data: unknown,
  context: ValidationContext = defaultContext,
): ValidationResult {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return failure('unsupported_format', '', 'This file is not an LSAT Prep question package.')
  }
  // Check the version first: other rules only make sense for a known version.
  const envelope = data as JsonObject
  if (envelope.format !== PACKAGE_FORMAT) {
    return failure('unsupported_format', 'format', 'This file is not an LSAT Prep question package.')
  }
  if (envelope.schema_version !== SCHEMA_VERSION) {
    return failure(
      'unsupported_format',
      'schema_version',
      `This package uses format version ${quote(envelope.schema_version)}; this app supports version ${SCHEMA_VERSION}.`,
    )
  }

  const check = new Checker()
  const root = check.object(data, '', [
    'format',
    'schema_version',
    'package_id',
    'package_version',
    'display_name',
    'created_at',
    'categories',
    'passages',
    'questions',
  ])

  const result: ContentPackage = {
    format: PACKAGE_FORMAT,
    schema_version: SCHEMA_VERSION,
    package_id: check.id(root.package_id, 'package_id'),
    package_version: readVersion(check, root.package_version),
    display_name: check.text(root.display_name, 'display_name', LIMITS.shortText),
    created_at: readDate(check, root.created_at),
    categories: check
      .array(root.categories, 'categories', LIMITS.categories)
      .map((item, index) => readCategory(check, item, `categories[${index}]`)),
    passages: check
      .array(root.passages, 'passages', LIMITS.passages)
      .map((item, index) => readPassage(check, item, `passages[${index}]`)),
    questions: check
      .array(root.questions, 'questions', LIMITS.questions)
      .map((item, index) => readQuestion(check, item, `questions[${index}]`)),
  }

  if (Array.isArray(root.questions) && root.questions.length === 0) {
    check.error('invalid_value', 'questions', 'The package must contain at least one question.')
  }
  checkRelationships(check, result, context)

  return check.errorCount === 0
    ? { ok: true, package: result, warnings: check.warnings }
    : { ok: false, errors: check.errors, errorCount: check.errorCount, warnings: check.warnings }
}

function readVersion(check: Checker, value: unknown): string {
  const version = check.text(value, 'package_version', LIMITS.shortText, true)
  if (typeof value === 'string' && !VERSION_PATTERN.test(version)) {
    check.error('invalid_value', 'package_version', 'Use a version such as 1.0.0.')
  }
  return version
}

function readDate(check: Checker, value: unknown): string {
  const date = check.text(value, 'created_at', LIMITS.shortText, true)
  if (typeof value !== 'string') return date
  const parsed = DATE_PATTERN.test(date) ? new Date(date) : null
  // Comparing the round trip rejects impossible dates such as February 30.
  const valid =
    parsed !== null &&
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString() === date.replace('Z', '.000Z')
  if (!valid) {
    check.error('invalid_value', 'created_at', 'Use a real UTC date such as 2026-11-24T12:00:00Z.')
  }
  return date
}

function readCategory(check: Checker, value: unknown, path: string): Category {
  const item = check.object(value, path, ['id', 'section', 'name', 'description', 'sort_order'])
  return {
    id: check.id(item.id, `${path}.id`),
    section: check.oneOf(item.section, `${path}.section`, SECTIONS),
    name: check.text(item.name, `${path}.name`, LIMITS.shortText),
    description: check.text(item.description, `${path}.description`, LIMITS.notes, true),
    sort_order: check.integer(item.sort_order, `${path}.sort_order`, 0, 1_000_000),
  }
}

function readProvenance(check: Checker, value: unknown, path: string): Provenance {
  const item = check.object(value, path, [
    'origin',
    'source_material_used',
    'authoring_batch',
    'license_reference',
  ])
  const origin = check.oneOf(item.origin, `${path}.origin`, ORIGINS)
  const licensePath = `${path}.license_reference`
  let license: string | null = null
  if (item.license_reference !== null) {
    license = check.text(item.license_reference, licensePath, LIMITS.notes)
    if (item.license_reference !== undefined && item.origin !== 'licensed') {
      check.error('invalid_value', licensePath, 'Use null unless the content is licensed.')
    }
  } else if (item.origin === 'licensed') {
    check.error('invalid_value', licensePath, 'Licensed content must include its license reference.')
  }
  return {
    origin,
    source_material_used: check.text(
      item.source_material_used,
      `${path}.source_material_used`,
      LIMITS.notes,
    ),
    authoring_batch: check.text(item.authoring_batch, `${path}.authoring_batch`, LIMITS.shortText),
    license_reference: license,
  }
}

function readPassage(check: Checker, value: unknown, path: string): Passage {
  const item = check.object(value, path, [
    'id',
    'title',
    'passage_type',
    'texts',
    'content_version',
    'status',
    'provenance',
  ])
  const type = check.oneOf(item.passage_type, `${path}.passage_type`, ['single', 'comparative'])
  const labels = type === 'comparative' ? (['A', 'B'] as const) : (['A'] as const)
  const texts = check.array(item.texts, `${path}.texts`, 2)
  if (Array.isArray(item.texts) && item.texts.length !== labels.length) {
    check.error(
      'invalid_value',
      `${path}.texts`,
      `A ${type} passage must have exactly ${labels.length} text${labels.length === 1 ? '' : 's'}.`,
    )
  }
  return {
    id: check.id(item.id, `${path}.id`),
    title: check.text(item.title, `${path}.title`, LIMITS.shortText),
    passage_type: type,
    texts: texts.map((entry, index) => {
      const textPath = `${path}.texts[${index}]`
      const text = check.object(entry, textPath, ['label', 'text'])
      const label = labels[index] ?? 'A'
      return {
        label: check.oneOf(text.label, `${textPath}.label`, [label]),
        text: check.text(text.text, `${textPath}.text`, LIMITS.passage),
      }
    }),
    content_version: check.integer(item.content_version, `${path}.content_version`, 1, 1_000_000),
    status: check.approval(item.status, `${path}.status`, 'approved', `Passage ${quote(item.id)}`),
    provenance: readProvenance(check, item.provenance, `${path}.provenance`),
  }
}

function readQuestion(check: Checker, value: unknown, path: string): Question {
  const item = check.object(value, path, [
    'id',
    'section',
    'primary_category',
    'secondary_tags',
    'difficulty',
    'stimulus',
    'prompt',
    'choices',
    'correct_choice',
    'explanations',
    'estimated_time_seconds',
    'passage_id',
    'content_version',
    'provenance',
    'quality',
  ])
  const section = check.oneOf(item.section, `${path}.section`, SECTIONS)
  const tags = check
    .array(item.secondary_tags, `${path}.secondary_tags`, LIMITS.tags)
    .map((tag, index) => check.id(tag, `${path}.secondary_tags[${index}]`))
  check.unique(tags, `${path}.secondary_tags`, '', 'tag')

  const explanations = check.object(item.explanations, `${path}.explanations`, CHOICE_LABELS)
  const readExplanation = (label: string) =>
    check.text(explanations[label], `${path}.explanations.${label}`, LIMITS.explanation)

  const name = `Question ${quote(item.id)}`
  const quality = check.object(item.quality, `${path}.quality`, [
    'draft_status',
    'independent_solve',
    'ambiguity_review',
    'human_review',
    'reviewer_notes',
  ])
  const passed = (field: string) =>
    check.approval(quality[field], `${path}.quality.${field}`, 'passed', name)

  return {
    id: check.id(item.id, `${path}.id`),
    section,
    primary_category: check.id(item.primary_category, `${path}.primary_category`),
    secondary_tags: tags,
    difficulty: check.oneOf(item.difficulty, `${path}.difficulty`, DIFFICULTIES),
    ...readSectionFields(check, item, path, section),
    prompt: check.text(item.prompt, `${path}.prompt`, LIMITS.prompt),
    choices: readChoices(check, item.choices, `${path}.choices`),
    correct_choice: check.oneOf(item.correct_choice, `${path}.correct_choice`, CHOICE_LABELS),
    explanations: {
      A: readExplanation('A'),
      B: readExplanation('B'),
      C: readExplanation('C'),
      D: readExplanation('D'),
      E: readExplanation('E'),
    },
    estimated_time_seconds:
      item.estimated_time_seconds === null
        ? null
        : check.integer(item.estimated_time_seconds, `${path}.estimated_time_seconds`, 10, 1800),
    content_version: check.integer(item.content_version, `${path}.content_version`, 1, 1_000_000),
    provenance: readProvenance(check, item.provenance, `${path}.provenance`),
    quality: {
      draft_status: check.approval(
        quality.draft_status,
        `${path}.quality.draft_status`,
        'approved',
        name,
      ),
      independent_solve: passed('independent_solve'),
      ambiguity_review: passed('ambiguity_review'),
      human_review: passed('human_review'),
      reviewer_notes: check.text(
        quality.reviewer_notes,
        `${path}.quality.reviewer_notes`,
        LIMITS.notes,
        true,
      ),
    },
  }
}

/** LR has a stimulus and no passage; RC has a passage and no stimulus. */
function readSectionFields(check: Checker, item: JsonObject, path: string, section: Section) {
  const mustBeNull = (field: string, reason: string) => {
    if (item[field] !== undefined && item[field] !== null) {
      check.error('invalid_value', `${path}.${field}`, reason)
    }
    return null
  }
  if (section === 'logical_reasoning') {
    return {
      stimulus: check.text(item.stimulus, `${path}.stimulus`, LIMITS.stimulus),
      passage_id: mustBeNull('passage_id', 'A Logical Reasoning question must use null here.'),
    }
  }
  return {
    stimulus: mustBeNull('stimulus', 'A Reading Comprehension question must use null here.'),
    passage_id: check.id(item.passage_id, `${path}.passage_id`),
  }
}

function readChoices(check: Checker, value: unknown, path: string): Question['choices'] {
  const items = check.array(value, path, CHOICE_LABELS.length)
  if (Array.isArray(value) && value.length < CHOICE_LABELS.length) {
    check.error('invalid_value', path, 'There must be exactly five choices, A through E.')
  }
  const choices = items.map((entry, index) => {
    const choicePath = `${path}[${index}]`
    const choice = check.object(entry, choicePath, ['label', 'text'])
    return {
      label: check.oneOf(choice.label, `${choicePath}.label`, [CHOICE_LABELS[index]]),
      text: check.text(choice.text, `${choicePath}.text`, LIMITS.choice),
    }
  })
  const normalized = choices.map(({ text }) => text.trim().replace(/\s+/g, ' ').toLowerCase())
  check.unique(normalized, path, '.text', 'choice text')
  return choices
}

/** Checks that need the whole package: duplicate IDs and references between items. */
function checkRelationships(check: Checker, data: ContentPackage, context: ValidationContext) {
  const ids = (items: readonly { id: string }[]) => items.map(({ id }) => id)
  check.unique(ids(data.categories), 'categories', '.id', 'category ID')
  check.unique(ids(data.passages), 'passages', '.id', 'passage ID')
  check.unique(ids(data.questions), 'questions', '.id', 'question ID')

  const sections = new Map(context.categories.map(({ id, section }) => [id, section]))
  data.categories.forEach(({ id, section }, index) => {
    const existing = sections.get(id)
    if (existing !== undefined && existing !== section) {
      check.error(
        'bad_reference',
        `categories[${index}].section`,
        `Category ${quote(id)} already exists in the other section.`,
      )
    } else {
      sections.set(id, section)
    }
  })

  const packagePassages = new Set(ids(data.passages))
  const usedPassages = new Set<string>()
  data.questions.forEach((question, index) => {
    const path = `questions[${index}]`
    const { primary_category: category, passage_id: passage } = question
    if (category !== '') {
      const section = sections.get(category)
      if (section === undefined) {
        check.error(
          'bad_reference',
          `${path}.primary_category`,
          `Category ${quote(category)} does not exist.`,
        )
      } else if (section !== question.section) {
        check.error(
          'bad_reference',
          `${path}.primary_category`,
          `Category ${quote(category)} belongs to the other section.`,
        )
      }
    }
    if (passage !== null && passage !== '') {
      usedPassages.add(passage)
      if (!packagePassages.has(passage) && !context.approvedPassageIds.has(passage)) {
        check.error(
          'bad_reference',
          `${path}.passage_id`,
          `Passage ${quote(passage)} was not found in this package or in the app.`,
        )
      }
    }
  })
  data.passages.forEach(({ id }, index) => {
    if (!usedPassages.has(id)) {
      check.warn('unused_passage', `passages[${index}]`, `Passage ${quote(id)} has no questions.`)
    }
  })
}
