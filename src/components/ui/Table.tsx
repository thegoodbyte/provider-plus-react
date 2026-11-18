import React from 'react';
import { ChevronDown } from 'lucide-react';

/** Wraps a table in its own horizontal-scroll container so the page body never scrolls sideways. */
export const Table: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className="overflow-x-auto">
    <table className={`min-w-full divide-y divide-apple-gray-200 ${className}`}>{children}</table>
  </div>
);

export const TableHead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <thead className="bg-apple-gray-50">{children}</thead>
);

export const TableBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tbody className="divide-y divide-apple-gray-100 bg-apple-surface">{children}</tbody>
);

export const TableRow: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = '', onClick }) => (
  <tr className={`transition-colors hover:bg-apple-gray-50 ${onClick ? 'cursor-pointer' : ''} ${className}`} onClick={onClick}>{children}</tr>
);

interface TableHeaderCellProps {
  children: React.ReactNode;
  align?: 'left' | 'right';
  sortDirection?: 'asc' | 'desc';
  onSort?: () => void;
  className?: string;
}

/** A plain header cell, or a sortable one when `onSort` is given — same visual weight either way. */
export const TableHeaderCell: React.FC<TableHeaderCellProps> = ({ children, align = 'left', sortDirection, onSort, className = '' }) => {
  const alignClass = align === 'right' ? 'text-right' : 'text-left';
  if (!onSort) {
    return <th className={`px-4 py-2.5 ${alignClass} text-xs font-semibold uppercase tracking-wide text-apple-gray-500 ${className}`}>{children}</th>;
  }
  return (
    <th
      aria-sort={sortDirection ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`px-4 py-2.5 ${alignClass} text-xs font-semibold uppercase tracking-wide text-apple-gray-500 ${className}`}
    >
      <button type="button" onClick={onSort} className={`inline-flex items-center gap-1 hover:text-apple-gray-800 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        {children}
        {sortDirection && <ChevronDown className={`h-3.5 w-3.5 transition-transform ${sortDirection === 'asc' ? 'rotate-180' : ''}`} />}
      </button>
    </th>
  );
};

export const TableCell: React.FC<{ children: React.ReactNode; align?: 'left' | 'right'; className?: string; colSpan?: number }> = ({ children, align = 'left', className = '', colSpan }) => (
  <td colSpan={colSpan} className={`px-4 py-2.5 text-sm text-apple-gray-700 ${align === 'right' ? 'text-right' : ''} ${className}`}>{children}</td>
);
