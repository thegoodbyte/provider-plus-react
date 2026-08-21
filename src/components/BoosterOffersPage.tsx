import React, { useEffect, useMemo, useState } from 'react';
import { FiPlus, FiTrash2, FiZap } from 'react-icons/fi';
import { boosterOffersApi, ceremoniesApi, retreatsApi } from '../services/api';
import { BoosterOffer, Ceremony, Retreat } from '../types';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: Component, className }) => <Component className={className} />;
const idOf = (value: any) => String(value?._id || value || '');
const dateTimeLocal = (value: Date | string, time = '18:00') => `${new Date(value).toISOString().slice(0, 10)}T${time}`;

const BoosterOffersPage: React.FC = () => {
  const [offers, setOffers] = useState<BoosterOffer[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [ceremonies, setCeremonies] = useState<Ceremony[]>([]);
  const [retreatId, setRetreatId] = useState('');
  const [loading, setLoading] = useState(true);
  const selectedRetreat = useMemo(() => retreats.find((item) => item._id === retreatId), [retreatId, retreats]);
  const suggestedPlaces = Math.max(0, Number(selectedRetreat?.capacity || 0) - Number(selectedRetreat?.currentOccupancy || 0));

  const load = async () => {
    setLoading(true);
    try {
      const [offerResponse, retreatResponse] = await Promise.all([boosterOffersApi.getAll(), retreatsApi.getAll()]);
      setOffers(offerResponse.data || []);
      setRetreats((retreatResponse.data || []).filter((item: Retreat) => item.status !== 'cancelled'));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!retreatId) { setCeremonies([]); return; }
    ceremoniesApi.getByRetreat(retreatId).then((response) => setCeremonies(response.data || []));
  }, [retreatId]);

  const addCeremony = async (ceremony: Ceremony) => {
    if (!selectedRetreat || !ceremony._id || offers.some((offer) => idOf(offer.ceremonyId) === ceremony._id)) return;
    const index = ceremonies.findIndex((item) => item._id === ceremony._id);
    const next = ceremonies[index + 1];
    await boosterOffersApi.create({
      retreatId,
      ceremonyId: ceremony._id,
      ceremonyNumber: index + 1,
      arrivalAt: dateTimeLocal((index === 0 ? selectedRetreat.startDate : ceremony.date) || new Date(), index === 0 ? selectedRetreat.startTime : '19:00'),
      departureAt: dateTimeLocal(next?.date || selectedRetreat.endDate || ceremony.date || new Date(), next ? '19:00' : selectedRetreat.endTime || '11:00'),
      capacity: Math.max(1, suggestedPlaces),
      currency: 'EUR',
      published: false,
    });
    await load();
  };

  const update = async (offer: BoosterOffer, changes: Partial<BoosterOffer>) => {
    setOffers((items) => items.map((item) => item._id === offer._id ? { ...item, ...changes } : item));
    if (offer._id) await boosterOffersApi.update(offer._id, changes);
    await load();
  };

  return <div className="p-6">
    <div className="mb-6 flex items-start justify-between gap-4">
      <div><h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900"><Icon icon={FiZap} className="text-amber-500" /> Booster Offers</h1><p className="mt-1 text-sm text-gray-600">You control which ceremony slots are publicly offered. Booster bookings automatically reduce availability.</p></div>
      <select value={retreatId} onChange={(event) => setRetreatId(event.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
        <option value="">Choose a retreat to offer slots</option>{retreats.map((retreat) => <option key={retreat._id} value={retreat._id}>{retreat.code || retreat.retreatCode || retreat.name}</option>)}
      </select>
    </div>

    {retreatId && <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="mb-1 font-medium text-amber-950">Available ceremonies to configure</div><div className="mb-3 text-sm text-amber-800">Retreat capacity suggests {suggestedPlaces} empty place{suggestedPlaces === 1 ? '' : 's'}. You still choose exactly which ceremonies to publish.</div><div className="flex flex-wrap gap-2">{ceremonies.map((ceremony, index) => {
      const configured = offers.some((offer) => idOf(offer.ceremonyId) === ceremony._id);
      return <button key={ceremony._id} disabled={configured} onClick={() => addCeremony(ceremony)} className="flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm disabled:opacity-50"><Icon icon={FiPlus} /> Ceremony {index + 1} · {new Date(ceremony.date).toLocaleDateString()}</button>;
    })}</div></div>}

    <div className="overflow-x-auto rounded-xl bg-white shadow-sm"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr>{['Retreat / ceremony','Arrival','Departure','Places','Price','Availability','Public',''].map((label) => <th key={label} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">
      {!loading && offers.map((offer) => { const retreat: any = offer.retreatId; return <tr key={offer._id}>
        <td className="px-4 py-3"><div className="font-medium">{retreat?.code || retreat?.retreatCode || retreat?.name}</div><div className="text-xs text-gray-500">Ceremony {offer.ceremonyNumber}</div></td>
        <td className="px-4 py-3"><input type="datetime-local" value={offer.arrivalAt.slice(0,16)} onChange={(e) => update(offer, { arrivalAt: e.target.value })} className="rounded border px-2 py-1 text-sm" /></td>
        <td className="px-4 py-3"><input type="datetime-local" value={offer.departureAt.slice(0,16)} onChange={(e) => update(offer, { departureAt: e.target.value })} className="rounded border px-2 py-1 text-sm" /></td>
        <td className="px-4 py-3"><input type="number" min="1" value={offer.capacity} onChange={(e) => update(offer, { capacity: Number(e.target.value) })} className="w-16 rounded border px-2 py-1" /></td>
        <td className="px-4 py-3"><div className="flex gap-1"><input type="number" min="0" value={offer.price || ''} onChange={(e) => update(offer, { price: Number(e.target.value) })} className="w-20 rounded border px-2 py-1" /><span className="py-1 text-sm">{offer.currency}</span></div></td>
        <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${offer.remaining ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{offer.remaining || 0} available · {offer.reserved || 0} booked</span></td>
        <td className="px-4 py-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={offer.published} onChange={(e) => update(offer, { published: e.target.checked })} /> Published</label></td>
        <td className="px-4 py-3"><button title="Delete offer" onClick={async () => { if (offer._id && window.confirm('Delete this booster offer?')) { await boosterOffersApi.delete(offer._id); await load(); } }} className="text-red-600"><Icon icon={FiTrash2} /></button></td>
      </tr>; })}
    </tbody></table>{!loading && !offers.length && <div className="p-8 text-center text-gray-500">No booster offers yet. Choose a retreat and add a ceremony slot.</div>}</div>
  </div>;
};

export default BoosterOffersPage;
