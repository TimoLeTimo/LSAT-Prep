import { AppFrame } from './app/AppFrame'
import { MainMenu } from './app/MainMenu'
import { destinations, type Route } from './app/routes'
import { useRoute } from './app/useRoute'
import { PlaceholderScreen } from './components/PlaceholderScreen'
import type { Section } from './domain/content/types'
import { BackupScreen } from './features/backup/BackupScreen'
import { PracticeTestsScreen } from './features/exam/PracticeTestsScreen'
import { PracticeScreen } from './features/practice/PracticeScreen'
import { QuestionBankScreen } from './features/question-bank/QuestionBankScreen'
import { ReviewScreen } from './features/review/ReviewScreen'
import { SettingsScreen } from './features/settings/SettingsScreen'

const otherTitles: Partial<Record<Route, string>> = {
  settings: 'Settings',
  'question-bank': 'Question Bank Management',
  backup: 'Backup and Restore',
}

const practiceSections: Partial<Record<Route, Section | null>> = {
  'logical-reasoning': 'logical_reasoning',
  'reading-comprehension': 'reading_comprehension',
  'custom-practice': null,
}

function App() {
  const route = useRoute()
  const destination = destinations.find(({ id }) => id === route)
  const practiceSection = practiceSections[route]
  const title = destination?.title ?? otherTitles[route] ?? 'Main Menu'

  return (
    <AppFrame route={route} title={title}>
      {route === 'menu' && <MainMenu />}
      {route === 'settings' && <SettingsScreen />}
      {route === 'question-bank' && <QuestionBankScreen />}
      {route === 'backup' && <BackupScreen />}
      {practiceSection !== undefined && <PracticeScreen key={route} section={practiceSection} />}
      {route === 'practice-tests' && <PracticeTestsScreen />}
      {route === 'review' && <ReviewScreen />}
      {route === 'statistics' && <PlaceholderScreen title={title} />}
    </AppFrame>
  )
}

export default App
