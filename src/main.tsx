import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DatabaseProblem } from './app/DatabaseProblem.tsx'
import { getDatabaseProblem } from './data/database.ts'

// Check saved data first, so the app never runs without it.
const problem = await getDatabaseProblem()

createRoot(document.getElementById('root')!).render(
  <StrictMode>{problem === null ? <App /> : <DatabaseProblem message={problem} />}</StrictMode>,
)
