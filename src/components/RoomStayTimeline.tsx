import React from 'react';
import { dayTicks, staySegment, occupantColorIndex, packOccupantsIntoRows } from './RoomStayTimeline.helpers';

const PALETTE = ['bg-teal-500', 'bg-amber-500', 'bg-sky-500', 'bg-rose-500', 'bg-violet-500', 'bg-lime-600'];

interface TimelineOccupant {
  _id: string;
  name: string;
  roomStayStart?: string | null;
  roomStayEnd?: string | null;
}

interface RoomStayTimelineProps {
  retreat: { startDate: string; endDate: string };
  occupants: TimelineOccupant[];
  /** When true, non-overlapping occupants (e.g. sequential boosters) share one row instead of each getting its own. */
  packRows?: boolean;
}

export default function RoomStayTimeline({ retreat, occupants, packRows = false }: RoomStayTimelineProps) {
  if (!occupants.length) return null;
  const ticks = dayTicks(retreat);
  const rows = packRows ? packOccupantsIntoRows(occupants, retreat) : occupants.map((occupant) => [occupant]);
  return (
    <div className="my-3" aria-label="Room stay timeline">
      <div className="relative h-4 border-b text-[10px] text-slate-500">
        {ticks.map((tick, index) => (
          <span key={index} className="absolute -translate-x-1/2" style={{ left: `${tick.pct}%` }}>
            {tick.label}
          </span>
        ))}
      </div>
      <div className="space-y-1 mt-3">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="relative h-6 bg-slate-50 rounded">
            {row.map((occupant) => {
              const segment = staySegment(retreat, occupant);
              const color = PALETTE[occupantColorIndex(occupant._id, PALETTE.length)];
              return (
                <div
                  key={occupant._id}
                  className={`absolute inset-y-0 rounded ${color} text-white text-xs flex items-center px-1 truncate`}
                  style={{ left: `${segment.leftPct}%`, width: `${segment.widthPct}%` }}
                  title={`${occupant.name} · ${segment.nights} night${segment.nights === 1 ? '' : 's'}`}
                >
                  {occupant.name}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
