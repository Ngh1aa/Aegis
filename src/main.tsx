import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@fontsource-variable/ibm-plex-sans/wght.css'
import './styles.css'
import { App } from './app'
import { loadWorkspace } from './store'

createRoot(document.getElementById('root')!).render(<HashRouter><App /></HashRouter>)
loadWorkspace()
