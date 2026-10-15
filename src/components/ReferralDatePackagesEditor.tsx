import { ReferralCommissionPackage } from '../types';
import { newDatePackage, percentageRangeLabel } from './referralDatePackages';

const field = 'mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3';
export default function ReferralDatePackagesEditor({ value, onChange }: { value: ReferralCommissionPackage[]; onChange: (value: ReferralCommissionPackage[]) => void }) {
  const update = (index: number, patch: Partial<ReferralCommissionPackage>) => onChange(value.map((rule, i) => i === index ? { ...rule, ...patch } : rule));
  return <section aria-label="Commission packages" className="my-5 space-y-4">
    <div><h3 className="text-lg font-bold">Commission packages</h3><p className="mt-1 text-sm text-slate-600">Choose the package dates, then its percentages. The first completed payment date selects the rate, using Prague time. For bookings without a completed payment, the registration date is used until payment. From and To dates are included. The same percentage applies to every booking currency.</p></div>
    {value.map((rule, index) => <fieldset key={rule.key} className="min-w-0 rounded-xl border border-slate-200 p-4">
      <legend className="px-1 font-semibold">Package {index + 1}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Package From<input className={field} type="date" required value={rule.effectiveFrom} onChange={event => update(index, { effectiveFrom: event.target.value, rates: (rule.rates || []).map((rate, i) => i === 0 ? { ...rate, effectiveFrom: event.target.value } : rate) })} /></label>
        <label className="text-sm">Package To (blank = ongoing)<input className={field} type="date" min={rule.effectiveFrom} value={rule.effectiveTo || ''} onChange={event => update(index, { effectiveTo: event.target.value })} /></label>
      </div>
      <div className="mt-3 space-y-3">
        {(rule.rates || []).map((rate, rateIndex) => <div key={rateIndex} className="rounded-lg bg-slate-50 p-3">
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
            {rateIndex === 0 ? <p className="text-sm">From package start: <strong>{rule.effectiveFrom || 'Choose a date above'}</strong></p> : <label className="text-sm">Rate From<input className={field} type="date" required min={rule.effectiveFrom} max={rule.effectiveTo || undefined} value={rate.effectiveFrom} onChange={event => update(index, { rates: rule.rates!.map((item, i) => i === rateIndex ? { ...item, effectiveFrom: event.target.value } : item) })} /></label>}
            <label className="text-sm">{rateIndex === 0 ? 'Starting percentage' : 'New percentage'}<input className={field} type="number" min="0" max="100" step="0.01" required value={rate.ratePercent ?? ''} onChange={event => update(index, { rates: rule.rates!.map((item, i) => i === rateIndex ? { ...item, ratePercent: event.target.value === '' ? undefined : Number(event.target.value) } : item) })} /></label>
            {rateIndex > 0 && <button type="button" aria-label={`Remove percentage change ${rateIndex} from package ${index + 1}`} className="min-h-11 text-sm text-red-700" onClick={() => update(index, { rates: rule.rates!.filter((_, i) => i !== rateIndex) })}>Remove change</button>}
          </div>
          <p className="mt-2 text-sm text-slate-600">{percentageRangeLabel(rule, rateIndex)} · {rate.ratePercent === undefined ? 'Enter a percentage' : `${rate.ratePercent}%`}</p>
        </div>)}
      </div>
      <div className="mt-3 flex flex-wrap gap-4"><button type="button" className="min-h-11 text-sm font-semibold text-blue-700" onClick={() => update(index, { rates: [...(rule.rates || []), { effectiveFrom: '', ratePercent: undefined }] })}>Add percentage change</button><button type="button" className="min-h-11 text-sm text-red-700" onClick={() => onChange(value.filter((_, i) => i !== index))}>Remove package</button></div>
    </fieldset>)}
    {!value.length && <p className="text-sm text-slate-600">Add a package to set the dates and commission percentage.</p>}
    <button type="button" className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 font-semibold" onClick={() => onChange([...value, newDatePackage()])}>Add commission package</button>
    <p className="text-sm text-slate-600">Each percentage runs until the day before the next change, or through the package To date. Bookings outside the package dates need a package; there is no hidden fallback. Recorded payments keep their saved amounts.</p>
  </section>;
}
