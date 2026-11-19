import React from 'react';

interface CardProps {
  children: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
}

const PADDING: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-7',
};

/** The one surface every page should build sections from, instead of a bespoke bordered div. */
const Card: React.FC<CardProps> = ({ children, padding = 'md', className = '' }) => (
  <div className={`rounded-apple-lg border border-apple-gray-200 bg-apple-surface shadow-apple-sm ${PADDING[padding]} ${className}`}>
    {children}
  </div>
);

interface CardHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/** Title + optional subtitle on the left, one action on the right — the shape nearly every card header needs. */
export const CardHeader: React.FC<CardHeaderProps> = ({ title, subtitle, action, className = '' }) => (
  <div className={`mb-4 flex items-start justify-between gap-3 ${className}`}>
    <div className="min-w-0">
      <h2 className="text-base font-bold text-apple-gray-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-apple-gray-500">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export default Card;
