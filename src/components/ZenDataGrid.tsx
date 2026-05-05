import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Search, Filter, MoreVertical } from 'lucide-react';

export interface Column<T> {
  key: keyof T;
  label: string;
  width?: string;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  mobileHidden?: boolean;
}

interface ZenDataGridProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  mobileCardView?: boolean;
  renderMobileCard?: (row: T) => React.ReactNode;
}

function ZenDataGrid<T extends Record<string, any>>({
  data,
  columns,
  onRowClick,
  searchable = true,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No data available',
  mobileCardView = true,
  renderMobileCard
}: ZenDataGridProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Filter data based on search term
  const filteredData = data.filter(row => {
    if (!searchTerm) return true;

    return Object.values(row).some(value =>
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Sort data
  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortKey) return 0;

    const aVal = a[sortKey];
    const bVal = b[sortKey];

    if (aVal === bVal) return 0;

    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  const handleSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const toggleRowExpansion = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  return (
    <div className="bg-white rounded-softer shadow-sm">
      {/* Search Bar */}
      {searchable && (
        <div className="p-4 border-b border-zen-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zen-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="
                w-full pl-10 pr-4 py-2
                bg-zen-50 border border-zen-200 rounded-soft
                text-zen-700 placeholder-zen-400
                focus:outline-none focus:ring-2 focus:ring-accent-sky/20 focus:border-accent-sky
                transition-all duration-200
              "
            />
          </div>
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zen-100">
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={`
                    px-6 py-3 text-left text-xs font-medium text-zen-500
                    uppercase tracking-wider
                    ${column.sortable ? 'cursor-pointer hover:text-zen-700' : ''}
                  `}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center gap-2">
                    {column.label}
                    {column.sortable && sortKey === column.key && (
                      sortDirection === 'asc' ?
                        <ChevronUp className="w-4 h-4" /> :
                        <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zen-100">
            {sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-12 text-center text-zen-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((row, index) => (
                <tr
                  key={index}
                  onClick={() => onRowClick?.(row)}
                  className={`
                    ${onRowClick ? 'cursor-pointer hover:bg-zen-50' : ''}
                    transition-colors duration-150
                  `}
                >
                  {columns.map((column) => (
                    <td
                      key={String(column.key)}
                      className="px-6 py-4 text-sm text-zen-700"
                    >
                      {column.render
                        ? column.render(row[column.key], row)
                        : row[column.key]
                      }
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      {mobileCardView && (
        <div className="lg:hidden">
          {sortedData.length === 0 ? (
            <div className="px-6 py-12 text-center text-zen-400">
              {emptyMessage}
            </div>
          ) : (
            <div className="divide-y divide-zen-100">
              {sortedData.map((row, index) => (
                <div
                  key={index}
                  className={`
                    p-4
                    ${onRowClick ? 'cursor-pointer active:bg-zen-50' : ''}
                    transition-colors duration-150
                  `}
                  onClick={() => onRowClick?.(row)}
                >
                  {renderMobileCard ? (
                    renderMobileCard(row)
                  ) : (
                    <>
                      {/* Default mobile card layout */}
                      <div className="space-y-2">
                        {columns
                          .filter(col => !col.mobileHidden)
                          .slice(0, expandedRows.has(index) ? columns.length : 3)
                          .map((column) => (
                            <div key={String(column.key)} className="flex justify-between">
                              <span className="text-xs text-zen-500 uppercase">
                                {column.label}
                              </span>
                              <span className="text-sm text-zen-700 font-medium">
                                {column.render
                                  ? column.render(row[column.key], row)
                                  : row[column.key]
                                }
                              </span>
                            </div>
                          ))}
                      </div>

                      {/* Expand/Collapse button if there are more than 3 fields */}
                      {columns.filter(col => !col.mobileHidden).length > 3 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRowExpansion(index);
                          }}
                          className="mt-3 text-xs text-accent-sky hover:text-accent-sky/80 font-medium"
                        >
                          {expandedRows.has(index) ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ZenDataGrid;