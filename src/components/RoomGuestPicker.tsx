import React from 'react';
import { Select } from 'antd';
import ClientAvatar from './ClientAvatar';
import type { AllocationGuest } from './RoomAllocationBoard';

interface GuestOption { value?: string; label: React.ReactNode; guest?: AllocationGuest; searchText?: string; options?: GuestOption[] }

function GuestRow({ guest, details = false }: { guest: AllocationGuest; details?: boolean }) {
  return <div className="flex min-w-0 items-center gap-2">
    <ClientAvatar client={{ _id: guest.clientId, profilePictureUrl: guest.profilePictureUrl, profilePictureS3Key: guest.profilePictureS3Key, profilePictureFileUploadId: guest.profilePictureFileUploadId }} name={guest.name} className="!h-7 !w-7" />
    <div className="min-w-0"><div className="truncate">#{guest.bookingNumber || guest.clientNumber || '—'} · {guest.name}</div>{details && <div className="truncate text-xs text-slate-500">{guest.roomType === 'unspecified' ? 'Accommodation not selected' : guest.roomType.replace(/_/g, ' ')} · {guest.amountPaid > 0 ? 'payment received' : 'unpaid'}</div>}</div>
  </div>;
}

export default function RoomGuestPicker({ ariaLabel, value, recommended, others, disabled, onChange }: {
  ariaLabel: string; value?: string; recommended: AllocationGuest[]; others: AllocationGuest[]; disabled: boolean; onChange: (bookingId: string) => void;
}) {
  const options = (guests: AllocationGuest[]) => guests.map(guest => ({ value: guest.id, label: <GuestRow guest={guest} />, guest, searchText: `${guest.name} ${guest.bookingNumber || ''} ${guest.clientNumber || ''}` }));
  return <Select<string, GuestOption> aria-label={ariaLabel} className="mt-2 w-full min-w-0" size="large" placeholder="Choose guest" value={value} disabled={disabled} onChange={onChange} showSearch virtual={false}
    filterOption={(input, option) => String(option?.searchText || '').toLowerCase().includes(input.toLowerCase())}
    popupMatchSelectWidth styles={{ popup: { root: { maxWidth: 'calc(100vw - 24px)' } } }}
    optionRender={option => option.data.guest ? <GuestRow guest={option.data.guest} details /> : option.data.label}
    options={[...(recommended.length ? [{ label: 'Matching room preference', options: options(recommended) }] : []), ...(others.length ? [{ label: 'Other guests — check preference', options: options(others) }] : [])]} />;
}
