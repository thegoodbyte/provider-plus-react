import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookingFlowItem, BookingFlowTemplate, Retreat } from '../types';
import { formatRetreatCalendarDate, isBookingStepComplete, RetreatBookingStepOption } from './RetreatsGrid.helpers';

type Props = {
  retreats: Retreat[]; options: RetreatBookingStepOption[]; selectedKey: string; onSelect: (key: string) => void;
  matrices: Record<string, { items: BookingFlowItem[]; templates: BookingFlowTemplate[] }>;
  getId: (value: any) => string; getBookings: (retreat: Retreat) => any[]; getCode: (retreat: Retreat) => string;
  getTown: (retreat: Retreat) => string; getClientName: (booking: any) => string; getClientDisplayId: (booking: any) => string | number;
  getClientLanguage: (booking: any) => string; routePrefix: string;
};

const accentColors = ['#87bdf0', '#d9dd70', '#f4b285', '#ef476f', '#6366f1'];
const money = (booking: any) => booking.totalAmount ? `${Number(booking.totalAmount).toLocaleString()} ${booking.currency || ''}`.trim() : '—';

const RetreatHolisticView: React.FC<Props> = ({ retreats, options, selectedKey, onSelect, matrices, getId, getBookings, getCode, getTown, getClientName, getClientDisplayId, getClientLanguage, routePrefix }) => {
  const [search, setSearch] = useState(''); const [missingOnly, setMissingOnly] = useState(false); const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const option = options.find(item => item.key === selectedKey);
  const groups = useMemo(() => retreats.map((retreat, index) => {
    const retreatId = getId(retreat); const items = matrices[retreatId]?.items || [];
    const rows = getBookings(retreat).map(booking => { const bookingId = getId(booking); const step = items.find(item => getId(item.bookingId) === bookingId && item.key === selectedKey); return { booking, complete: isBookingStepComplete(step) }; });
    const query = search.trim().toLowerCase();
    const visible = rows.filter(row => (!missingOnly || !row.complete) && (!query || [getClientName(row.booking), row.booking.bookingNumber, getClientDisplayId(row.booking)].join(' ').toLowerCase().includes(query)));
    return { retreat, retreatId, rows, visible, done: rows.filter(row => row.complete).length, accent: retreat.backgroundColor || accentColors[index % accentColors.length] };
  }), [getBookings, getClientDisplayId, getClientName, getId, matrices, missingOnly, retreats, search, selectedKey]);
  const total = groups.reduce((sum, group) => sum + group.rows.length, 0); const done = groups.reduce((sum, group) => sum + group.done, 0); const missing = total - done;
  const toggle = (id: string) => setCollapsed(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const collapseAll = () => setCollapsed(new Set(groups.map(group => group.retreatId)));
  return <div className="holistic-view">
    <div className="holistic-controls"><label><span>Booking step</span><select value={selectedKey} onChange={event => onSelect(event.target.value)}><option value="">Select a booking step</option>{options.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label><div className="holistic-total"><span>{option?.label || 'Selected step'} — across every retreat</span><strong>{done}<small> / {total} done</small></strong><i><b style={{ width: `${total ? done / total * 100 : 0}%` }} /></i><em>{missing} missing</em></div><div className="holistic-filters"><input aria-label="Search holistic bookings" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search client, booking or client id"/><button className={missingOnly ? 'active' : ''} onClick={() => setMissingOnly(value => !value)}>{missingOnly ? 'Show everyone' : 'Show only who is missing'}</button><button onClick={collapseAll}>Collapse all</button></div></div>
    <div className="holistic-groups">{groups.map(group => <section className="holistic-group" style={{ '--accent': group.accent } as React.CSSProperties} key={group.retreatId}><header><button onClick={() => toggle(group.retreatId)}><b>{getCode(group.retreat) || group.retreat.name}</b><span>{formatRetreatCalendarDate(group.retreat.startDate, { month: 'numeric', day: 'numeric', year: 'numeric' })} – {formatRetreatCalendarDate(group.retreat.endDate, { month: 'numeric', day: 'numeric', year: 'numeric' })}<small> · {getTown(group.retreat)}</small></span></button><div className="holistic-group-progress"><i><b style={{ width: `${group.rows.length ? group.done / group.rows.length * 100 : 0}%` }} /></i><strong>{group.done}<small> / {group.rows.length} done</small></strong></div><button className="holistic-collapse" onClick={() => toggle(group.retreatId)}>{collapsed.has(group.retreatId) ? 'Show people' : 'Hide people'}</button></header>{!collapsed.has(group.retreatId) && <div className="holistic-people"><div className="holistic-head"><span>{option?.label || 'Step'}</span><span>Name</span><span>Booking</span><span>Client</span><span>Lang</span><span>Status</span><span>Amount</span></div>{group.visible.map(({ booking, complete }) => <article key={getId(booking)}><span className={`holistic-step ${complete ? 'done' : 'missing'}`}>{complete ? '✓ Done' : '⊗ Not yet'}</span><strong>{getClientName(booking)}</strong><Link to={`/${routePrefix}/bookings/${getId(booking)}`}>{booking.bookingNumber || getId(booking).slice(-6)}</Link><Link to={`/${routePrefix}/clients/${getId(booking.clientId)}`}>Client #{getClientDisplayId(booking)}</Link><span>{getClientLanguage(booking)}</span><em>{booking.status || 'pending'}</em><b>{money(booking)}</b></article>)}{!group.visible.length && <p>No bookings match these filters.</p>}</div>}</section>)}</div>
  </div>;
};
export default RetreatHolisticView;
