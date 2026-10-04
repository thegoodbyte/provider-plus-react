import React, { useEffect, useState } from 'react';
import { roomAllocationApi } from '../services/api';
import { authService } from '../services/authService';
import RoomGuestPicker from './RoomGuestPicker';

export interface AllocationGuest { id: string; clientId?: string; profilePictureUrl?: string; profilePictureS3Key?: string; profilePictureFileUploadId?: string; name: string; bookingNumber?: number; clientNumber?: number; roomType: string; amountPaid: number; currency: string }
export interface AllocationRoom { id: string; name: string; floor: string; bedCount: number; hasBathroom: boolean; allowsSharing: boolean; availableBeds: number; use?: 'private' | 'shared' | 'blocked'; occupants: Array<{ bed: number; bookingId: string }> }
export interface AllocationBoard { retreatId: string; houseName: string; houseChanged: boolean; revision: number; rooms: AllocationRoom[]; guests: AllocationGuest[] }

export const roomUse = (room: AllocationRoom) => room.use ?? (room.availableBeds === 0 ? 'blocked' : room.availableBeds === 1 ? 'private' : 'shared');

export const matchesRoomPreference = (room: AllocationRoom, guest: AllocationGuest) => roomUse(room) === 'private'
  ? guest.amountPaid > 0 && (room.hasBathroom ? guest.roomType === 'private_ensuite' : ['private', 'private_ensuite'].includes(guest.roomType))
  : guest.roomType === 'shared';

