import { ThemeProvider } from './contexts/ThemeContext'
import LoginPage from './pages/auth/LoginPage'

function App() {
  return (
    <ThemeProvider>
      <LoginPage />
    </ThemeProvider>
  )
}

export default App
