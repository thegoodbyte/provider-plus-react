import { Referral, ReferralCommissionPackage } from '../types';

const day = (value?: string | null) => value?.slice(0, 10) || '';
const validDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export const newDatePackage = (): ReferralCommissionPackage => ({ key: `dates-${Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')}`, name: '', effectiveFrom: '', effectiveTo: '', bookingCurrency: '*', kind: 'percentage', rates: [{ effectiveFrom: '', ratePercent: undefined }] });

export function datePackageEditorState(referral?: Referral) {
  if (referral?.commissionMode === 'dated_percentage') return { packages: referral.commissionPackages || [], blocked: false, activate: true };
  const packages = referral?.commissionPackages || [];
  if (packages.length) {
    const blocked = packages.some(rule => rule.kind !== 'percentage' || rule.bookingCurrency !== '*' || Boolean(rule.tiers?.length));
    return { blocked, activate: !blocked, packages: blocked ? [] : packages.map(rule => ({ ...rule, ratePercent: undefined, rates: [{ effectiveFrom: rule.effectiveFrom, ratePercent: rule.ratePercent }] })) };
  }
  const rules = referral?.rateSchedule || [];
  if (rules.length) {
    const blocked = rules.some(rule => rule.tiers.length !== 1 || rule.tiers[0].minPrice !== 0);
    return { blocked, activate: !blocked, packages: blocked ? [] : rules.map((rule, index) => ({ key: `dates-${index + 1}`, name: '', effectiveFrom: day(rule.effectiveFrom), effectiveTo: day(rule.effectiveTo), bookingCurrency: '*', kind: 'percentage' as const, rates: [{ effectiveFrom: day(rule.effectiveFrom), ratePercent: rule.tiers[0].ratePercent }] })) };
  }
  return { packages: [], blocked: false, activate: !referral };
}

export function prepareDatePackages(packages: ReferralCommissionPackage[]): ReferralCommissionPackage[] {
  if (packages.length > 100) throw new Error('Use at most 100 commission packages.');
  const result = packages.map((rule, index) => {
    const from = rule.effectiveFrom; const to = rule.effectiveTo || '';
    if (!validDay(from) || (to && (!validDay(to) || to < from))) throw new Error(`Package ${index + 1}: choose valid From and To dates, with To on or after From.`);
    const rates = [...(rule.rates || [])].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
    if (!rates.length || rates.length > 100 || rates[0].effectiveFrom !== from) throw new Error(`Package ${index + 1}: enter a starting percentage on the package From date.`);
    for (const rate of rates) {
      if (!validDay(rate.effectiveFrom) || rate.effectiveFrom < from || (to && rate.effectiveFrom > to)) throw new Error(`Package ${index + 1}: percentage dates must be inside the package dates.`);
      if (typeof rate.ratePercent !== 'number' || !Number.isFinite(rate.ratePercent) || rate.ratePercent < 0 || rate.ratePercent > 100) throw new Error(`Package ${index + 1}: enter percentages between 0 and 100.`);
    }
    if (new Set(rates.map(rate => rate.effectiveFrom)).size !== rates.length) throw new Error(`Package ${index + 1}: only one percentage can start on each date.`);
    return { key: rule.key, name: rule.name.trim() || `${from} to ${to || 'ongoing'}`, effectiveFrom: from, effectiveTo: to || undefined, bookingCurrency: '*', kind: 'percentage' as const, rates };
  }).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  for (let index = 1; index < result.length; index++) {
    if (result[index].effectiveFrom <= (result[index - 1].effectiveTo || '9999-12-31')) throw new Error('Package dates overlap. End one package before the next begins.');
  }
  return result;
}

export function percentageRangeLabel(rule: ReferralCommissionPackage, rateIndex: number) {
  const rates = [...(rule.rates || [])].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const rate = rule.rates?.[rateIndex]; const next = rates.find(item => item.effectiveFrom > (rate?.effectiveFrom || ''));
  if (!rate?.effectiveFrom || !validDay(rate.effectiveFrom)) return 'Choose a From date';
  const until = next && validDay(next.effectiveFrom) ? new Date(Date.parse(next.effectiveFrom) - 86400000).toISOString().slice(0, 10) : rule.effectiveTo || 'ongoing';
  return `${rate.effectiveFrom} to ${until}`;
}
