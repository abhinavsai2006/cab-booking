import React, { useEffect } from 'react';
import { cn } from '../utils/cn.js';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  peekHeight?: string; // e.g. "max-h-[85vh]"
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className,
  peekHeight = 'max-h-[85vh]',
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Sheet panel */}
      <div
        className={cn(
          'relative w-full max-w-lg mx-auto bg-zinc-950 border-t border-zinc-800 rounded-t-3xl shadow-2xl overflow-hidden flex flex-col transition-transform animate-in slide-in-from-bottom duration-300',
          peekHeight,
          className
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2 cursor-grab">
          <div className="w-12 h-1.5 rounded-full bg-zinc-700" />
        </div>

        {title && (
          <div className="px-5 pb-3 border-b border-zinc-800/80 font-semibold text-lg text-white">
            {title}
          </div>
        )}

        <div className="overflow-y-auto p-5 flex-1">{children}</div>
      </div>
    </div>
  );
};
