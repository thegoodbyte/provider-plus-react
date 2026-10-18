import React, { useEffect, useState } from 'react';
import { roomInventoryApi } from '../services/roomInventoryApi';
import RoomStayTimeline from './RoomStayTimeline';

export default function RetreatOccupancyTab({ retreatId }: { retreatId: string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    roomInventoryApi
      .view(retreatId)
      .then((result) => {
        if (active) setData(result.data);
      })
      .catch(() => {
        if (active) setError('Could not load room occupancy.');
      });
    return () => {
      active = false;
    };
  }, [retreatId]);

  if (error) return <p role="alert" className="text-red-800">{error}</p>;
  if (!data) return <p role="status">Loading occupancy…</p>;

  const retreat = { startDate: data.startDate, endDate: data.endDate };
  const rooms: any[] = [...(data.rooms || [])].sort((a, b) => String(a.name).localeCompare(String(b.name)));

  return (
    <section aria-label="Room occupancy overview" className="space-y-3">
      <p className="text-sm text-slate-600">
        Every room's stays across the retreat, at a glance. A booster or other partial stay shows as its own segment; occupants who overlap in time get separate lines.
      </p>
      {!rooms.length && <p className="text-slate-600">No rooms configured for this retreat yet.</p>}
      {rooms.map((room) => {
        const occupants = room.occupants || [];
        return (
          <div key={room.roomId} className="rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold">
              {room.floor ? `${room.floor} / ` : ''}
              {room.name}
            </h3>
            {occupants.length ? (
              <RoomStayTimeline retreat={retreat} occupants={occupants} packRows />
            ) : (
              <p className="mt-2 text-sm text-slate-500">Unoccupied</p>
            )}
            {room.externalOccupants?.length > 0 && (
              <p className="mt-2 text-xs text-slate-500">Also occupied by an overlapping retreat</p>
            )}
          </div>
        );
      })}
    </section>
  );
}
