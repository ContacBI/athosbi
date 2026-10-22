import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import App from './App.jsx'

// Instalar como aplicativo (ver lib/installApp.js): o navegador avisa uma
// vez só, logo no carregamento — guarda o aviso pra o botão "Instalar" usar
// depois. O service worker só é registrado no site publicado.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  window.__athosInstallPrompt = event
  window.dispatchEvent(new Event('athos-install-ready'))
})
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
