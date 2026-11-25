import { expect, it } from 'vitest'
import { formatTime, timeNotice } from './formatTime'

it.each([
  [0, '0:00'],
  [1, '0:01'],
  [59_000, '0:59'],
  [59_001, '1:00'],
  [245_000, '4:05'],
  [3_723_000, '1:02:03'],
])('formats %i ms as %s', (ms, expected) => {
  expect(formatTime(ms)).toBe(expected)
})

it.each([
  [300_001, 2100, ''],
  [300_000, 2100, 'Less than 5 minutes left'],
  [60_001, 2100, 'Less than 5 minutes left'],
  [60_000, 2100, 'Less than 1 minute left'],
  [0, 2100, 'Less than 1 minute left'],
  [200_000, 300, ''],
  [60_000, 300, 'Less than 1 minute left'],
  [30_000, 60, ''],
])('with %i ms of %i s left, says "%s"', (remaining, limit, expected) => {
  expect(timeNotice(remaining, limit)).toBe(expected)
})
