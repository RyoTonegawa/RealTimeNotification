"use client"

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warn' | 'destructive';
}

const styles: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-slate-900 text-white border-transparent',
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  warn: 'bg-amber-100 text-amber-700 border-amber-200',
  destructive: 'bg-rose-100 text-rose-700 border-rose-200',
};

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}
