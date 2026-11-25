import { useState } from 'react'
import { wholeNumber } from './wholeNumber'

const MAX_MINUTES = 360

export interface TimeLimit {
  isTimed: boolean
  setIsTimed: (value: boolean) => void
  minutes: string
  setMinutes: (value: string) => void
  problem: string | null
  /** Null when untimed. */
  seconds: number | null
  setSeconds: (seconds: number | null) => void
}

export function useTimeLimit(): TimeLimit {
  const [isTimed, setIsTimed] = useState(false)
  const [minutes, setMinutes] = useState('15')
  const number = wholeNumber(minutes) ?? 0
  const isValid = number >= 1 && number <= MAX_MINUTES
  return {
    isTimed,
    setIsTimed,
    minutes,
    setMinutes,
    problem:
      isTimed && !isValid ? `Enter a number of minutes from 1 to ${MAX_MINUTES}.` : null,
    seconds: isTimed ? number * 60 : null,
    setSeconds: (seconds) => {
      setIsTimed(seconds !== null)
      if (seconds !== null) setMinutes(String(seconds / 60))
    },
  }
}
