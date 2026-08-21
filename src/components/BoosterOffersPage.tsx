import React, { useEffect, useMemo, useState } from 'react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { boosterOffersApi, bookingsApi, ceremoniesApi, retreatsApi } from '../services/api';
import { BoosterOffer, Ceremony, Retreat, RetreatClient } from '../types';
import { isCancelledBookingStatus } from './retreatClientVisibility';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: Component, className }) => <Component className={className} />;
const idOf = (value: any) => String(value?._id || value || '');
const dateTimeLocal = (value: Date | string, time = '18:00') => `${new Date(value).toISOString().slice(0, 10)}T${time}`;

const BoosterOffersPage: React.FC = () => {
  const [offers, setOffers] = useState<BoosterOffer[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [bookings, setBookings] = useState<RetreatClient[]>([]);
  const [ceremonies, setCeremonies] = useState<Ceremony[]>([]);
  const [retreatId, setRetreatId] = useState('');
  const [retreatSearch, setRetreatSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const selectedRetreat = useMemo(() => retreats.find((item) => item._id === retreatId), [retreatId, retreats]);
  const activeBookingsFor = (id: string) => bookings.filter((booking) =>
    idOf(booking.retreatId) === id && !isCancelledBookingStatus(booking.status)
  );
  const boosterSpotsFor = (retreat: Retreat) => {
    const active = activeBookingsFor(idOf(retreat));
    const ceremonyCount = Math.max(1, Number(retreat.ceremonyCount || 2));
    const used = active.reduce((sum, booking) => sum + (booking.bookingType === 'booster' ? 1 : ceremonyCount), 0);
    return Math.max(0, Number(retreat.capacity || 0) * ceremonyCount - used);
  };
  const selectedBookings = activeBookingsFor(retreatId);
  const fullRetreatBookings = selectedBookings.filter((booking) => booking.bookingType !== 'booster').length;
  const totalBoosterSpots = selectedRetreat ? boosterSpotsFor(selectedRetreat) : 0;
  const ceremonyRemaining = (ceremony: Ceremony, index: number) => {
    const boosterBookings = selectedBookings.filter((booking) => booking.bookingType === 'booster' && (
      idOf(booking.ceremonyId) === idOf(ceremony) || (!booking.ceremonyId && Number(booking.ceremonyNumber) === index + 1)
    )).length;
    return Math.max(0, Number(selectedRetreat?.capacity || 0) - fullRetreatBookings - boosterBookings);
  };
  const retreatLabel = (retreat: Retreat) => `${retreat.code || retreat.retreatCode || retreat.name} · ${boosterSpotsFor(retreat)} booster spot${boosterSpotsFor(retreat) === 1 ? '' : 's'}`;

  const load = async () => {
    setLoading(true);
    try {
      const [offerResponse, retreatResponse, bookingResponse] = await Promise.all([
        boosterOffersApi.getAll(), retreatsApi.getAll(), bookingsApi.getAll(),
      ]);
      setOffers(offerResponse.data || []);
      setRetreats((retreatResponse.data || []).filter((item: Retreat) => item.status !== 'cancelled'));
      setBookings(bookingResponse.data || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!retreatId) { setCeremonies([]); return; }
    ceremoniesApi.getByRetreat(retreatId).then((response) => setCeremonies(response.data || []));
  }, [retreatId]);

  const addCeremony = async (ceremony: Ceremony) => {
    const index = ceremonies.findIndex((item) => item._id === ceremony._id);
    const available = ceremonyRemaining(ceremony, index);
    if (!selectedRetreat || !ceremony._id || available === 0 || offers.some((offer) => idOf(offer.ceremonyId) === ceremony._id)) return;
    const next = ceremonies[index + 1];
    await boosterOffersApi.create({
      retreatId,
      ceremonyId: ceremony._id,
      ceremonyNumber: index + 1,
      arrivalAt: dateTimeLocal((index === 0 ? selectedRetreat.startDate : ceremony.date) || new Date(), index === 0 ? selectedRetreat.startTime : '19:00'),
      departureAt: dateTimeLocal(next?.date || selectedRetreat.endDate || ceremony.date || new Date(), next ? '19:00' : selectedRetreat.endTime || '11:00'),
      capacity: available,
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

  const groupedOffers = offers.reduce<Array<{ key: string; retreat: any; offers: BoosterOffer[] }>>((groups, offer) => {
    const retreat: any = offer.retreatId;
    const key = idOf(retreat) || 'unknown';
    const group = groups.find((item) => item.key === key);
    if (group) group.offers.push(offer);
    else groups.push({ key, retreat, offers: [offer] });
    return groups;
  }, []);
  const publishedCount = offers.filter((offer) => offer.published).length;

  return <div className="min-h-full bg-[#f7f6f4] px-5 py-8 text-[#222] sm:px-8 lg:px-12">
    <header className="mx-auto max-w-[1500px] border-b-4 border-double border-[#222] pb-4">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div><div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Retreat operations</div><h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-6xl">Ceremony schedule</h1></div>
        <div className="flex flex-col items-start gap-3 lg:items-end"><div className="font-serif text-sm text-gray-500">{offers.length} ceremon{offers.length === 1 ? 'y' : 'ies'} · {publishedCount} published</div><div className="w-full min-w-0 sm:w-[430px]"><input list="booster-retreat-options" value={retreatSearch} onChange={(event) => { const value = event.target.value; setRetreatSearch(value); const match = retreats.find((retreat) => retreatLabel(retreat) === value); setRetreatId(match?._id || ''); }} placeholder="Search a retreat to configure…" className="w-full border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-[#0088aa]"/><datalist id="booster-retreat-options">{retreats.map((retreat) => <option key={retreat._id} value={retreatLabel(retreat)} />)}</datalist></div></div>
      </div>
    </header>

    <main className="mx-auto max-w-[1500px]">
      {retreatId && <section className="grid gap-10 py-16 lg:grid-cols-[1fr_1.15fr] lg:items-start">
        <div><div className="mb-6 text-xs font-semibold uppercase tracking-[0.18em] text-pink-700">Available to configure</div><p className="max-w-xl font-serif text-3xl font-semibold leading-[1.35]">{fullRetreatBookings} full-retreat and {selectedBookings.length - fullRetreatBookings} booster booking{selectedBookings.length - fullRetreatBookings === 1 ? '' : 's'} leave {totalBoosterSpots} booster ceremony spot{totalBoosterSpots === 1 ? '' : 's'}. You still choose exactly which ceremonies to publish.</p></div>
        <div className="space-y-3">{ceremonies.map((ceremony, index) => { const configured = offers.some((offer) => idOf(offer.ceremonyId) === ceremony._id); const available = ceremonyRemaining(ceremony, index); return <button key={ceremony._id} disabled={configured || available === 0} onClick={() => addCeremony(ceremony)} className="flex w-full items-center justify-between border border-gray-300 bg-white px-5 py-4 text-left transition hover:border-[#0088aa] hover:bg-cyan-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-55"><span className="flex items-center gap-4 font-serif text-lg font-semibold"><Icon icon={FiPlus} className="text-[#0088aa]"/> Ceremony {index + 1}</span><span className="text-sm text-gray-500">{new Date(ceremony.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · {available} spot{available === 1 ? '' : 's'}{configured ? ' · configured' : ''}</span></button>; })}</div>
      </section>}

      {!retreatId && <div className="py-14 text-center font-serif text-xl text-gray-500">Search for a retreat above to configure additional ceremony offers.</div>}

      <div className="space-y-16 pb-20">{groupedOffers.map((group) => <section key={group.key}>
        <h2 className="border-b border-gray-300 pb-2 font-serif text-3xl font-semibold">{group.retreat?.code || group.retreat?.retreatCode || group.retreat?.name || 'Retreat'}</h2>
        <div className="hidden grid-cols-[180px_225px_225px_85px_170px_220px_145px_40px] gap-3 border-b border-gray-200 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 xl:grid">{['Ceremony','Arrival','Departure','Places','Price','Availability','Public',''].map((label) => <div key={label}>{label}</div>)}</div>
        <div className="divide-y divide-gray-200">{group.offers.map((offer) => <div key={offer._id} className="grid gap-4 py-5 xl:grid-cols-[180px_225px_225px_85px_170px_220px_145px_40px] xl:items-center xl:gap-3">
          <div className="font-serif text-lg font-semibold">Ceremony {offer.ceremonyNumber}</div>
          <label className="text-xs uppercase tracking-wide text-gray-500 xl:text-[0px]"><span className="mb-1 block xl:hidden">Arrival</span><input aria-label="Arrival" type="datetime-local" value={offer.arrivalAt.slice(0,16)} onChange={(e) => update(offer, { arrivalAt: e.target.value })} className="w-full border border-gray-300 bg-[#f1f0ee] px-3 py-3 text-sm text-gray-900"/></label>
          <label className="text-xs uppercase tracking-wide text-gray-500 xl:text-[0px]"><span className="mb-1 block xl:hidden">Departure</span><input aria-label="Departure" type="datetime-local" value={offer.departureAt.slice(0,16)} onChange={(e) => update(offer, { departureAt: e.target.value })} className="w-full border border-gray-300 bg-[#f1f0ee] px-3 py-3 text-sm text-gray-900"/></label>
          <label><span className="mb-1 block text-xs uppercase tracking-wide text-gray-500 xl:hidden">Places</span><input aria-label="Places" type="number" min="1" value={offer.capacity} onChange={(e) => update(offer, { capacity: Number(e.target.value) })} className="w-full border border-gray-300 bg-[#f1f0ee] px-3 py-3 text-center text-sm"/></label>
          <label><span className="mb-1 block text-xs uppercase tracking-wide text-gray-500 xl:hidden">Price</span><div className="flex"><input aria-label="Price" type="number" min="0" value={offer.price ?? ''} placeholder="—" onChange={(e) => update(offer, { price: e.target.value === '' ? undefined : Number(e.target.value) })} className="min-w-0 flex-1 border border-r-0 border-gray-300 bg-[#f1f0ee] px-3 py-3 text-right text-sm"/><select aria-label="Currency" value={offer.currency} onChange={(e) => update(offer, { currency: e.target.value as BoosterOffer['currency'] })} className="border border-gray-300 bg-[#f1f0ee] px-2 text-xs text-gray-600"><option>EUR</option><option>USD</option><option>CZK</option><option>PLN</option></select></div></label>
          <div><span className="mb-1 block text-xs uppercase tracking-wide text-gray-500 xl:hidden">Availability</span><strong className="mr-2 font-serif text-2xl text-[#007b9d]">{offer.remaining || 0}</strong><span className="text-sm text-gray-500">free · {offer.reserved || 0} booked</span></div>
          <label className="flex items-center gap-3 font-serif text-base"><input type="checkbox" checked={offer.published} onChange={(e) => update(offer, { published: e.target.checked })} className="h-5 w-5 accent-[#0088aa]"/> Published</label>
          <button title="Delete offer" onClick={async () => { if (offer._id && window.confirm('Delete this booster offer?')) { await boosterOffersApi.delete(offer._id); await load(); } }} className="text-pink-600 hover:text-pink-800"><Icon icon={FiTrash2}/></button>
        </div>)}</div>
      </section>)}</div>

      {!loading && !offers.length && <div className="border-y border-gray-300 py-16 text-center font-serif text-xl text-gray-500">No booster offers yet. Search for a retreat and add a ceremony.</div>}
      <footer className="flex justify-between border-t border-gray-200 py-6 font-mono text-xs text-gray-500"><span>Booster schedule</span><span>Changes save as you edit</span></footer>
    </main>
  </div>;
};

export default BoosterOffersPage;
