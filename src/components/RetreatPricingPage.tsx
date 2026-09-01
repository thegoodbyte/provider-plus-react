import React, { useEffect, useMemo, useState } from 'react';
import { FiArrowLeft, FiSave } from 'react-icons/fi';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { retreatsApi } from '../services/api';
import { Retreat } from '../types';
import LoadingSpinner from './LoadingSpinner';

type Prices = {
  closeShared: number; closePrivate: number; closeEnsuite: number;
  midShared: number; midPrivate: number; midEnsuite: number;
  farShared: number; farPrivate: number; farEnsuite: number;
  addictionSupport: number;
};

const DEFAULTS: Prices = {
  closeShared: 9500, closePrivate: 10500, closeEnsuite: 11500,
  midShared: 8500, midPrivate: 9500, midEnsuite: 10500,
  farShared: 7500, farPrivate: 8500, farEnsuite: 9500,
  addictionSupport: 1500,
};
const Icon: React.FC<{ component: any }> = ({ component }) => React.createElement(component);

const RetreatPricingPage: React.FC = () => {
  const { retreatId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const prefix = useMemo(() => {
    const first = location.pathname.split('/').filter(Boolean)[0];
    return ['admin', 'medical', 'staff', 'user'].includes(first) ? `/${first}` : '';
  }, [location.pathname]);
  const [retreat, setRetreat] = useState<Retreat | null>(null);
  const [prices, setPrices] = useState<Prices>(DEFAULTS);
  const [included, setIncluded] = useState('');
  const [showOnSite, setShowOnSite] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    retreatsApi.getOne(retreatId).then(({ data: item }) => {
      setRetreat(item);
      setShowOnSite(item.showOnSite !== false);
      const pl = item.websitePricing?.byRegion?.pl || item.websitePricing?.pl || {};
      const tiers = Array.isArray(pl.tiers) ? pl.tiers : [];
      const tier = (key: string, index: number) => tiers.find((entry: any) => entry.key === key) || tiers[index] || {};
      const close = tier('0_3', 0), mid = tier('4_6', 1), far = tier('6_plus', 2);
      setPrices({
        closeShared: Number(close.sharedRoom ?? DEFAULTS.closeShared), closePrivate: Number(close.privateRoom ?? DEFAULTS.closePrivate), closeEnsuite: Number(close.privateEnsuite ?? DEFAULTS.closeEnsuite),
        midShared: Number(mid.sharedRoom ?? DEFAULTS.midShared), midPrivate: Number(mid.privateRoom ?? DEFAULTS.midPrivate), midEnsuite: Number(mid.privateEnsuite ?? DEFAULTS.midEnsuite),
        farShared: Number(far.sharedRoom ?? DEFAULTS.farShared), farPrivate: Number(far.privateRoom ?? DEFAULTS.farPrivate), farEnsuite: Number(far.privateEnsuite ?? DEFAULTS.farEnsuite),
        addictionSupport: Number(pl.addictionSupport ?? DEFAULTS.addictionSupport),
      });
      const items = item.websiteContent?.includedItems?.pl || (Array.isArray(item.websiteContent?.includedItems) ? item.websiteContent.includedItems : []);
      setIncluded((items || []).join('\n'));
    }).catch((cause) => setError(cause?.response?.data?.message || cause?.message || 'Unable to load retreat pricing.')).finally(() => setLoading(false));
  }, [retreatId]);

  const save = async () => {
    if (!retreat) return;
    setSaving(true); setSaved(false); setError('');
    try {
      const websitePricing = {
        ...(retreat.websitePricing || {}),
        byRegion: {
          ...(retreat.websitePricing?.byRegion || {}),
          pl: {
            ...(retreat.websitePricing?.byRegion?.pl || retreat.websitePricing?.pl || {}),
            currency: 'PLN', symbol: 'zł', format: '{price} {symbol}', addictionSupport: Number(prices.addictionSupport),
            tiers: [
              { key: '0_3', label: '0–3 months', daysFrom: 0, daysTo: 90, sharedRoom: Number(prices.closeShared), privateRoom: Number(prices.closePrivate), privateEnsuite: Number(prices.closeEnsuite) },
              { key: '4_6', label: '4–6 months', daysFrom: 91, daysTo: 180, sharedRoom: Number(prices.midShared), privateRoom: Number(prices.midPrivate), privateEnsuite: Number(prices.midEnsuite) },
              { key: '6_plus', label: '6+ months', daysFrom: 181, daysTo: null, sharedRoom: Number(prices.farShared), privateRoom: Number(prices.farPrivate), privateEnsuite: Number(prices.farEnsuite) },
            ],
          },
        },
      };
      const existingContent = retreat.websiteContent || {};
      const websiteContent = {
        ...existingContent,
        includedItems: {
          ...(Array.isArray(existingContent.includedItems) ? { en: existingContent.includedItems } : existingContent.includedItems || {}),
          pl: included.split('\n').map((item) => item.trim()).filter(Boolean),
        },
      };
      const response = await retreatsApi.update(retreatId, { websitePricing, websiteContent, showOnSite });
      setRetreat(response.data || { ...retreat, websitePricing, websiteContent, showOnSite });
      setSaved(true);
    } catch (cause: any) {
      const message = cause?.response?.data?.message || cause?.message || 'Unable to save pricing.';
      setError(Array.isArray(message) ? message.join(' ') : String(message));
    } finally { setSaving(false); }
  };

  if (loading) return <LoadingSpinner message="Loading retreat pricing…" />;
  if (!retreat) return <div className="p-6"><div className="alert alert-danger">{error || 'Retreat not found.'}</div></div>;
  const field = 'w-full border border-[#aeb5bf] bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600';
  const label = 'mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-gray-600';
  const rows: Array<[string, keyof Prices, keyof Prices, keyof Prices, string]> = [
    ['0–3 months', 'closeShared', 'closePrivate', 'closeEnsuite', '0–90 days before arrival'],
    ['4–6 months', 'midShared', 'midPrivate', 'midEnsuite', '91–180 days before arrival'],
    ['6+ months', 'farShared', 'farPrivate', 'farEnsuite', '181+ days before arrival'],
  ];
  const occupancy = Number(retreat.currentOccupancy || 0), capacity = Number(retreat.capacity || 0);

  return <main className="mx-auto min-h-full max-w-7xl border-t-4 border-blue-600 bg-[#eceff3] text-gray-900">
    <header className="flex flex-col gap-4 border-b border-gray-900 bg-white px-5 py-5 md:flex-row md:items-center md:justify-between md:px-8">
      <div><button className="mb-3 inline-flex items-center gap-2 text-sm text-blue-700" onClick={() => navigate(`${prefix}/retreats/${retreatId}`)}><Icon component={FiArrowLeft}/> Back to retreat</button><h1 className="text-2xl font-bold">Retreat pricing &amp; website</h1><p className="mt-1 text-sm text-gray-600">{retreat.code || retreat.retreatCode || retreat.name} · Polish website</p></div>
      <button disabled={saving} onClick={save} className="inline-flex min-h-11 items-center justify-center gap-2 bg-gray-950 px-6 text-sm font-semibold text-white disabled:opacity-50"><Icon component={FiSave}/>{saving ? 'Saving…' : 'Save pricing'}</button>
    </header>
    {error && <div className="mx-5 mt-5 border border-red-300 bg-red-50 p-3 text-sm text-red-800 md:mx-8">{error}</div>}
    {saved && <div className="mx-5 mt-5 border border-green-300 bg-green-50 p-3 text-sm text-green-800 md:mx-8">Pricing saved and available to the website API.</div>}
    <div className="space-y-6 p-5 md:p-8">
      <section className="grid gap-4 border border-gray-300 bg-white p-5 md:grid-cols-3">
        <div><span className={label}>Website visibility</span><label className="flex items-center gap-3"><input type="checkbox" checked={showOnSite} onChange={(e) => setShowOnSite(e.target.checked)}/><strong>{showOnSite ? 'Published' : 'Hidden'}</strong></label></div>
        <div><span className={label}>Capacity</span><strong>{occupancy} booked / {capacity} places</strong><p className="mt-1 text-xs text-gray-500">Availability is calculated automatically.</p></div>
        <div><span className={label}>Places available</span><strong className="text-xl text-blue-700">{Math.max(0, capacity - occupancy)}</strong><p className="mt-1 text-xs text-gray-500">Not manually editable here.</p></div>
      </section>
      <section className="border border-gray-300 bg-white p-5"><div className="mb-5"><h2 className="text-lg font-bold">Price matrix</h2><p className="text-sm text-gray-600">The applicable row is selected from the retreat start date and the date the visitor is booking.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-y border-gray-300 bg-gray-50"><th className="p-3 text-left">Booking window</th><th className="p-3 text-left">Shared room</th><th className="p-3 text-left">Private room</th><th className="p-3 text-left">Private room + bathroom</th></tr></thead><tbody>{rows.map(([title, shared, privateRoom, ensuite, detail]) => <tr key={title} className="border-b border-gray-200"><th className="p-3 text-left"><span className="block">{title}</span><span className="font-normal text-gray-500">{detail}</span></th>{[shared, privateRoom, ensuite].map((key) => <td className="p-3" key={key}><div className="flex items-center"><input aria-label={`${title} ${key}`} className={field} type="number" min="0" step="100" value={prices[key]} onChange={(e) => setPrices((current) => ({ ...current, [key]: Number(e.target.value) }))}/><span className="ml-2">PLN</span></div></td>)}</tr>)}</tbody></table></div>
        <label className="mt-5 block max-w-sm"><span className={label}>Additional addiction support</span><div className="flex items-center"><input className={field} type="number" min="0" step="100" value={prices.addictionSupport} onChange={(e) => setPrices((current) => ({ ...current, addictionSupport: Number(e.target.value) }))}/><span className="ml-2">PLN</span></div></label>
      </section>
      <section className="border border-gray-300 bg-white p-5"><h2 className="text-lg font-bold">What the retreat includes</h2><p className="mb-4 text-sm text-gray-600">Polish website, one item per line.</p><textarea className={field} rows={8} value={included} onChange={(e) => setIncluded(e.target.value)} placeholder={'Accommodation\nTwo ceremonies\nMeals\nAirport transfer'}/></section>
    </div>
  </main>;
};

export default RetreatPricingPage;
