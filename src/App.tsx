import { AppFrame } from './app/AppFrame'
import { MainMenu } from './app/MainMenu'
import { destinations } from './app/routes'
import { useRoute } from './app/useRoute'
import { PlaceholderScreen } from './components/PlaceholderScreen'
import { SettingsScreen } from './features/settings/SettingsScreen'

function App() {
  const route = useRoute()
  const destination = destinations.find(({ id }) => id === route)
  const title = destination?.title ?? (route === 'settings' ? 'Settings' : 'Main Menu')

  return (
    <AppFrame route={route} title={title}>
      {route === 'menu' && <MainMenu />}
      {route === 'settings' && <SettingsScreen />}
      {destination && <PlaceholderScreen key={route} title={title} />}
    </AppFrame>
  )
}

export default App
