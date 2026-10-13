import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Edit3, Lock, RotateCcw, Save, Search, Users, X } from 'lucide-react';
import { Referral, Retreat, RetreatClient, REFERRAL_ATTRIBUTION_OPTIONS } from '../types';
import { formatRetreatCalendarDate } from './RetreatsGrid.helpers';
import { bookingsApi } from '../services/api';

type Props = {
  retreats: Retreat[];
  bookings: RetreatClient[];
  referrals: Referral[];
  onSaveSuccess?: () => void;
  routePrefix: string;
  getId: (value: any) => string;
  getCode: (retreat: Retreat) => string;
  getTown: (retreat: Retreat) => string;
  getClientName: (booking: any) => string;
  getClientDisplayId: (booking: any) => string | number;
  getClientLanguage: (booking: any) => string;
};

const accentColors = ['#87bdf0', '#d9dd70', '#f4b285', '#ef476f', '#6366f1'];
const money = (booking: any) =>
  booking.totalAmount
    ? `${Number(booking.totalAmount).toLocaleString()} ${booking.currency || ''}`.trim()
    : '—';

export function computeInitialBookingAttribution(
  booking: RetreatClient,
  allBookingsForClient: RetreatClient[]
): { partnerId: string | null; attribution: string } {
  // 1. If booking already has an explicit attribution set in DB, preserve it
  if (booking.referralAttribution) {
    const rawPartner = (booking as any).referralPartnerId;
    const partnerId = rawPartner && typeof rawPartner === 'object' ? rawPartner._id : rawPartner || null;
    return { partnerId: partnerId ? String(partnerId) : null, attribution: booking.referralAttribution };
  }

  // 2. If it's a booster, default to SELF
  if (booking.bookingType === 'booster') {
    return { partnerId: null, attribution: 'self' };
  }

  // 3. Check client booking order (first vs repeat)
  const sorted = [...allBookingsForClient].sort((a, b) => {
    const timeA = new Date((a as any).registrationDate || (a as any).createdAt || 0).getTime();
    const timeB = new Date((b as any).registrationDate || (b as any).createdAt || 0).getTime();
    return timeA - timeB || Number(a.bookingNumber || 0) - Number(b.bookingNumber || 0);
  });
  const firstBooking = sorted[0];
  const isFirst = firstBooking && String(firstBooking._id) === String(booking._id);

  if (!isFirst) {
    // Second booking or later defaults to SELF
    return { partnerId: null, attribution: 'self' };
  }

  // First booking by client: take referral from client profile if present
  const client: any = booking.clientId;
  if (client && typeof client === 'object' && client.referralId) {
    const partnerId = typeof client.referralId === 'object' ? client.referralId._id : client.referralId;
    const attribution = client.referralAttributionType === 'self_identified' ? 'self_identified' : 'direct';
    return { partnerId: partnerId ? String(partnerId) : null, attribution };
  }

  return { partnerId: null, attribution: 'unknown' };
}

