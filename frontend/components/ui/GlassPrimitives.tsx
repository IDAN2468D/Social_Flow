'use client';

import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type GlassGlowAccent = 'none' | 'indigo' | 'violet' | 'emerald' | 'rose' | 'cyan';
export type GlassPadding = 'none' | 'sm' | 'md' | 'lg';

export interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: React.ReactNode;
  interactive?: boolean;
  glow?: GlassGlowAccent;
  padding?: GlassPadding;
  className?: string;
}

const PADDING_MAP: Record<GlassPadding, string> = {
  none: 'p-0',
  sm: 'p-3.5',
  md: 'p-5',
  lg: 'p-6 sm:p-7',
};

const GLOW_MAP: Record<GlassGlowAccent, string> = {
  none: '',
  indigo: 'hover:shadow-[0_16px_42px_-12px_rgba(99,102,241,0.28)]',
  violet: 'hover:shadow-[0_16px_42px_-12px_rgba(139,92,246,0.28)]',
  emerald: 'hover:shadow-[0_16px_42px_-12px_rgba(16,185,129,0.25)]',
  rose: 'hover:shadow-[0_16px_42px_-12px_rgba(244,63,94,0.25)]',
  cyan: 'hover:shadow-[0_16px_42px_-12px_rgba(6,182,212,0.25)]',
};

export function GlassCard({
  children,
  interactive = false,
  glow = 'indigo',
  padding = 'md',
  className,
  ...rest
}: GlassCardProps) {
  return (
    <motion.div
      whileHover={interactive ? { y: -2 } : undefined}
      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      className={cn(
        'relative rounded-2xl bg-[rgba(18,21,33,0.72)] backdrop-blur-xl',
        'border border-white/10 transition-colors duration-200',
        'hover:border-indigo-500/40',
        'shadow-[0_12px_36px_-10px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)]',
        PADDING_MAP[padding],
        GLOW_MAP[glow],
        interactive && 'cursor-pointer',
        className
      )}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export interface BentoTileProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children?: React.ReactNode;
  label?: string;
  value?: string | number;
  sublabel?: string;
  icon?: React.ReactNode;
  trend?: string;
  accent?: Exclude<GlassGlowAccent, 'none'>;
  className?: string;
}

const ACCENT_ICON_BG: Record<Exclude<GlassGlowAccent, 'none'>, string> = {
  indigo: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  violet: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  cyan: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
};

export function BentoTile({
  children,
  label,
  value,
  sublabel,
  icon,
  trend,
  accent = 'indigo',
  className,
  ...rest
}: BentoTileProps) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      className={cn(
        'group relative overflow-hidden rounded-2xl p-4 sm:p-5',
        'bg-[rgba(18,21,33,0.72)] backdrop-blur-xl',
        'border border-white/10 hover:border-indigo-500/40',
        'shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]',
        'transition-all duration-200',
        className
      )}
      {...rest}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -end-12 h-28 w-28 rounded-full bg-indigo-500/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      />

      {(label !== undefined || icon !== undefined) && (
        <div className="flex items-center justify-between gap-2 mb-2.5">
          {label && (
            <span className="text-xs font-medium text-slate-400 tracking-wide">
              {label}
            </span>
          )}
          {icon && (
            <span
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-xl border',
                ACCENT_ICON_BG[accent]
              )}
            >
              {icon}
            </span>
          )}
        </div>
      )}

      {value !== undefined && (
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl sm:text-[1.65rem] font-extrabold tracking-tight text-slate-50 font-mono">
            {value}
          </span>
          {trend && (
            <span className="text-[11px] font-semibold font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              {trend}
            </span>
          )}
        </div>
      )}

      {sublabel && (
        <p className="mt-1 text-xs text-slate-400 leading-snug">{sublabel}</p>
      )}

      {children}
    </motion.div>
  );
}

export type GradientButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type GradientButtonSize = 'sm' | 'md' | 'lg';

export interface GradientButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: React.ReactNode;
  variant?: GradientButtonVariant;
  size?: GradientButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
}

