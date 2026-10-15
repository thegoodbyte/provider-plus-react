import React from 'react';
import { dayTicks, staySegment, occupantColorIndex } from './RoomStayTimeline.helpers';

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
}

export default function RoomStayTimeline({ retreat, occupants }: RoomStayTimelineProps) {
  if (!occupants.length) return null;
  const ticks = dayTicks(retreat);
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
        {occupants.map((occupant) => {
          const segment = staySegment(retreat, occupant);
          const color = PALETTE[occupantColorIndex(occupant._id, PALETTE.length)];
          return (
            <div key={occupant._id} className="relative h-6 bg-slate-50 rounded">
              <div
                className={`absolute inset-y-0 rounded ${color} text-white text-xs flex items-center px-1 truncate`}
                style={{ left: `${segment.leftPct}%`, width: `${segment.widthPct}%` }}
                title={`${occupant.name} · ${segment.nights} night${segment.nights === 1 ? '' : 's'}`}
              >
                {occupant.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
