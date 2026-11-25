import { expect, it } from 'vitest'
import sql from '../../../src-tauri/migrations/0001_initial.sql?raw'
import { defaultCategories } from './categories'

it('matches the categories in the first database migration', () => {
  const rows = [...sql.matchAll(/^ {2}\('((?:lr|rc)-[a-z-]+)', '([a-z_]+)', '((?:[^']|'')+)', (\d+)\)/gm)]
  const seeded = rows.map(([, id, section, name, order]) => ({
    id,
    section,
    name: name.replaceAll("''", "'"),
    description: '',
    sort_order: Number(order),
  }))
  expect(seeded).toEqual(defaultCategories)
})
