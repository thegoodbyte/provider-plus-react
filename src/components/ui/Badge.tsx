import React from 'react';

export type BadgeTone = 'success' | 'warning' | 'critical' | 'info' | 'neutral';

const TONE_STYLES: Record<BadgeTone, string> = {
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  critical: 'bg-red-100 text-red-800',
  info: 'bg-indigo-100 text-indigo-800',
  neutral: 'bg-apple-gray-100 text-apple-gray-700',
};

interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  /**
   * Full `bg-* text-*` override that replaces `tone`'s colors entirely, for a status system
   * with more than 5 states (e.g. client workflow status, which has 11). Kept separate from
   * `className` on purpose: concatenating two conflicting Tailwind color utilities is a
   * silent-override bug waiting to happen, since which one wins depends on stylesheet order,
   * not prop order.
   */
  colorClassName?: string;
  dot?: boolean;
  className?: string;
}

/** The one pill every status in the app should render through, whatever its color mapping. */
const Badge: React.FC<BadgeProps> = ({ children, tone = 'neutral', colorClassName, dot = false, className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${colorClassName || TONE_STYLES[tone]} ${className}`}>
    {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
    {children}
  </span>
);

export default Badge;
