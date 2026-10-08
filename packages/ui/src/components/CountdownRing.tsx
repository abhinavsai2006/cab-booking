import React, { useEffect, useState } from 'react';
import { cn } from '../utils/cn.js';

export interface CountdownRingProps {
  initialSeconds: number;
  onTimeout?: () => void;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export const CountdownRing: React.FC<CountdownRingProps> = ({
  initialSeconds = 15,
  onTimeout,
  size = 72,
  strokeWidth = 6,
  className,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    setSecondsLeft(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onTimeout?.();
      return;
    }
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeout?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft, onTimeout]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = secondsLeft / initialSeconds;
  const strokeDashoffset = circumference * (1 - fraction);

  const isUrgent = secondsLeft <= 5;

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-zinc-800"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className={cn(
            'transition-all duration-1000 ease-linear',
            isUrgent ? 'text-red-500 animate-pulse' : 'text-emerald-500'
          )}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-bold text-lg">
        <span className={isUrgent ? 'text-red-500' : 'text-white'}>
          {secondsLeft}s
        </span>
      </div>
    </div>
  );
};
