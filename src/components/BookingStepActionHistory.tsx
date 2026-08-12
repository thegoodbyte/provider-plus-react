import React from 'react';
import { BookingFlowActionLog } from '../types';
import { formatStepDateTime } from './bookingStepPresentation';

export const getBookingStepActionLogDate = (log: BookingFlowActionLog) => log.performedAt || log.createdAt;

export const sortBookingStepActionLogs = (logs: BookingFlowActionLog[]) => [...logs].sort((a, b) => new Date(getBookingStepActionLogDate(b) || 0).getTime() - new Date(getBookingStepActionLogDate(a) || 0).getTime());

export const describeBookingStepActionLog = (log: BookingFlowActionLog) => {
  const date = getBookingStepActionLogDate(log);
  const parts = [
    date ? formatStepDateTime(date) : '',
    log.metadata?.sentEmailDisplayId ? `Email #${log.metadata.sentEmailDisplayId}` : '',
    log.performedByEmail || '',
    log.statusAfter ? `Status: ${String(log.statusAfter).replace(/_/g, ' ')}` : '',
  ].filter(Boolean);
  return parts.join(' • ') || 'Recorded action';
};

const BookingStepActionHistory: React.FC<{ label: string; logs: BookingFlowActionLog[] }> = ({ label, logs }) => {
  if (logs.length === 0) return null;
  const sortedLogs = sortBookingStepActionLogs(logs);
  const latest = sortedLogs[0];
  const latestDate = getBookingStepActionLogDate(latest);

  return (
    <span className="group relative inline-flex max-w-full items-center">
      <button type="button" className="truncate rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-800 hover:bg-blue-100" title="Hover to see all actions">
        {label}: {logs.length}x{latestDate ? `, last ${formatStepDateTime(latestDate)}` : ''}
      </button>
      <span className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden w-80 max-w-[80vw] rounded-lg border border-gray-200 bg-white p-3 text-left text-xs text-gray-700 shadow-xl group-hover:block">
        <span className="mb-2 block font-semibold text-gray-900">{label} history</span>
        <span className="block max-h-72 space-y-2 overflow-y-auto">
          {sortedLogs.map((log, index) => (
            <span key={log._id || `${label}-${index}`} className="block rounded-md bg-gray-50 p-2">
              <span className="block font-medium text-gray-900">{describeBookingStepActionLog(log)}</span>
              {log.notes && <span className="mt-1 block whitespace-pre-wrap text-gray-600">{log.notes}</span>}
              {log.actionLabel && <span className="mt-1 block text-gray-500">{log.actionLabel}</span>}
            </span>
          ))}
        </span>
      </span>
    </span>
  );
};

export default BookingStepActionHistory;
