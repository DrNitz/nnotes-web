import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { useEditor } from './store/editor';
import { isRtl, type Lang } from './i18n';
import { getPref } from './lib/storage';
import './styles.css';

const applyAppearance = () => {
  const s = useEditor.getState();
  document.documentElement.dataset.theme = s.theme;
  document.documentElement.lang = s.lang;
  document.documentElement.dir = isRtl(s.lang as Lang) ? 'rtl' : 'ltr';
};
applyAppearance();
useEditor.subscribe(applyAppearance);
void getPref<string>('lang', 'en').then((lang) => {
  if (lang && lang !== useEditor.getState().lang) useEditor.getState().setLang(lang);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
