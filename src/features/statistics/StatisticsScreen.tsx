import { isTauri } from '@tauri-apps/api/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { routeHref } from '../../app/routes'
import { BackLink } from '../../components/BackLink'
import { Button } from '../../components/Button'
import { PageHeading } from '../../components/PageHeading'
import { SelectField } from '../../components/SelectField'
import { errorMessage } from '../../data/errorMessage'
import type { Exam } from '../../data/exam'
import { recordsApi, type Records, type SessionRecord } from '../../data/records'
import { difficultyNames, sectionNames } from '../../domain/content/names'
import type { Section } from '../../domain/content/types'
import {
  byCategory,
  byDifficulty,
  bySection,
  byWeek,
  examHistory,
  overview,
  sessionHistory,
} from '../../domain/statistics/calculate'
import { filterRecords, type StatisticsFilter } from '../../domain/statistics/filterRecords'
import { ExamResults } from '../exam/ExamResults'
import { AccuracyTable } from './AccuracyTable'
import { Card } from './Card'
import { ExamList } from './ExamList'
import { OverviewTiles } from './OverviewTiles'
import { SessionList } from './SessionList'
import { WeeklyChart } from './WeeklyChart'

export function StatisticsScreen() {
  return (
    <>
      <BackLink href={routeHref('menu')}>Main Menu</BackLink>
      <PageHeading>Statistics</PageHeading>
      <div className="mt-8">
        {isTauri() ? (
          <Statistics />
        ) : (
          <p className="text-muted">Statistics are only available in the desktop app.</p>
        )}
      </div>
    </>
  )
}

function Statistics() {
  const [records, setRecords] = useState<Records | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exam, setExam] = useState<Exam | null>(null)
  const [examError, setExamError] = useState<string | null>(null)
  const [filter, setFilter] = useState<StatisticsFilter>({ days: null, section: null })
  const isOpening = useRef(false)

  const load = useCallback(() => {
    recordsApi.records().then(
      (found) => {
        setRecords(found)
        setError(null)
      },
      (reason) => setError(errorMessage(reason, 'Statistics could not be read.')),
    )
  }, [])
  useEffect(load, [load])

  function openExam({ id }: SessionRecord) {
    if (isOpening.current) return
    isOpening.current = true
    setExamError(null)
    recordsApi
      .examResults(id)
      .then(setExam, (reason) =>
        setExamError(errorMessage(reason, 'The test could not be opened.')),
      )
      .finally(() => {
        isOpening.current = false
      })
  }

  if (exam !== null) return <ExamResults exam={exam} onDone={() => setExam(null)} />
  return (
    <>
      {error !== null && (
        <div role="alert" className="mb-6 rounded-lg border border-rose-accent bg-blush p-4">
          <p>{error}</p>
          <div className="mt-3">
            <Button onClick={load}>Try Again</Button>
          </div>
        </div>
      )}
      {records === null ? (
        error === null && <p role="status">Loading…</p>
      ) : records.sessions.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-8 text-muted shadow-card">
          Nothing to show yet. Statistics appear after you practice.
        </p>
      ) : (
        <Report
          records={records}
          filter={filter}
          onFilter={setFilter}
          onOpenExam={openExam}
          examError={examError}
        />
      )}
    </>
  )
}

interface ReportProps {
  records: Records
  filter: StatisticsFilter
  onFilter: (filter: StatisticsFilter) => void
  onOpenExam: (exam: SessionRecord) => void
  examError: string | null
}

function Report({ records, filter, onFilter, onOpenExam, examError }: ReportProps) {
  // Fixed while the screen is open, so every number uses the same moment.
  const [now] = useState(() => new Date())
  const { answers, sessions } = useMemo(
    () => filterRecords(records, filter, now),
    [records, filter, now],
  )
  const report = useMemo(
    () => ({
      overview: overview(answers, sessions),
      sections: bySection(answers).map((group) => ({ ...group, label: sectionNames[group.key] })),
      weeks: byWeek(answers),
      categories: byCategory(answers),
      difficulties: byDifficulty(answers).map((group) => ({
        ...group,
        label: difficultyNames[group.key],
      })),
      exams: examHistory(sessions),
      history: sessionHistory(sessions),
    }),
    [answers, sessions],
  )
  const inSection = (section: Section) =>
    report.categories.filter((category) => category.section === section)

  return (
    <div className="space-y-6">
      <div className="grid max-w-xl gap-4 sm:grid-cols-2">
        <SelectField
          label="Period"
          value={String(filter.days ?? '')}
          onChange={(value) =>
            onFilter({ ...filter, days: value === '30' ? 30 : value === '90' ? 90 : null })
          }
        >
          <option value="">All time</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </SelectField>
        <SelectField
          label="Section"
          value={filter.section ?? ''}
          onChange={(value) =>
            onFilter({ ...filter, section: value === '' ? null : (value as Section) })
          }
        >
          <option value="">All sections</option>
          <option value="logical_reasoning">{sectionNames.logical_reasoning}</option>
          <option value="reading_comprehension">{sectionNames.reading_comprehension}</option>
        </SelectField>
      </div>

      <h2 className="sr-only">Overview</h2>
      <OverviewTiles overview={report.overview} isOneSection={filter.section !== null} />

      {filter.section === null && (
        <Card id="by-section" title="Logical Reasoning and Reading Comprehension">
          <AccuracyTable caption="Accuracy by section" heading="Section" rows={report.sections} />
        </Card>
      )}
      <Card id="by-week" title="By Week" note="Weeks start on Monday. Retries are not included.">
        <WeeklyChart weeks={report.weeks} />
      </Card>
      {(['logical_reasoning', 'reading_comprehension'] as const)
        .filter((section) => filter.section === null || filter.section === section)
        .map((section) => (
          <Card key={section} id={`categories-${section}`} title={`${sectionNames[section]} Categories`}>
            <AccuracyTable
              caption={`${sectionNames[section]} accuracy by category`}
              heading="Category"
              rows={inSection(section)}
            />
          </Card>
        ))}
      <Card id="by-difficulty" title="By Difficulty">
        <AccuracyTable caption="Accuracy by difficulty" heading="Difficulty" rows={report.difficulties} />
      </Card>
      <Card
        id="exams"
        title="Practice Tests"
        note="Raw scores of scored questions. Choose one to review it. Not limited by section."
      >
        {examError !== null && (
          <p role="alert" className="mb-4 rounded-lg border border-rose-accent bg-blush p-4">
            {examError}
          </p>
        )}
        <ExamList exams={report.exams} onOpen={onOpenExam} />
      </Card>
      <Card
        id="sessions"
        title="Session History"
        note={
          filter.section === null
            ? undefined
            : 'Sessions that mix sections are included, with all of their answers.'
        }
      >
        <SessionList key={`${filter.days}-${filter.section}`} sessions={report.history} />
      </Card>
    </div>
  )
}
