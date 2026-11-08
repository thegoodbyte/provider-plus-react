import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/** The one "nothing here" screen every list should show instead of a bare empty table or blank div. */
const EmptyState: React.FC<EmptyStateProps> = ({ title, description, icon, action, className = '' }) => (
  <div className={`flex flex-col items-center justify-center gap-2 px-6 py-14 text-center ${className}`}>
    <div className="mb-1 grid h-11 w-11 place-items-center rounded-full bg-apple-gray-100 text-apple-gray-400">
      {icon || <Inbox className="h-5 w-5" />}
    </div>
    <p className="text-sm font-semibold text-apple-gray-900">{title}</p>
    {description && <p className="max-w-sm text-sm text-apple-gray-500">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

export default EmptyState;
