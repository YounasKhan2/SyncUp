import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startMediaV2Runtime } from './features/media/v2/runtime'
import { startAppearanceLifecycle } from './shared/appearance'

const stopAppearanceLifecycle = startAppearanceLifecycle()
if (import.meta.hot) import.meta.hot.dispose(stopAppearanceLifecycle)
startMediaV2Runtime()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
