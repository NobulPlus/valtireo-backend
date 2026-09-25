import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

export function ProgressRing({
  percentage,
  size = 128,
  strokeWidth = 10,
  color = 'var(--color-teal)',
  trackColor = 'var(--color-surface-soft)',
  label,
  className,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  className?: string;
}) {
  const [animated, setAnimated] = useState(false);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percentage));
  const offset = circumference * (1 - clamped / 100);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animated ? offset : circumference}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-display text-2xl font-bold tabular-nums text-strong">{clamped}%</p>
        {label && <p className="mt-0.5 text-[10.5px] font-medium text-muted">{label}</p>}
      </div>
    </div>
  );
}
