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
  const ceremonyDateFor = (offer: BoosterOffer) => {
    const ceremony = offer.ceremonyId as Ceremony;
    return ceremony?.date ? new Date(ceremony.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'Date unavailable';
  };
  const retreatCapacityFor = (offer: BoosterOffer) => Number((offer.retreatId as Retreat)?.capacity || 0);
  const weekdayFor = (value: string) => new Date(value).toLocaleDateString(undefined, { weekday: 'long' });

  return <div className="min-h-full bg-[#f7f6f4] px-4 py-6 text-[#222] sm:px-6 lg:px-8">
    <header className="mx-auto max-w-[1280px] border-b-4 border-double border-[#222] pb-3">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div><div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Retreat operations</div><h1 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">Booster availability</h1></div>
        <div className="flex flex-col items-start gap-2 lg:items-end"><div className="font-serif text-xs text-gray-500">{offers.length} ceremon{offers.length === 1 ? 'y' : 'ies'} · {publishedCount} published</div><div className="w-full min-w-0 sm:w-[350px]"><input list="booster-retreat-options" value={retreatSearch} onChange={(event) => { const value = event.target.value; setRetreatSearch(value); const match = retreats.find((retreat) => retreatLabel(retreat) === value); setRetreatId(match?._id || ''); }} placeholder="Search a retreat to configure…" className="w-full border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#0088aa]"/><datalist id="booster-retreat-options">{retreats.map((retreat) => <option key={retreat._id} value={retreatLabel(retreat)} />)}</datalist></div></div>
      </div>
    </header>

    <main className="mx-auto max-w-[1280px]">
      {retreatId && <section className="grid gap-8 py-10 lg:grid-cols-[1fr_1.15fr] lg:items-start">
        <div><div className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-pink-700">Available to configure</div><p className="max-w-xl font-serif text-2xl font-semibold leading-[1.3]">{fullRetreatBookings} full-retreat and {selectedBookings.length - fullRetreatBookings} booster booking{selectedBookings.length - fullRetreatBookings === 1 ? '' : 's'} leave {totalBoosterSpots} booster ceremony spot{totalBoosterSpots === 1 ? '' : 's'}. You still choose exactly which ceremonies to publish.</p></div>
        <div className="space-y-3">{ceremonies.map((ceremony, index) => { const configured = offers.some((offer) => idOf(offer.ceremonyId) === ceremony._id); const available = ceremonyRemaining(ceremony, index); return <button key={ceremony._id} disabled={configured || available === 0} onClick={() => addCeremony(ceremony)} className="flex w-full items-center justify-between border border-gray-300 bg-white px-5 py-4 text-left transition hover:border-[#0088aa] hover:bg-cyan-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-55"><span className="flex items-center gap-4 font-serif text-lg font-semibold"><Icon icon={FiPlus} className="text-[#0088aa]"/> Ceremony {index + 1}</span><span className="text-sm text-gray-500">{new Date(ceremony.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · {available} spot{available === 1 ? '' : 's'}{configured ? ' · configured' : ''}</span></button>; })}</div>
      </section>}

      {!retreatId && <div className="py-14 text-center font-serif text-xl text-gray-500">Search for a retreat above to configure additional ceremony offers.</div>}

      <div className="space-y-16 pb-20">{groupedOffers.map((group) => <section key={group.key}>
        <h2 className="border-b border-gray-300 pb-2 font-serif text-3xl font-semibold">{group.retreat?.code || group.retreat?.retreatCode || group.retreat?.name || 'Retreat'}</h2>
        <div className="hidden grid-cols-[110px_minmax(160px,1fr)_155px_minmax(160px,1fr)_70px_145px_105px_28px] gap-2 border-b border-gray-200 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 lg:grid">{['Ceremony','Arrival','Ceremony date','Departure','Places','Availability','Public',''].map((label) => <div key={label}>{label}</div>)}</div>
        <div className="divide-y divide-gray-200">{group.offers.map((offer) => <div key={offer._id} className="grid gap-3 py-4 lg:grid-cols-[110px_minmax(160px,1fr)_155px_minmax(160px,1fr)_70px_145px_105px_28px] lg:items-center lg:gap-2">
          <div className="font-serif text-lg font-semibold">Ceremony {offer.ceremonyNumber}</div>
          <label className="text-xs uppercase tracking-wide text-gray-500"><span className="mb-1 block lg:hidden">Arrival</span><input aria-label="Arrival" type="datetime-local" value={offer.arrivalAt.slice(0,16)} onChange={(e) => update(offer, { arrivalAt: e.target.value })} className="w-full border border-gray-300 bg-[#f1f0ee] px-2 py-2 text-xs text-gray-900"/><span className="mt-1 block font-serif text-[11px] capitalize tracking-normal text-gray-500">{weekdayFor(offer.arrivalAt)}</span></label>
          <div><span className="mb-1 block text-xs uppercase tracking-wide text-gray-500 lg:hidden">Ceremony date</span><span className="font-serif text-sm font-semibold text-gray-800">{ceremonyDateFor(offer)}</span></div>
          <label className="text-xs uppercase tracking-wide text-gray-500"><span className="mb-1 block lg:hidden">Departure</span><input aria-label="Departure" type="datetime-local" value={offer.departureAt.slice(0,16)} onChange={(e) => update(offer, { departureAt: e.target.value })} className="w-full border border-gray-300 bg-[#f1f0ee] px-2 py-2 text-xs text-gray-900"/><span className="mt-1 block font-serif text-[11px] capitalize tracking-normal text-gray-500">{weekdayFor(offer.departureAt)}</span></label>
          <label><span className="mb-1 block text-xs uppercase tracking-wide text-gray-500 lg:hidden">Places</span><select aria-label="Places" value={offer.capacity} onChange={(e) => update(offer, { capacity: Number(e.target.value) })} className="w-full border border-gray-300 bg-[#f1f0ee] px-2 py-2 text-center text-xs">{Array.from({ length: retreatCapacityFor(offer) + 1 }, (_, places) => <option key={places} value={places}>{places}</option>)}</select></label>
          <div><span className="mb-1 block text-xs uppercase tracking-wide text-gray-500 lg:hidden">Availability</span><strong className="mr-1 font-serif text-xl text-[#007b9d]">{offer.remaining || 0}</strong><span className="text-xs text-gray-500">free · {offer.reserved || 0} booked</span></div>
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
