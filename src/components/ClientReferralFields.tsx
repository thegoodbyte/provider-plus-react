import React, { useEffect, useMemo, useState } from 'react';
import { clientsApi } from '../services/api';
import { Client, Referral } from '../types';

type Props = {
  value: Partial<Client>;
  referrals: Referral[];
  onChange: (patch: Partial<Client>) => void;
  currentClientId?: string;
  className?: string;
};

const objectId = (value?: string | { _id?: string }) => typeof value === 'object' ? value?._id || '' : value || '';
const clientLabel = (client?: Partial<Client>) => client
  ? `${client.firstName || ''} ${client.lastName || ''}`.trim() + (client.display_id ? ` · #${client.display_id}` : '')
  : '';

const ClientReferralFields: React.FC<Props> = ({ value, referrals, onChange, currentClientId, className = '' }) => {
  const referralId = objectId(value.referralId);
  const selectedReferral = referrals.find((item) => item._id === referralId);
  const isFriend = String(selectedReferral?.name || '').trim().toLowerCase() === 'friend';
  const selectedClient = typeof value.referralClientId === 'object' ? value.referralClientId : undefined;
  const [query, setQuery] = useState(clientLabel(selectedClient));
  const [matches, setMatches] = useState<Client[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (value.referralPersonType !== 'existing_client' || query.trim().length < 2 || objectId(value.referralClientId)) {
      setMatches([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await clientsApi.search(query.trim());
        setMatches((response.data || []).filter((client) => client._id !== currentClientId).slice(0, 8));
      } catch {
        setMatches([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [currentClientId, query, value.referralClientId, value.referralPersonType]);

  const options = useMemo(() => referrals.filter((item) => item.isActive !== false || item._id === referralId), [referralId, referrals]);
  const field = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200';

  return <div className={`space-y-3 ${className}`}>
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">Referral</label>
      <select value={referralId} onChange={(event) => {
        const referral = referrals.find((item) => item._id === event.target.value);
        onChange({ referralId: event.target.value || undefined, source: referral?.name || '', referralPersonType: undefined, referralClientId: undefined, referralPersonName: undefined });
        setQuery('');
      }} className={field}>
        <option value="">{value.source ? `Unlinked: ${value.source}` : 'No referral selected'}</option>
        {options.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
      </select>
    </div>

    {!referralId && <input value={value.source || ''} onChange={(event) => onChange({ source: event.target.value })} placeholder="How did they find us?" className={field} />}

    {isFriend && <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
      <div className="mb-2 text-sm font-medium text-gray-700">Who was the friend?</div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={value.referralPersonType === 'existing_client'} onChange={() => { onChange({ referralPersonType: 'existing_client', referralPersonName: undefined }); setQuery(''); }} /> Existing client</label>
        <label className="flex items-center gap-2 text-sm"><input type="radio" checked={value.referralPersonType === 'someone_else'} onChange={() => { onChange({ referralPersonType: 'someone_else', referralClientId: undefined }); setQuery(''); }} /> Someone else</label>
      </div>

      {value.referralPersonType === 'existing_client' && <div className="relative mt-3">
        <input value={query} onChange={(event) => { setQuery(event.target.value); onChange({ referralClientId: undefined }); }} placeholder="Type at least 2 characters to search clients" minLength={2} className={field} />
        {query.trim().length === 1 && <p className="mt-1 text-xs text-gray-500">Enter one more character to search.</p>}
        {searching && <p className="mt-1 text-xs text-gray-500">Searching…</p>}
        {matches.length > 0 && <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {matches.map((client) => <button key={client._id} type="button" onClick={() => { onChange({ referralClientId: client._id }); setQuery(clientLabel(client)); setMatches([]); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50">{clientLabel(client)}{client.email ? ` · ${client.email}` : ''}</button>)}
        </div>}
      </div>}

      {value.referralPersonType === 'someone_else' && <div className="mt-3">
        <input value={value.referralPersonName || ''} onChange={(event) => onChange({ referralPersonName: event.target.value })} placeholder="Enter their name" minLength={2} className={field} />
        {(value.referralPersonName || '').length === 1 && <p className="mt-1 text-xs text-gray-500">Name must contain at least 2 characters.</p>}
      </div>}
    </div>}
  </div>;
};

export default ClientReferralFields;
