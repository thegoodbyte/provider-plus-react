import React, { useEffect, useMemo, useState } from 'react';
import { FiCheck, FiEdit2, FiSave, FiUsers, FiX } from 'react-icons/fi';
import { contactBookApi, retreatsApi } from '../services/api';
import { ContactBookEntry, Retreat, RetreatStaffAssignment } from '../types';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon, className }) => React.createElement(icon as any, { className });

type StaffRole = 'cook' | 'helper' | 'second_helper';
type StaffingDraft = Record<StaffRole, string>;

const roles: Array<{ key: StaffRole; label: string }> = [
  { key: 'cook', label: 'Cook' },
  { key: 'helper', label: 'Helper 1' },
  { key: 'second_helper', label: 'Helper 2' },
];

const idOf = (value?: string | ContactBookEntry) =>
  typeof value === 'string' ? value : value?._id || '';

const draftFor = (retreat: Retreat): StaffingDraft => {
  const assignments = retreat.retreatStaff || [];
  return {
    cook: idOf(assignments.find((item) => item.role === 'cook')?.contactId),
    helper: idOf(assignments.find((item) => item.role === 'helper')?.contactId),
    second_helper: idOf(assignments.find((item) => item.role === 'second_helper')?.contactId),
  };
};

const retreatDate = (retreat: Retreat) => retreat.startDate || retreat.dates?.startDate || '';
const formatDate = (value?: string | Date) => value
  ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  : 'Date not set';

const RetreatStaffingPage: React.FC = () => {
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [directory, setDirectory] = useState<ContactBookEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, StaffingDraft>>({});
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const [retreatResponse, helperResponse, cookResponse] = await Promise.all([
        retreatsApi.getAll(),
        contactBookApi.getAll({ role: 'helper', includeInactive: true }),
        contactBookApi.getAll({ role: 'cook', includeInactive: true }),
      ]);
      const rows: Retreat[] = [...(retreatResponse.data || [])].sort((a, b) =>
        new Date(retreatDate(b) || 0).getTime() - new Date(retreatDate(a) || 0).getTime());
      const people = new Map<string, ContactBookEntry>();
      [...(helperResponse.data || []), ...(cookResponse.data || [])].forEach((person) => {
        if (person._id) people.set(person._id, person);
      });
      setRetreats(rows);
      setDirectory(Array.from(people.values()).sort((a, b) => a.name.localeCompare(b.name)));
      setDrafts(Object.fromEntries(rows.filter((row) => row._id).map((row) => [row._id!, draftFor(row)])));
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Unable to load retreat staffing.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const peopleById = useMemo(() => new Map(directory.map((person) => [person._id || '', person])), [directory]);
  const optionsFor = (role: StaffRole) => {
    const requiredRole = role === 'cook' ? 'cook' : 'helper';
    return directory.filter((person) =>
      person.isActive !== false
      && Array.from(new Set([...(person.roles || []), person.role])).includes(requiredRole));
  };

  const cancelEditing = () => {
    setDrafts(Object.fromEntries(retreats.filter((row) => row._id).map((row) => [row._id!, draftFor(row)])));
    setEditing(false);
    setMessage('');
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const updated = await Promise.all(retreats.filter((retreat) => retreat._id).map(async (retreat) => {
        const draft = drafts[retreat._id!] || draftFor(retreat);
        const retained = (retreat.retreatStaff || []).filter((assignment) => !roles.some((role) => role.key === assignment.role));
        const assigned: RetreatStaffAssignment[] = roles.flatMap(({ key }) => {
          const person = peopleById.get(draft[key]);
          return person ? [{
            contactId: person._id,
            role: key,
            name: person.name,
            phone: person.phone,
            email: person.email,
          }] : [];
        });
        const response = await retreatsApi.update(retreat._id!, { retreatStaff: [...retained, ...assigned] });
        return response.data;
      }));
      setRetreats(updated.sort((a, b) => new Date(retreatDate(b) || 0).getTime() - new Date(retreatDate(a) || 0).getTime()));
      setEditing(false);
      setMessage('Retreat staffing saved.');
    } catch (error: any) {
      setMessage(error?.response?.data?.message || 'Unable to save retreat staffing.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-[1500px] p-4 sm:p-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Retreat operations</div>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-900"><Icon icon={FiUsers} /> Helpers & cooks</h1>
          <p className="mt-1 text-sm text-slate-500">One staffing view across all retreats.</p>
        </div>
        <div className="flex gap-2">
          {editing ? <>
            <button onClick={cancelEditing} disabled={saving} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700"><Icon icon={FiX} /> Cancel</button>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-60"><Icon icon={FiSave} /> {saving ? 'Saving…' : 'Save'}</button>
          </> : <button onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white"><Icon icon={FiEdit2} /> Unlock editing</button>}
        </div>
      </header>

      {message && <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${message.includes('saved') ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>{message}</div>}
      {loading ? <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading retreat staffing…</div> :
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[900px] w-full border-collapse">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Retreat</th>{roles.map((role) => <th key={role.key} className="px-4 py-3">{role.label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {retreats.map((retreat) => {
                const rowDraft = retreat._id ? drafts[retreat._id] || draftFor(retreat) : draftFor(retreat);
                return <tr key={retreat._id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-slate-900">{retreat.retreatCode || retreat.code || retreat.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatDate(retreatDate(retreat))} · {retreat.location_town || retreat.location || 'Location not set'}</div>
                  </td>
                  {roles.map(({ key }) => {
                    const selected = peopleById.get(rowDraft[key]);
                    return <td key={key} className="px-4 py-3">
                      {editing ? <select
                        value={rowDraft[key]}
                        onChange={(event) => retreat._id && setDrafts((current) => ({ ...current, [retreat._id!]: { ...rowDraft, [key]: event.target.value } }))}
                        className="w-full min-w-[190px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      >
                        <option value="">Not assigned</option>
                        {optionsFor(key).map((person) => <option key={person._id} value={person._id}>{person.name}</option>)}
                      </select> : selected ? <div className="flex items-center gap-2 text-sm font-medium text-slate-800"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Icon icon={FiCheck} /></span>{selected.name}</div> : <span className="text-sm text-slate-400">Not assigned</span>}
                    </td>;
                  })}
                </tr>;
              })}
            </tbody>
          </table>
        </div>}
    </main>
  );
};

export default RetreatStaffingPage;