export default function RoomAllocationBoard({ retreatId }: { retreatId: string }) {
  const [board, setBoard] = useState<AllocationBoard | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canEdit = ['admin', 'facilitator'].includes(authService.getUser()?.role || '');
  const load = async () => {
    setBusy(true);
    try { setBoard((await roomAllocationApi.get(retreatId)).data); setError(''); }
    catch (failure: any) { setError(failure.response?.data?.message || 'Unable to load room allocations'); }
    finally { setBusy(false); }
  };
  useEffect(() => { let active = true; setBoard(null); setError(''); setBusy(true);
    roomAllocationApi.get(retreatId).then(response => { if (active) setBoard(response.data); })
      .catch(failure => { if (active) setError(failure.response?.data?.message || 'Unable to load room allocations'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [retreatId]);
  const change = async (action: any) => {
    if (!board || busy) return;
    setBusy(true); setError('');
    try { setBoard((await roomAllocationApi.change(retreatId, { revision: board.revision, ...action })).data); }
    catch (failure: any) {
      const message = failure.response?.data?.message || 'Unable to save room allocation';
      if (failure.response?.status === 409) {
        try { setBoard((await roomAllocationApi.get(retreatId)).data); } catch {}
      }
      setError(message);
    } finally { setBusy(false); }
  };
  const assigned = new Set(board?.rooms.flatMap(room => room.occupants.map(occupant => occupant.bookingId)) || []);
  const assignedClients = new Set(board?.guests.filter(guest => assigned.has(guest.id)).map(guest => guest.clientId).filter(Boolean) || []);
  const unassignedGuests = board?.guests.filter(guest => !assigned.has(guest.id) && (!guest.clientId || !assignedClients.has(guest.clientId))) || [];
  const occupied = board?.rooms.reduce((sum, room) => sum + room.occupants.length, 0) || 0;
  const offered = board?.rooms.reduce((sum, room) => sum + room.availableBeds, 0) || 0;
  return <section className="space-y-5" aria-label="Room allocation board">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-2xl font-semibold text-slate-900">Room allocation</h2><p className="mt-1 text-sm text-slate-600">{board?.houseName || 'Retreat accommodation'} · {occupied} assigned · {offered - occupied} available</p></div>
      <div className="flex gap-2"><button type="button" disabled={busy} onClick={load} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Refresh allocations</button>{canEdit && <button type="button" disabled={busy || occupied > 0 || !board} onClick={() => change({ action: 'refresh' })} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" title="Release all assignments first">Refresh from house</button>}</div>
    </div>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {board?.houseChanged && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">The retreat house has changed. Release existing assignments, then refresh from the house to use its bedrooms.</p>}
    <p className="text-sm text-slate-600">Choose Private, Shared, or Closed for each bedroom. Shared rooms have a separate available-bed limit. Release assignments before changing the configuration. Guests who paid for matching accommodation appear first.</p>
    {busy && !board && <p role="status">Loading rooms…</p>}
    {board && !board.rooms.length && <p className="rounded-xl border border-dashed border-slate-300 p-6 text-slate-600">No bedrooms configured. Add bedrooms in Houses → Room configuration, then refresh from house.</p>}
    <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">{board?.rooms.map(room => <article key={room.id} aria-label={room.name} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50 p-4"><h3 className="text-lg font-semibold text-slate-900">{room.name}</h3><p className="mt-1 text-xs text-slate-600">{room.floor ? `Floor ${room.floor} · ` : ''}{room.bedCount} physical beds{room.hasBathroom ? ' · Private bathroom' : ''}</p>
        <div role="group" aria-label={`${room.name} room use`} className="mt-3 flex gap-1">{(['private', 'shared', 'blocked'] as const).map(use => <button key={use} type="button" aria-pressed={roomUse(room) === use} disabled={busy || !canEdit || room.occupants.length > 0 || (use === 'shared' && !room.allowsSharing)} onClick={() => change({ action: 'configure', roomId: room.id, use, availableBeds: use === 'blocked' ? 0 : use === 'private' ? 1 : Math.max(1, room.bedCount) })} className={`flex-1 rounded-lg border px-2 py-2 text-xs font-semibold disabled:opacity-60 ${roomUse(room) === use ? 'border-indigo-500 bg-indigo-50 text-indigo-800' : 'border-slate-300 bg-white text-slate-700'}`}>{use === 'blocked' ? 'Closed' : use === 'private' ? 'Private' : 'Shared'}</button>)}</div>
        {room.occupants.length > 0 && <p className="mt-2 text-xs text-slate-600">Release assigned guests before changing room use or the bed limit.</p>}
        {!room.allowsSharing && <p className="mt-2 text-xs text-slate-600">This bedroom is configured for private use only in Houses.</p>}
        {roomUse(room) === 'shared' && <label className="mt-3 block text-xs font-semibold text-slate-700">Available shared beds<select aria-label={`${room.name} available beds`} value={room.availableBeds} disabled={busy || !canEdit || room.occupants.length > 0} onChange={event => change({ action: 'configure', roomId: room.id, use: 'shared', availableBeds: Number(event.target.value) })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm disabled:opacity-60">{Array.from({ length: room.bedCount }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>}
        <p className="mt-2 text-xs font-medium text-emerald-800">{room.availableBeds - room.occupants.length} beds available</p>
      </div>
      <div className="space-y-3 p-4">{Array.from({ length: room.availableBeds }, (_, index) => {
        const bed = index + 1;
        const occupantId = room.occupants.find(occupant => occupant.bed === bed)?.bookingId;
        const occupant = board.guests.find(guest => guest.id === occupantId);
        const guests = board.guests.filter(guest => guest.id === occupantId || (!assigned.has(guest.id) && (!guest.clientId || !assignedClients.has(guest.clientId))));
        const recommended = guests.filter(guest => matchesRoomPreference(room, guest));
        const others = guests.filter(guest => !matchesRoomPreference(room, guest));
        const label = roomUse(room) === 'private' ? 'Private room' : `Shared bed ${bed}`;
        return <div key={bed} className={`rounded-lg border p-3 ${occupant ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-slate-50'}`}>
          <span className="block text-xs font-semibold text-slate-700">{label}</span>
          <RoomGuestPicker ariaLabel={`${room.name} ${label} guest`} value={occupantId} recommended={recommended} others={others} disabled={busy || !canEdit || Boolean(occupantId) || board.houseChanged} onChange={bookingId => change({ action: 'assign', roomId: room.id, bed, bookingId })} />
          {occupant && <button type="button" disabled={busy || !canEdit} onClick={() => change({ action: 'assign', roomId: room.id, bed, bookingId: null })} className="mt-2 text-xs font-semibold text-red-700">Release {occupant.name}</button>}
        </div>;
      })}{room.availableBeds === 0 && <p className="text-sm text-slate-500">Room closed for this retreat.</p>}</div>
    </article>)}</div>
    {board && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-semibold text-slate-900">Unassigned guests ({unassignedGuests.length})</h3><div className="mt-2 flex flex-wrap gap-2">{unassignedGuests.map(guest => <span key={guest.id} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700">#{guest.bookingNumber || '—'} · {guest.name}</span>)}</div></div>}
  </section>;
}
