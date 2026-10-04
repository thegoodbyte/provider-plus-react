import React from 'react';
import { House } from '../types';

type Bedroom = Exclude<House['bedrooms'], number | undefined>[number];
export default function HouseRoomConfiguration({ house, onChange }: { house: Partial<House>; onChange: (change: Partial<House>) => void }) {
  const rooms = Array.isArray(house.bedrooms) ? house.bedrooms : [];
  const update = (index: number, change: Partial<Bedroom>) => onChange({ bedrooms: rooms.map((room, i) => i === index ? { ...room, ...change } : room) });
  return <section className="space-y-4" aria-label="House room configuration">
    <div className="flex items-center justify-between gap-4">
      <div><h4 className="font-semibold text-slate-900">Room configuration</h4><p className="mt-1 text-sm text-slate-600">Define each bedroom once. Retreats can offer fewer beds or reserve a whole room privately.</p></div>
      <button type="button" onClick={() => onChange({ bedrooms: [...rooms, { name: `Room ${rooms.length + 1}`, floor: '', bedCount: 2, hasBathroom: false, allowsSharing: true }] })} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">Add bedroom</button>
    </div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={house.allowsRoomSharing !== false} onChange={event => onChange({ allowsRoomSharing: event.target.checked })} /> This house allows shared rooms</label>
    {!rooms.length && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Add the bedrooms to make them available on the retreat allocation board.</p>}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rooms.map((room, index) => <div key={room._id || index} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <label className="block text-sm font-medium">Room number / name<input aria-label={`Bedroom ${index + 1} name`} value={room.name} onChange={event => update(index, { name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" required /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">Floor<input aria-label={`Bedroom ${index + 1} floor`} value={room.floor || ''} onChange={event => update(index, { floor: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>
        <label className="block text-sm">Physical beds<input aria-label={`Bedroom ${index + 1} beds`} type="number" min="1" max="20" value={room.bedCount ?? room.beds ?? 2} onChange={event => update(index, { bedCount: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" required /></label>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(room.hasBathroom)} onChange={event => update(index, { hasBathroom: event.target.checked })} /> Private bathroom</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={room.allowsSharing !== false} onChange={event => update(index, { allowsSharing: event.target.checked })} /> Allow shared use</label>
      <button type="button" onClick={() => update(index, { active: room.active === false })} className="text-sm font-medium text-red-700">{room.active === false ? 'Restore' : 'Archive'} {room.name || 'bedroom'}</button>
    </div>)}</div>
    <p className="text-xs text-slate-500">Saved retreat allocations keep their configuration. Refresh an empty retreat board to use updated house bedrooms.</p>
  </section>;
}
