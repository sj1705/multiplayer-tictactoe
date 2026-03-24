import { useState, useEffect } from 'react';

interface Props {
  deadline: number; // unix ms
  active: boolean;
}

export default function Timer({ deadline, active }: Props) {
  const [remaining, setRemaining] = useState(30);

  useEffect(() => {
    if (!active || !deadline) {
      setRemaining(30);
      return;
    }

    const update = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
    };

    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [deadline, active]);

  const percentage = (remaining / 30) * 100;
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const color = remaining <= 5 ? 'var(--danger)' : remaining <= 10 ? '#ff9800' : 'var(--accent)';

  return (
    <div className="relative inline-flex items-center justify-center w-18 h-18">
      <svg className="w-18 h-18 -rotate-90" viewBox="0 0 64 64">
        <circle
          cx="32" cy="32" r={radius}
          fill="none"
          stroke="var(--bg-card)"
          strokeWidth="4"
        />
        <circle
          cx="32" cy="32" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-200"
        />
      </svg>
      <span
        className="absolute text-lg font-bold"
        style={{ color }}
      >
        {remaining}
      </span>
    </div>
  );
}
