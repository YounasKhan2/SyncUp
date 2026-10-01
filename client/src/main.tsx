import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startMediaV2Runtime } from './features/media/v2/runtime'
import { applyAppearancePreference, readAppearancePreference } from './shared/appearance'

applyAppearancePreference(readAppearancePreference())
startMediaV2Runtime()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
