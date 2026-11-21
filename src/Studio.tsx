import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Sparkles, X } from 'lucide-react';

const QUOTES = [
  'Small steps every day add up to big results.',
  'The expert in anything was once a beginner.',
  'Focus on being productive instead of busy.',
  'Your future self is watching you right now.',
  'Deep work beats long hours.',
  'Every page is a step toward mastery.',
  'Progress, not perfection.',
  'Show up. The rest follows.',
];

const MASCOTS = ['🩺', '🎓', '🛠️', '⚖️', '🎨', '📚', '✨'];

function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function loadStreak(): number {
  const today = dayKey();
  const last = localStorage.getItem('nnotes-last-active');
  const streak = Number(localStorage.getItem('nnotes-streak') ?? 0);
  if (last === today) return streak;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return last === dayKey(yesterday) ? streak : 0;
}

export function Studio({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'work' | 'rest'>('work');
  const [workMin, setWorkMin] = useState(25);
  const [restMin, setRestMin] = useState(5);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [streak] = useState(loadStreak);
  const [mascot, setMascot] = useState(localStorage.getItem('nnotes-mascot') ?? '🩺');
  const interval = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem('nnotes-last-active', dayKey());
    localStorage.setItem('nnotes-streak', String(streak));
  }, [streak]);

  useEffect(() => {
    if (!running) return;
    interval.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r > 1) return r - 1;
        const next = mode === 'work' ? 'rest' : 'work';
        setMode(next);
        setRunning(false);
        const minutes = next === 'work' ? workMin : restMin;
        window.dispatchEvent(new CustomEvent('nnotes-toast', { detail: next === 'work' ? 'Break finished — focus again!' : 'Focus block complete — take a break.' }));
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Nnotes Web', { body: next === 'work' ? 'Break finished — focus again!' : 'Focus block complete — take a break.' });
        }
        return minutes * 60;
      });
    }, 1000);
    return () => { if (interval.current) window.clearInterval(interval.current); };
  }, [running, mode, workMin, restMin]);

  const reset = (m: 'work' | 'rest', minutes: number) => {
    setMode(m);
    setRemaining(minutes * 60);
    setRunning(false);
  };
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const quote = QUOTES[new Date().getDate() % QUOTES.length];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal studio" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2><Sparkles size={17} /> Studio</h2>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="studio-hero">
          <div className="mascot">{mascot}</div>
          <div>
            <div className="quote">“{quote}”</div>
            <div className="streak">🔥 {streak} day streak</div>
          </div>
        </div>

        <div className="mascot-row">
          {MASCOTS.map((m) => (
            <button key={m} className={`mascot-choice ${mascot === m ? 'active' : ''}`} onClick={() => { setMascot(m); localStorage.setItem('nnotes-mascot', m); }}>{m}</button>
          ))}
        </div>

        <div className="timer-toggles">
          <button className={mode === 'work' ? 'active' : ''} onClick={() => reset('work', workMin)}>Focus</button>
          <button className={mode === 'rest' ? 'active' : ''} onClick={() => reset('rest', restMin)}>Break</button>
        </div>
        <div className="timer-display">{mm}:{ss}</div>
        <div className="timer-controls">
          <button className="icon-btn" onClick={() => setRunning(!running)}>{running ? <Pause size={18} /> : <Play size={18} />}</button>
          <button className="icon-btn" onClick={() => reset(mode, mode === 'work' ? workMin : restMin)}><RotateCcw size={17} /></button>
          <label>Focus <input type="number" min={1} max={120} value={workMin} onChange={(e) => { const v = Math.max(1, Number(e.target.value)); setWorkMin(v); if (mode === 'work') reset('work', v); }} /></label>
          <label>Break <input type="number" min={1} max={60} value={restMin} onChange={(e) => { const v = Math.max(1, Number(e.target.value)); setRestMin(v); if (mode === 'rest') reset('rest', v); }} /></label>
        </div>
        <div className="panel-note">Ask notification permission in your browser to get break alerts.</div>
      </div>
    </div>
  );
}
