import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '../utils/cn.js';

export interface RatingStarsProps {
  value: number;
  max?: number;
  onChange?: (val: number) => void;
  size?: number;
  className?: string;
  readonly?: boolean;
}

export const RatingStars: React.FC<RatingStarsProps> = ({
  value,
  max = 5,
  onChange,
  size = 20,
  className,
  readonly = false,
}) => {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {Array.from({ length: max }).map((_, idx) => {
        const starValue = idx + 1;
        const isFilled = starValue <= value;

        return (
          <button
            key={idx}
            type="button"
            disabled={readonly}
            onClick={() => onChange?.(starValue)}
            className={cn(
              'transition-transform focus:outline-none',
              !readonly && 'hover:scale-110 active:scale-95 cursor-pointer',
              readonly && 'cursor-default'
            )}
            aria-label={`${starValue} stars`}
          >
            <Star
              size={size}
              className={cn(
                'transition-colors',
                isFilled
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-zinc-600 hover:text-amber-300'
              )}
            />
          </button>
        );
      })}
    </div>
  );
};