const BUTTON_VARIANT_MAP: Record<GradientButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-[#6366F1] via-[#7C3AED] to-[#8B5CF6] text-white border border-indigo-400/30 shadow-[0_8px_24px_-6px_rgba(99,102,241,0.55)] hover:shadow-[0_12px_30px_-6px_rgba(139,92,246,0.65)] hover:brightness-110',
  secondary:
    'bg-[rgba(18,21,33,0.72)] backdrop-blur-xl text-slate-100 border border-white/10 hover:border-indigo-500/40 hover:bg-[rgba(26,31,48,0.85)]',
  ghost:
    'bg-transparent text-slate-300 border border-transparent hover:bg-white/5 hover:text-white hover:border-white/10',
  danger:
    'bg-gradient-to-r from-rose-600 to-rose-500 text-white border border-rose-400/30 shadow-[0_8px_24px_-6px_rgba(244,63,94,0.45)] hover:brightness-110',
};

const BUTTON_SIZE_MAP: Record<GradientButtonSize, string> = {
  sm: 'h-9 px-3.5 text-xs rounded-xl gap-1.5',
  md: 'h-11 px-5 text-sm rounded-xl gap-2',
  lg: 'h-12 px-6 text-sm sm:text-base rounded-2xl gap-2.5',
};

export function GradientButton({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  className,
  type = 'button',
  ...rest
}: GradientButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <motion.button
      type={type}
      whileHover={isDisabled ? undefined : { y: -1 }}
      whileTap={isDisabled ? undefined : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-all duration-200 cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090A0F]',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        BUTTON_VARIANT_MAP[variant],
        BUTTON_SIZE_MAP[size],
        fullWidth && 'w-full',
        className
      )}
      {...rest}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
      ) : (
        leftIcon && <span className="shrink-0 inline-flex">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && (
        <span className="shrink-0 inline-flex">{rightIcon}</span>
      )}
    </motion.button>
  );
}

export type BadgePillVariant = 'default' | 'indigo' | 'violet' | 'emerald' | 'rose' | 'amber';

export interface BadgePillProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: BadgePillVariant;
  pulseDot?: boolean;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
}

const BADGE_VARIANT_MAP: Record<BadgePillVariant, string> = {
  default: 'bg-white/5 text-slate-300 border-white/10',
  indigo: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  violet: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
};

const PULSE_COLOR_MAP: Record<BadgePillVariant, string> = {
  default: 'bg-slate-300',
  indigo: 'bg-indigo-400',
  violet: 'bg-violet-400',
  emerald: 'bg-emerald-400',
  rose: 'bg-rose-400',
  amber: 'bg-amber-400',
};

export function BadgePill({
  children,
  variant = 'default',
  pulseDot = false,
  icon,
  size = 'md',
  className,
  ...rest
}: BadgePillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border backdrop-blur-md font-semibold tracking-wide',
        size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs',
        BADGE_VARIANT_MAP[variant],
        className
      )}
      {...rest}
    >
      {pulseDot && (
        <span className="relative flex h-2 w-2 shrink-0">
          <span
            className={cn(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              PULSE_COLOR_MAP[variant]
            )}
          />
          <span
            className={cn(
              'relative inline-flex rounded-full h-2 w-2',
              PULSE_COLOR_MAP[variant]
            )}
          />
        </span>
      )}
      {icon && <span className="shrink-0 inline-flex">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}

export type SkeletonVariant = 'text' | 'circle' | 'rect' | 'card';

export interface SkeletonPulseProps {
  variant?: SkeletonVariant;
  className?: string;
  width?: string | number;
  height?: string | number;
}

export function SkeletonPulse({
  variant = 'rect',
  className,
  width,
  height,
}: SkeletonPulseProps) {
  const variantClasses: Record<SkeletonVariant, string> = {
    text: 'h-4 w-full rounded-md',
    circle: 'h-12 w-12 rounded-full',
    rect: 'h-24 w-full rounded-xl',
    card: 'h-40 w-full rounded-2xl border border-white/10 bg-[rgba(18,21,33,0.72)] backdrop-blur-xl',
  };

  return (
    <div
      aria-hidden="true"
      style={{ width, height }}
      className={cn(
        'animate-pulse bg-gradient-to-r from-white/[0.04] via-white/[0.09] to-white/[0.04]',
        variantClasses[variant],
        className
      )}
    />
  );
}
