import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookingFlowItem, BookingFlowTemplate, Retreat } from '../types';
import { formatRetreatCalendarDate, isBookingStepComplete, RetreatBookingStepOption } from './RetreatsGrid.helpers';
import { isConfiguredRequirementStep } from './bookingStepRows';

type Props = {
  retreats: Retreat[]; options: RetreatBookingStepOption[]; selectedKey: string; onSelect: (key: string) => void;
  matrices: Record<string, { items: BookingFlowItem[]; templates: BookingFlowTemplate[] }>;
  requirementsMode?: boolean;
  getId: (value: any) => string; getBookings: (retreat: Retreat) => any[]; getCode: (retreat: Retreat) => string;
  getTown: (retreat: Retreat) => string; getClientName: (booking: any) => string; getClientDisplayId: (booking: any) => string | number;
  getClientLanguage: (booking: any) => string; routePrefix: string;
};

const accentColors = ['#87bdf0', '#d9dd70', '#f4b285', '#ef476f', '#6366f1'];
const money = (booking: any) => booking.totalAmount ? `${Number(booking.totalAmount).toLocaleString()} ${booking.currency || ''}`.trim() : '—';

const RetreatHolisticView: React.FC<Props> = ({ retreats, options, selectedKey, onSelect, matrices, requirementsMode = false, getId, getBookings, getCode, getTown, getClientName, getClientDisplayId, getClientLanguage, routePrefix }) => {
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
  const requiredOptions = useMemo(() => {
    const requiredKeys = new Set<string>();
    Object.values(matrices).forEach(matrix => {
      matrix.templates?.forEach(template => {
        if (isConfiguredRequirementStep(template.key, template)) requiredKeys.add(template.key);
      });
      matrix.items?.forEach(item => {
        if (isConfiguredRequirementStep(item.key, item.metadata)) requiredKeys.add(item.key);
      });
    });
    return options.filter(option => requiredKeys.has(option.key));
  }, [matrices, options]);
  const requirementGroups = useMemo(() => retreats.map((retreat, index) => {
    const retreatId = getId(retreat); const items = matrices[retreatId]?.items || [];
    const rows = getBookings(retreat).map(booking => {
      const bookingId = getId(booking);
      const statuses = Object.fromEntries(requiredOptions.map(option => [option.key, isBookingStepComplete(items.find(item => getId(item.bookingId) === bookingId && item.key === option.key))]));
      const complete = requiredOptions.length > 0 && requiredOptions.every(option => statuses[option.key]);
      return { booking, statuses, complete };
    });
    const query = search.trim().toLowerCase();
    const visible = rows.filter(row => (!missingOnly || !row.complete) && (!query || [getClientName(row.booking), row.booking.bookingNumber, getClientDisplayId(row.booking)].join(' ').toLowerCase().includes(query)));
    return { retreat, retreatId, rows, visible, done: rows.filter(row => row.complete).length, accent: retreat.backgroundColor || accentColors[index % accentColors.length] };
  }), [getBookings, getClientDisplayId, getClientName, getId, matrices, missingOnly, requiredOptions, retreats, search]);
  if (requirementsMode) {
    const total = requirementGroups.reduce((sum, group) => sum + group.rows.length, 0);
    const done = requirementGroups.reduce((sum, group) => sum + group.done, 0);
    return <div className="holistic-view">
      <div className="holistic-controls"><div className="holistic-total"><span>Required booking steps — across every retreat</span><strong>{done}<small> / {total} complete</small></strong><i><b style={{ width: `${total ? done / total * 100 : 0}%` }} /></i><em>{total - done} missing</em></div><div className="holistic-filters"><input aria-label="Search holistic requirements" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search client, booking or client id"/><button className={missingOnly ? 'active' : ''} onClick={() => setMissingOnly(value => !value)}>{missingOnly ? 'Show everyone' : 'Show only who is missing'}</button><button onClick={collapseAll}>Collapse all</button></div></div>
      {!requiredOptions.length && <p className="holistic-empty">No booking steps are currently configured as required from the client.</p>}
      <div className="holistic-groups">{requirementGroups.map(group => <section className="holistic-group" style={{ '--accent': group.accent } as React.CSSProperties} key={group.retreatId}><header><button onClick={() => toggle(group.retreatId)}><b>{getCode(group.retreat) || group.retreat.name}</b><span>{formatRetreatCalendarDate(group.retreat.startDate, { month: 'numeric', day: 'numeric', year: 'numeric' })} – {formatRetreatCalendarDate(group.retreat.endDate, { month: 'numeric', day: 'numeric', year: 'numeric' })}<small> · {getTown(group.retreat)}</small></span></button><div className="holistic-group-progress"><i><b style={{ width: `${group.rows.length ? group.done / group.rows.length * 100 : 0}%` }} /></i><strong>{group.done}<small> / {group.rows.length} complete</small></strong></div><button className="holistic-collapse" onClick={() => toggle(group.retreatId)}>{collapsed.has(group.retreatId) ? 'Show people' : 'Hide people'}</button></header>{!collapsed.has(group.retreatId) && <div className="holistic-people holistic-requirements-table" style={{ '--requirement-count': requiredOptions.length } as React.CSSProperties}><div className="holistic-head"><span>Client</span><span>Booking</span>{requiredOptions.map(option => <span key={option.key}>{option.label}</span>)}</div>{group.visible.map(({ booking, statuses }) => <article key={getId(booking)}><strong>{getClientName(booking)}</strong><Link to={`/${routePrefix}/bookings/${getId(booking)}`}>{booking.bookingNumber || getId(booking).slice(-6)}</Link>{requiredOptions.map(option => <span key={option.key} className={`holistic-step ${statuses[option.key] ? 'done' : 'missing'}`}>{statuses[option.key] ? '✓ Done' : '⊗ Not yet'}</span>)}</article>)}{!group.visible.length && <p>No bookings match these filters.</p>}</div>}</section>)}</div>
    </div>;
  }
  return <div className="holistic-view">
    <div className="holistic-controls"><label><span>Booking step</span><select value={selectedKey} onChange={event => onSelect(event.target.value)}><option value="">Select a booking step</option>{options.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label><div className="holistic-total"><span>{option?.label || 'Selected step'} — across every retreat</span><strong>{done}<small> / {total} done</small></strong><i><b style={{ width: `${total ? done / total * 100 : 0}%` }} /></i><em>{missing} missing</em></div><div className="holistic-filters"><input aria-label="Search holistic bookings" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search client, booking or client id"/><button className={missingOnly ? 'active' : ''} onClick={() => setMissingOnly(value => !value)}>{missingOnly ? 'Show everyone' : 'Show only who is missing'}</button><button onClick={collapseAll}>Collapse all</button></div></div>
    <div className="holistic-groups">{groups.map(group => <section className="holistic-group" style={{ '--accent': group.accent } as React.CSSProperties} key={group.retreatId}><header><button onClick={() => toggle(group.retreatId)}><b>{getCode(group.retreat) || group.retreat.name}</b><span>{formatRetreatCalendarDate(group.retreat.startDate, { month: 'numeric', day: 'numeric', year: 'numeric' })} – {formatRetreatCalendarDate(group.retreat.endDate, { month: 'numeric', day: 'numeric', year: 'numeric' })}<small> · {getTown(group.retreat)}</small></span></button><div className="holistic-group-progress"><i><b style={{ width: `${group.rows.length ? group.done / group.rows.length * 100 : 0}%` }} /></i><strong>{group.done}<small> / {group.rows.length} done</small></strong></div><button className="holistic-collapse" onClick={() => toggle(group.retreatId)}>{collapsed.has(group.retreatId) ? 'Show people' : 'Hide people'}</button></header>{!collapsed.has(group.retreatId) && <div className="holistic-people"><div className="holistic-head"><span>{option?.label || 'Step'}</span><span>Name</span><span>Booking</span><span>Client</span><span>Lang</span><span>Status</span><span>Amount</span></div>{group.visible.map(({ booking, complete }) => <article key={getId(booking)}><span className={`holistic-step ${complete ? 'done' : 'missing'}`}>{complete ? '✓ Done' : '⊗ Not yet'}</span><strong>{getClientName(booking)}</strong><Link to={`/${routePrefix}/bookings/${getId(booking)}`}>{booking.bookingNumber || getId(booking).slice(-6)}</Link><Link to={`/${routePrefix}/clients/${getId(booking.clientId)}`}>Client #{getClientDisplayId(booking)}</Link><span>{getClientLanguage(booking)}</span><em>{booking.status || 'pending'}</em><b>{money(booking)}</b></article>)}{!group.visible.length && <p>No bookings match these filters.</p>}</div>}</section>)}</div>
  </div>;
};
export default RetreatHolisticView;
