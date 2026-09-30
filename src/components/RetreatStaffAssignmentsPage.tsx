import React, { useEffect, useMemo, useState } from 'react';
import { FiArrowLeft, FiSave } from 'react-icons/fi';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { contactBookApi, retreatsApi } from '../services/api';
import { ContactBookEntry, Retreat, RetreatStaffAssignment } from '../types';
import { formatDateForInput, staffRoleOptions } from './retreatDetailUtils';
import LoadingSpinner from './LoadingSpinner';

const Icon: React.FC<{ component: any }> = ({ component }) => React.createElement(component);
const idOf = (value: any) => typeof value === 'object' ? value?._id || value?.id || '' : value || '';

const RetreatStaffAssignmentsPage: React.FC = () => {
  const { retreatId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const prefix = useMemo(() => {
    const first = location.pathname.split('/').filter(Boolean)[0];
    return ['admin', 'medical', 'staff', 'user'].includes(first) ? `/${first}` : '';
  }, [location.pathname]);
  const [retreat, setRetreat] = useState<Retreat | null>(null);
  const [staffAssignments, setStaffAssignments] = useState<RetreatStaffAssignment[]>([]);
  const [staffDirectory, setStaffDirectory] = useState<ContactBookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      retreatsApi.getOne(retreatId),
      contactBookApi.getAll({ role: 'helper' }),
      contactBookApi.getAll({ role: 'cook' }),
    ]).then(([retreatResponse, helpers, cooks]) => {
      const item = retreatResponse.data;
      setRetreat(item);
      const defaults = { startDate: formatDateForInput(item.startDate), startTime: item.startTime || '12:00', endDate: formatDateForInput(item.endDate), endTime: item.endTime || '10:00' };
      const assignments = (item.retreatStaff || []).map((assignment: RetreatStaffAssignment) => ({
        ...assignment,
        contactId: idOf(assignment.contactId),
        startDate: formatDateForInput(assignment.startDate) || defaults.startDate,
        startTime: assignment.startTime || defaults.startTime,
        endDate: formatDateForInput(assignment.endDate) || defaults.endDate,
        endTime: assignment.endTime || defaults.endTime,
        salaryCurrency: assignment.salaryCurrency || 'CZK',
      }));
      setStaffAssignments(assignments);
      setStaffDirectory([...helpers.data, ...cooks.data].filter((person, index, all) => person.isActive !== false && all.findIndex((candidate) => candidate._id === person._id) === index).sort((a, b) => a.name.localeCompare(b.name)));
    }).catch((cause: any) => setError(cause?.response?.data?.message || cause?.message || 'Unable to load retreat team.')).finally(() => setLoading(false));
  }, [retreatId]);

  const updateStaff = (index: number, patch: Partial<RetreatStaffAssignment>) => setStaffAssignments((current) => current.map((assignment, itemIndex) => itemIndex === index ? { ...assignment, ...patch } : assignment));
  const addStaff = () => setStaffAssignments((current) => [...current, { role: 'helper', contactId: '', startDate: formatDateForInput(retreat?.startDate) || '', startTime: retreat?.startTime || '12:00', endDate: formatDateForInput(retreat?.endDate) || '', endTime: retreat?.endTime || '10:00', salaryCurrency: 'CZK' }]);
  const removeStaff = (index: number) => setStaffAssignments((current) => current.filter((_, itemIndex) => itemIndex !== index));

  const save = async () => {
    setSaving(true); setSaved(false); setError('');
    try {
      const response = await retreatsApi.update(retreatId, { retreatStaff: staffAssignments });
      setRetreat(response.data || retreat);
      setSaved(true);
    } catch (cause: any) {
      const message = cause?.response?.data?.message || cause?.message || 'Unable to save the retreat team.';
      setError(Array.isArray(message) ? message.join(' ') : String(message));
    } finally { setSaving(false); }
  };

  if (loading) return <LoadingSpinner message="Loading retreat team…" />;
  if (!retreat) return <div className="p-6"><div className="alert alert-danger">{error || 'Retreat not found.'}</div></div>;
  const field = 'w-full border border-[#aeb5bf] bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600';
  const label = 'mb-1.5 block text-[10px] font-semibold uppercase tracking-[.14em] text-gray-600';

  return <main className="mx-auto min-h-full max-w-7xl border-t-4 border-blue-600 bg-[#eceff3] text-gray-900">
    <header className="flex flex-col gap-4 border-b border-gray-900 bg-white px-5 py-5 md:flex-row md:items-center md:justify-between md:px-8">
      <div>
        <button className="mb-3 inline-flex items-center gap-2 text-sm text-blue-700" onClick={() => navigate(`${prefix}/retreats/${retreatId}`)}><Icon component={FiArrowLeft} /> Back to retreat</button>
        <h1 className="text-2xl font-bold">Cooks and helpers</h1>
        <p className="mt-1 text-sm text-gray-600">{retreat.code || retreat.retreatCode || retreat.name}</p>
      </div>
      <button disabled={saving} onClick={save} className="inline-flex min-h-11 items-center justify-center gap-2 bg-gray-950 px-6 text-sm font-semibold text-white disabled:opacity-50"><Icon component={FiSave} />{saving ? 'Saving…' : 'Save team'}</button>
    </header>
    {error && <div className="mx-5 mt-5 border border-red-300 bg-red-50 p-3 text-sm text-red-800 md:mx-8">{error}</div>}
    {saved && <div className="mx-5 mt-5 border border-green-300 bg-green-50 p-3 text-sm text-green-800 md:mx-8">Team saved.</div>}
    <div className="p-5 md:p-8">
      <section className="border border-gray-300 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Assignments</h2>
            <p className="text-sm text-gray-600">Dates and times default to this retreat. Add Helper 2 explicitly when needed.</p>
          </div>
          <button type="button" onClick={addStaff} className="min-h-9 border border-gray-300 px-3 text-sm font-semibold">Add person</button>
        </div>
        <div className="space-y-3">
          {staffAssignments.map((assignment, index) => <div key={`${assignment.contactId || 'staff'}-${index}`} className="border border-gray-200 bg-gray-50 p-3">
            <div className="grid gap-3 md:grid-cols-[160px_1fr_auto]">
              <select aria-label="Staff role" className={field} value={assignment.role || 'helper'} onChange={(e) => updateStaff(index, { role: e.target.value })}>{staffRoleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              <select aria-label="Directory person" className={field} value={idOf(assignment.contactId)} onChange={(e) => { const contact = staffDirectory.find((person) => person._id === e.target.value); updateStaff(index, { contactId: e.target.value, name: contact?.name || assignment.name, phone: contact?.phone || assignment.phone, email: contact?.email || assignment.email }); }}><option value="">Select helper or cook</option>{staffDirectory.map((person) => <option key={person._id} value={person._id}>{person.name} ({person.role})</option>)}</select>
              <button type="button" onClick={() => removeStaff(index)} className="border border-red-200 px-3 text-sm text-red-700">Remove</button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <label><span className={label}>From date</span><input className={field} type="date" value={formatDateForInput(assignment.startDate)} onChange={(e) => updateStaff(index, { startDate: e.target.value })} /></label>
              <label><span className={label}>From time</span><input className={field} type="time" value={assignment.startTime || ''} onChange={(e) => updateStaff(index, { startTime: e.target.value })} /></label>
              <label><span className={label}>To date</span><input className={field} type="date" value={formatDateForInput(assignment.endDate)} onChange={(e) => updateStaff(index, { endDate: e.target.value })} /></label>
              <label><span className={label}>To time</span><input className={field} type="time" value={assignment.endTime || ''} onChange={(e) => updateStaff(index, { endTime: e.target.value })} /></label>
            </div>
          </div>)}
          {!staffAssignments.length && <p className="text-sm text-gray-500">No helpers or cooks assigned.</p>}
        </div>
      </section>
    </div>
  </main>;
};

export default RetreatStaffAssignmentsPage;
