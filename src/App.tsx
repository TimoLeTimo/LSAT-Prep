import { AppFrame } from './app/AppFrame'
import { MainMenu } from './app/MainMenu'
import { destinations, type Route } from './app/routes'
import { useRoute } from './app/useRoute'
import { PlaceholderScreen } from './components/PlaceholderScreen'
import { QuestionBankScreen } from './features/question-bank/QuestionBankScreen'
import { SettingsScreen } from './features/settings/SettingsScreen'

const otherTitles: Partial<Record<Route, string>> = {
  settings: 'Settings',
  'question-bank': 'Question Bank Management',
}

function App() {
  const route = useRoute()
  const destination = destinations.find(({ id }) => id === route)
  const title = destination?.title ?? otherTitles[route] ?? 'Main Menu'

  return (
    <AppFrame route={route} title={title}>
      {route === 'menu' && <MainMenu />}
      {route === 'settings' && <SettingsScreen />}
      {route === 'question-bank' && <QuestionBankScreen />}
      {destination && <PlaceholderScreen key={route} title={title} />}
    </AppFrame>
  )
}

export default App