export const RetreatReferralsHolisticView: React.FC<Props> = ({
  retreats,
  bookings,
  referrals,
  onSaveSuccess,
  routePrefix,
  getId,
  getCode,
  getTown,
  getClientName,
  getClientDisplayId,
}) => {
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Staged updates: bookingId -> { partnerId: string | null, attribution: string }
  const [stagedEdits, setStagedEdits] = useState<
    Record<string, { partnerId: string | null; attribution: string }>
  >({});

  // Group all non-cancelled bookings by clientId to evaluate booking order
  const clientBookingsMap = useMemo(() => {
    const map = new Map<string, RetreatClient[]>();
    bookings.forEach((booking) => {
      const cId = getId(booking.clientId);
      if (!cId) return;
      if (!map.has(cId)) map.set(cId, []);
      map.get(cId)!.push(booking);
    });
    return map;
  }, [bookings, getId]);

  // Compute effective state for each booking (DB + staged edits)
  const getBookingState = (booking: RetreatClient) => {
    const bId = getId(booking);
    if (stagedEdits[bId]) {
      return stagedEdits[bId];
    }
    const cId = getId(booking.clientId);
    const clientBookings = clientBookingsMap.get(cId) || [booking];
    return computeInitialBookingAttribution(booking, clientBookings);
  };

  const selectedPartner = referrals.find((r) => r._id === selectedPartnerId);

  // Group bookings by retreat
  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();
    return retreats.map((retreat, index) => {
      const retreatId = getId(retreat);
      const retreatBookings = bookings
        .filter((b) => getId(b.retreatId) === retreatId && (b as any).status !== 'cancelled')
        .sort((a, b) => Number(a.bookingNumber || 0) - Number(b.bookingNumber || 0));

      const rows = retreatBookings.map((booking) => {
        const state = getBookingState(booking);
        const bId = getId(booking);
        const isModified = Boolean(stagedEdits[bId]);
        const cId = getId(booking.clientId);
        const clientBookings = clientBookingsMap.get(cId) || [];
        const isFirst =
          clientBookings.length > 0 &&
          String(
            [...clientBookings].sort(
              (a, b) =>
                new Date((a as any).registrationDate || (a as any).createdAt || 0).getTime() -
                new Date((b as any).registrationDate || (b as any).createdAt || 0).getTime()
            )[0]?._id
          ) === String(booking._id);

        return {
          booking,
          partnerId: state.partnerId,
          attribution: state.attribution,
          isModified,
          isFirst,
        };
      });

      const filtered = rows.filter((row) => {
        if (selectedPartnerId && row.partnerId !== selectedPartnerId) {
          return false;
        }
        if (!query) return true;
        const name = getClientName(row.booking).toLowerCase();
        const num = String(row.booking.bookingNumber || '').toLowerCase();
        const cId = String(getClientDisplayId(row.booking)).toLowerCase();
        return name.includes(query) || num.includes(query) || cId.includes(query);
      });

      return {
        retreat,
        retreatId,
        rows,
        filtered,
        accent: retreat.backgroundColor || accentColors[index % accentColors.length],
      };
    });
  }, [
    retreats,
    bookings,
    search,
    selectedPartnerId,
    stagedEdits,
    clientBookingsMap,
    getId,
    getClientName,
    getClientDisplayId,
  ]);

  const totalBookings = groups.reduce((acc, g) => acc + g.rows.length, 0);
  const visibleBookings = groups.reduce((acc, g) => acc + g.filtered.length, 0);
  const modifiedCount = Object.keys(stagedEdits).length;

  const toggleCollapse = (id: string) => {
    setCollapsed((cur) => {
      const next = new Set(cur);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handlePartnerChange = (bookingId: string, partnerId: string | null) => {
    setStagedEdits((cur) => {
      const prev = cur[bookingId] || getBookingState(bookings.find((b) => getId(b) === bookingId)!);
      return {
        ...cur,
        [bookingId]: {
          ...prev,
          partnerId: partnerId || null,
          // If partner is selected and attribution was none/unknown/self, default to direct
          attribution:
            partnerId && (prev.attribution === 'unknown' || prev.attribution === 'self')
              ? 'direct'
              : prev.attribution,
        },
      };
    });
  };

  const handleAttributionChange = (bookingId: string, attribution: string) => {
    setStagedEdits((cur) => {
      const prev = cur[bookingId] || getBookingState(bookings.find((b) => getId(b) === bookingId)!);
      return {
        ...cur,
        [bookingId]: {
          ...prev,
          attribution,
          // If self, clear partnerId
          partnerId: attribution === 'self' ? null : prev.partnerId,
        },
      };
    });
  };

  const handleCancelEdits = () => {
    setStagedEdits({});
    setIsEditMode(false);
    setSaveMessage('');
    setErrorMessage('');
  };

  const handleSaveEdits = async () => {
    if (modifiedCount === 0) {
      setIsEditMode(false);
      return;
    }
    setSaving(true);
    setErrorMessage('');
    try {
      const updates = Object.entries(stagedEdits).map(([bookingId, state]) => ({
        bookingId,
        referralPartnerId: state.partnerId,
        referralAttribution: state.attribution,
        referralEvidence: 'Assigned via holistic referrals view',
      }));

      await bookingsApi.batchUpdateReferralAttribution(updates);
      setSaveMessage(`Successfully updated ${updates.length} booking attribution(s).`);
      setStagedEdits({});
      setIsEditMode(false);
      if (onSaveSuccess) onSaveSuccess();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || err?.message || 'Failed to save referral attributions.');
    } finally {
      setSaving(false);
    }
  };

  const getAttributionBadge = (attribution: string) => {
    switch (attribution) {
      case 'direct':
        return <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-xs font-black text-blue-800">DIRECT</span>;
      case 'self_identified':
        return <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-800">Self-Identified</span>;
      case 'declined':
        return <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-800">Declined</span>;
      case 'unknown':
        return <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">Unknown</span>;
      case 'self':
        return <span className="inline-flex items-center rounded-md bg-purple-100 px-2 py-0.5 text-xs font-black text-purple-800">SELF</span>;
      default:
        return <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{attribution || 'Unassigned'}</span>;
    }
  };

  return (
    <div className="holistic-referrals-view space-y-6">
      {/* Header Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900">
              {selectedPartner ? `Referrals for ${selectedPartner.name}` : 'Holistic Booking Referral Assignment'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {selectedPartner
                ? `Showing bookings and attribution status associated with ${selectedPartner.name} (${selectedPartner.referralCode || 'Partner'}).`
                : 'Holistically view and assign referral partners and attribution types across every retreat.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="partner-filter-select" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Partner:
              </label>
              <select
                id="partner-filter-select"
                aria-label="Filter by Referral Partner"
                value={selectedPartnerId}
                onChange={(e) => setSelectedPartnerId(e.target.value)}
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 font-semibold text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">All Referral Partners</option>
                {referrals.map((r) => (
                  <option key={r._id} value={r._id}>
                    {r.referralCode ? `${r.referralCode} · ` : ''}
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {!isEditMode ? (
              <button
                type="button"
                onClick={() => setIsEditMode(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 font-bold text-white shadow-sm hover:bg-blue-700"
              >
                <Edit3 size={17} />
                Edit Referrals
              </button>
            ) : (
              <div className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 font-bold text-amber-800">
                <Lock size={16} />
                Edit Mode Active
              </div>
            )}
          </div>
        </div>

        {/* Search & Stats Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="relative min-w-[280px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client name, booking or ID…"
              aria-label="Search bookings in referral view"
              className="min-h-10 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
            <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-slate-700">
              {visibleBookings} / {totalBookings} Bookings
            </span>
            <span className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-blue-800">
              {groups.reduce((acc, g) => acc + g.rows.filter((r) => r.attribution === 'direct').length, 0)} DIRECT
            </span>
            <span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-emerald-800">
              {groups.reduce((acc, g) => acc + g.rows.filter((r) => r.attribution === 'self_identified').length, 0)} Self-Identified
            </span>
            <span className="rounded-lg bg-purple-50 px-2.5 py-1.5 text-purple-800">
              {groups.reduce((acc, g) => acc + g.rows.filter((r) => r.attribution === 'self').length, 0)} SELF
            </span>
          </div>
        </div>
      </div>

      {saveMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-800">
          {saveMessage}
        </div>
      )}
      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800">
          {errorMessage}
        </div>
      )}

      {/* Edit Mode Notice */}
      {isEditMode && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm font-medium text-amber-900 shadow-sm">
          <strong>Screen locked in Edit Mode:</strong> Update the Referral Partner and Attribution Type dropdowns
          below. When finished, click <strong>Save Changes</strong> in the floating bar at the bottom.
        </div>
      )}

      {/* Retreat Groups */}
      <div className="space-y-6">
        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.retreatId);
          return (
            <section
              key={group.retreatId}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              style={{ borderTop: `4px solid ${group.accent}` }}
            >
              {/* Retreat Header */}
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 p-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleCollapse(group.retreatId)}
                    className="text-left font-black text-slate-900 hover:text-blue-700"
                  >
                    <span className="text-lg">{getCode(group.retreat) || group.retreat.name}</span>
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      {formatRetreatCalendarDate(group.retreat.startDate)} – {formatRetreatCalendarDate(group.retreat.endDate)}
                      {' · '}
                      {getTown(group.retreat)}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {group.filtered.length} booking{group.filtered.length === 1 ? '' : 's'}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleCollapse(group.retreatId)}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900"
                  >
                    {isCollapsed ? 'Show bookings' : 'Hide bookings'}
                  </button>
                </div>
              </header>

              {/* Bookings Table */}
              {!isCollapsed && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                        <th className="p-3">Bookings</th>
                        <th className="p-3">Referral Partner</th>
                        <th className="p-3">Attribution Type</th>
                        <th className="p-3 text-right">Amount</th>
                        {isEditMode && <th className="p-3 text-center">Status</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.filtered.map(({ booking, partnerId, attribution, isModified, isFirst }) => {
                        const bId = getId(booking);
                        const assignedPartner = referrals.find((r) => r._id === partnerId);

                        return (
                          <tr
                            key={bId}
                            className={`transition ${isModified ? 'bg-amber-50/50' : 'hover:bg-slate-50/60'}`}
                          >
                            {/* Column 1: Bookings */}
                            <td className="p-3">
                              <div className="flex items-start gap-2">
                                <div>
                                  <Link
                                    to={`/${routePrefix}/clients/${getId(booking.clientId)}`}
                                    className="font-bold text-slate-900 hover:text-blue-700 hover:underline"
                                  >
                                    {getClientName(booking)}
                                  </Link>
                                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                                    <Link
                                      to={`/${routePrefix}/bookings/${bId}`}
                                      className="font-semibold text-blue-700 hover:underline"
                                    >
                                      #{booking.bookingNumber || bId.slice(-6)}
                                    </Link>
                                    <span>·</span>
                                    <span>Client #{getClientDisplayId(booking)}</span>
                                    <span>·</span>
                                    {booking.bookingType === 'booster' ? (
                                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-bold text-indigo-700">
                                        Booster
                                      </span>
                                    ) : isFirst ? (
                                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700">
                                        1st booking
                                      </span>
                                    ) : (
                                      <span className="rounded bg-purple-50 px-1.5 py-0.5 font-bold text-purple-700">
                                        Repeat
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Column 2: Referral Partner */}
                            <td className="p-3">
                              {isEditMode ? (
                                <select
                                  aria-label={`Referral partner for ${getClientName(booking)}`}
                                  value={partnerId || ''}
                                  onChange={(e) => handlePartnerChange(bId, e.target.value || null)}
                                  className="min-h-10 w-full min-w-[200px] rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                                >
                                  <option value="">None / Unassigned</option>
                                  {referrals.map((r) => (
                                    <option key={r._id} value={r._id}>
                                      {r.referralCode ? `[${r.referralCode}] ` : ''}
                                      {r.name}
                                    </option>
                                  ))}
                                </select>
                              ) : assignedPartner ? (
                                <div className="flex items-center gap-2">
                                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-black text-blue-800">
                                    {assignedPartner.referralCode || '--'}
                                  </span>
                                  <span className="font-semibold text-slate-900">{assignedPartner.name}</span>
                                </div>
                              ) : (
                                <span className="text-sm font-medium text-slate-400">— None —</span>
                              )}
                            </td>

                            {/* Column 3: Attribution Type */}
                            <td className="p-3">
                              {isEditMode ? (
                                <select
                                  aria-label={`Attribution type for ${getClientName(booking)}`}
                                  value={attribution}
                                  onChange={(e) => handleAttributionChange(bId, e.target.value)}
                                  className="min-h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                                >
                                  {REFERRAL_ATTRIBUTION_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                getAttributionBadge(attribution)
                              )}
                            </td>

                            {/* Amount */}
                            <td className="p-3 text-right font-bold text-slate-900">{money(booking)}</td>

                            {/* Status indicator in edit mode */}
                            {isEditMode && (
                              <td className="p-3 text-center">
                                {isModified ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                                    ● Modified
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400">Unchanged</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {!group.filtered.length && (
                        <tr>
                          <td colSpan={isEditMode ? 5 : 4} className="p-4 text-center text-sm text-slate-400">
                            No bookings match the selected partner or search filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Floating Action Bar in Edit Mode */}
      {isEditMode && (
        <aside
          aria-label="Floating Action Bar"
          className="fixed bottom-6 inset-x-0 z-50 flex justify-center px-4"
        >
          <div className="flex items-center gap-4 rounded-2xl bg-slate-950 px-6 py-4 text-white shadow-2xl ring-1 ring-white/10 sm:min-w-[420px] justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-black">
                {modifiedCount}
              </span>
              <span className="text-sm font-bold">
                {modifiedCount === 1 ? '1 booking modified' : `${modifiedCount} bookings modified`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelEdits}
                disabled={saving}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 text-sm font-bold text-slate-200 hover:bg-slate-700 hover:text-white"
              >
                <X size={15} />
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdits}
                disabled={saving || modifiedCount === 0}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-40"
              >
                <Save size={15} />
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};

export default RetreatReferralsHolisticView;
