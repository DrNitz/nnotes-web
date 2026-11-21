import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { useEditor } from './store/editor';
import './styles.css';

const applyTheme = () => {
  document.documentElement.dataset.theme = useEditor.getState().theme;
};
applyTheme();
useEditor.subscribe(applyTheme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
