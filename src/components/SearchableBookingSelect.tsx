import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Client, Retreat, RetreatClient } from '../types';
import { FiChevronDown, FiSearch, FiX } from 'react-icons/fi';

const resolveId = (value: any) => (typeof value === 'object' && value?._id ? value._id : value || '');
export const normalizeBookingSearch = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase();
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => <IconComponent className={className} />;

interface Props {
  bookings: RetreatClient[];
  clients: Client[];
  retreats: Retreat[];
  selectedBookingId: string;
  onBookingSelect: (bookingId: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
}

const SearchableBookingSelect: React.FC<Props> = ({
  bookings,
  clients,
  retreats,
  selectedBookingId,
  onBookingSelect,
  placeholder = 'Search booking number, client, or retreat',
  emptyLabel = 'No booking selected',
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = bookings.find((booking) => booking._id === selectedBookingId);

  const details = useCallback((booking: RetreatClient) => {
    const client = typeof booking.clientId === 'object'
      ? booking.clientId as Client
      : clients.find((item) => item._id === resolveId(booking.clientId));
    const retreat = typeof booking.retreatId === 'object'
      ? booking.retreatId as Retreat
      : retreats.find((item) => item._id === resolveId(booking.retreatId));
    const clientName = client ? [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ') : 'Unknown client';
    const retreatName = retreat?.name || retreat?.code || retreat?.retreatCode || 'Unknown retreat';
    return { client, retreat, clientName, retreatName };
  }, [clients, retreats]);

  const label = (booking: RetreatClient) => {
    const { clientName, retreatName } = details(booking);
    return `#${booking.bookingNumber || booking._id?.slice(-6)} · ${clientName} · ${retreatName}`;
  };

  const filtered = useMemo(() => {
    const term = normalizeBookingSearch(search.trim().replace(/^#/, ''));
    if (!term) return bookings.slice(0, 80);
    return bookings.filter((booking) => {
      const { client, retreat, clientName, retreatName } = details(booking);
      return [
        booking.bookingNumber,
        booking.bookingHash,
        booking.status,
        booking._id,
        clientName,
        client?.display_id,
        client?.email,
        retreatName,
        retreat?.code,
        retreat?.retreatCode,
      ].some((value) => normalizeBookingSearch(value).includes(term));
    }).slice(0, 80);
  }, [bookings, details, search]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const choose = (bookingId: string) => {
    onBookingSelect(bookingId);
    setOpen(false);
    setSearch('');
    setHighlightedIndex(0);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && ['Enter', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((current) => Math.min(current + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter' && filtered[highlightedIndex]) {
      event.preventDefault();
      choose(filtered[highlightedIndex]._id || '');
    } else if (event.key === 'Escape') {
      setOpen(false);
      setSearch('');
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          aria-label="Search and select booking"
          aria-expanded={open}
          aria-controls="searchable-booking-options"
          role="combobox"
          autoComplete="off"
          value={open ? search : selected ? label(selected) : ''}
          placeholder={placeholder}
          onFocus={() => { setOpen(true); setHighlightedIndex(0); }}
          onChange={(event) => { setSearch(event.target.value); setOpen(true); setHighlightedIndex(0); }}
          onKeyDown={handleKeyDown}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 pr-16 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
          {selected && <button type="button" aria-label="Clear booking" onClick={() => choose('')} className="p-1 text-gray-400 hover:text-gray-600"><Icon icon={FiX} className="h-4 w-4" /></button>}
          <button type="button" aria-label="Toggle booking options" onClick={() => { setOpen((current) => !current); inputRef.current?.focus(); }} className="p-1 text-gray-400 hover:text-gray-600">
            {open ? <Icon icon={FiSearch} className="h-4 w-4" /> : <Icon icon={FiChevronDown} className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {open && <div id="searchable-booking-options" role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-gray-300 bg-white py-1 shadow-lg">
        {!selectedBookingId && <button type="button" onClick={() => choose('')} className="block w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50">{emptyLabel}</button>}
        {filtered.map((booking, index) => {
          const info = details(booking);
          return <button
            type="button"
            role="option"
            aria-selected={booking._id === selectedBookingId}
            key={booking._id}
            onMouseEnter={() => setHighlightedIndex(index)}
            onClick={() => choose(booking._id || '')}
            className={`block w-full border-t border-gray-100 px-3 py-2 text-left ${index === highlightedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
          >
            <span className="block text-sm font-semibold text-gray-900">#{booking.bookingNumber || booking._id?.slice(-6)} · {info.clientName}</span>
            <span className="block text-xs text-gray-500">{info.retreatName}{booking.status ? ` · ${booking.status}` : ''}{info.client?.display_id ? ` · Client #${info.client.display_id}` : ''}</span>
          </button>;
        })}
        {!filtered.length && <div className="px-3 py-5 text-center text-sm text-gray-500">No bookings match “{search}”.</div>}
      </div>}
    </div>
  );
};

export default SearchableBookingSelect;
