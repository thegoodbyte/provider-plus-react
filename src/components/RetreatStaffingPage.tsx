import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { retreatsApi } from '../services/api';
import { Retreat } from '../types';
import { formatRetreatCalendarDate } from './RetreatsGrid.helpers';

const roles = [
  { key: 'cook', label: 'Cook' },
  { key: 'helper', label: 'Helper 1' },
  { key: 'second_helper', label: 'Helper 2' },
];

export default function RetreatStaffingPage() {
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const prefix = useLocation().pathname.split('/').filter(Boolean)[0] || 'admin';
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await retreatsApi.getAll();
      setRetreats([...response.data].sort((a, b) =>
        new Date(b.startDate || b.dates?.startDate || 0).getTime() - new Date(a.startDate || a.dates?.startDate || 0).getTime()));
    } catch {
      setError('Unable to load retreat staffing. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);
  const visible = retreats.filter(retreat =>
    [retreat.retreatCode, retreat.code, retreat.name, retreat.location_town, retreat.location,
      ...(retreat.retreatStaff || []).map(person => person.name || (typeof person.contactId === 'object' ? person.contactId?.name : ''))]
      .filter(Boolean).join(' ').toLowerCase().includes(search.trim().toLowerCase()));

  return <main className="mx-auto max-w-[1500px] p-4 sm:p-6">
    <header className="mb-5">
      <h1 className="text-2xl font-bold text-slate-900">Helpers &amp; Cooks</h1>
      <p className="mt-2 text-slate-600">See the team across all retreats. Choose Manage team to assign a cook or helpers.</p>
    </header>
    <div className="mb-4 flex gap-3">
      <input aria-label="Search retreats or team members" placeholder="Search retreats or team members…" value={search} onChange={event => setSearch(event.target.value)} className="w-full max-w-lg rounded-lg border border-slate-300 px-3 py-2" />
      <button onClick={load} disabled={loading} className="rounded-lg border border-slate-300 bg-white px-4 py-2 disabled:opacity-50">Refresh</button>
    </div>
    {loading ? <p role="status">Loading retreat staffing…</p> : error ? <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p> :
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[800px] text-left">
          <thead className="bg-slate-50 text-sm text-slate-600"><tr><th className="p-4">Retreat</th>{roles.map(role => <th className="p-4" key={role.key}>{role.label}</th>)}<th className="p-4">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-200">{visible.map(retreat => <tr key={retreat._id}>
            <td className="p-4"><Link className="font-semibold text-teal-700" to={`/${prefix}/retreats/${retreat._id}`}>{retreat.retreatCode || retreat.code || retreat.name}</Link><p className="mt-1 text-sm text-slate-500">{formatRetreatCalendarDate(retreat.startDate || retreat.dates?.startDate, { year: 'numeric', month: 'short', day: 'numeric' })} · {retreat.location_town || retreat.location || 'Location not set'}</p></td>
            {roles.map(role => {
              const people = (retreat.retreatStaff || []).filter(person => (person.role || 'helper') === role.key);
              return <td className={`p-4 ${people.length ? 'text-slate-800' : 'text-amber-700'}`} key={role.key}>{people.length ? people.map(person => person.name?.trim() || (typeof person.contactId === 'object' ? person.contactId?.name : '') || 'Assigned person — name unavailable').join(', ') : 'Not assigned'}</td>;
            })}
            <td className="p-4"><Link className="font-medium text-teal-700 underline" to={`/${prefix}/retreats/${retreat._id}?panel=helpers`}>Manage team</Link></td>
          </tr>)}</tbody>
        </table>
        {!visible.length && <p className="p-6 text-slate-500">{search ? 'No retreats match your search.' : 'No retreats found.'}</p>}
      </div>}
  </main>;
}
