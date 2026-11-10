import { useEffect, useState } from 'react';

/** Tiempo que queda para deshacer; al llegar a cero avisa para recargar (el backend decide igualmente). */
export function Countdown({ until, onExpire }: { until: string; onExpire: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const seconds = Math.max(0, Math.round((new Date(until).getTime() - now) / 1000));
  useEffect(() => { if (seconds === 0) onExpire(); }, [seconds, onExpire]);
  return <span className="ds-num">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span>;
}
