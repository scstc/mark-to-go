import { createRoot } from 'react-dom/client';
import '@fontsource/hanken-grotesk/latin-400.css';
import '@fontsource/hanken-grotesk/latin-600.css';
import '@fontsource/hanken-grotesk/latin-700.css';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(<App />);
