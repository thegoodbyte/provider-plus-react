import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, Coffee, FileText, LayoutGrid, Pill } from 'lucide-react';
import { medicalArtifactsApi } from '../services/api';
import { MedicalArtifact } from '../types';
import ClientFoodFormsPage from './ClientFoodFormsPage';
import ClientMedicationsGrid from './ClientMedicationsGrid';

type FormsTab = 'overview' | 'questionnaires' | 'food' | 'medications';

const tabs: Array<{ id: FormsTab; label: string; Icon: any }> = [
  { id: 'overview', label: 'Overview', Icon: LayoutGrid },
  { id: 'questionnaires', label: 'Health questionnaires', Icon: ClipboardList },
  { id: 'food', label: 'Food forms', Icon: Coffee },
  { id: 'medications', label: 'Medication forms', Icon: Pill },
];

const clientName = (artifact: MedicalArtifact) => {
  const client: any = artifact.clientId;
  if (!client || typeof client === 'string') return artifact.clientDisplayId ? `Client #${artifact.clientDisplayId}` : 'Client';
  return [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ') || client.email || `Client #${client.display_id || '—'}`;
};

const retreatName = (artifact: MedicalArtifact) => {
  const retreat: any = artifact.retreatId;
  if (!retreat || typeof retreat === 'string') return '—';
  return retreat.code || retreat.retreatCode || retreat.name || '—';
};

const answerEntries = (artifact: MedicalArtifact): Array<[string, unknown]> => {
  const answers = artifact.data?.answers;
  if (answers && typeof answers === 'object' && !Array.isArray(answers)) return Object.entries(answers);
  return [];
};

const QuestionnairesPanel: React.FC = () => {
  const [rows, setRows] = useState<MedicalArtifact[]>([]);
  const [selected, setSelected] = useState<MedicalArtifact | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    medicalArtifactsApi.getAll({ artifactType: 'questionnaire' })
      .then((response) => setRows(response.data || []))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => rows.filter((row) => {
    const haystack = `${row.display_id || ''} ${row.title || ''} ${clientName(row)} ${retreatName(row)} ${row.textContent || ''}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  }), [rows, search]);

  return <section>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
      <label className="block w-full max-w-md text-sm text-gray-600">Search questionnaires
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Client, retreat, reference, or answer" className="mt-2 h-10 w-full border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-600" />
      </label>
      <div><strong className="text-3xl text-gray-900">{visible.length}</strong><span className="ml-2 text-sm text-gray-500">questionnaires</span></div>
    </div>
    <div className="overflow-x-auto border border-gray-200 bg-white">
      <table className="min-w-[850px] w-full border-collapse">
        <thead><tr className="border-b border-gray-200 bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500">{['Reference', 'Client', 'Retreat', 'Form', 'Submitted', 'Action'].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {loading && <tr><td colSpan={6} className="p-10 text-center text-gray-500">Loading questionnaires…</td></tr>}
          {!loading && visible.map((row) => <tr key={row._id} className="hover:bg-blue-50/40">
            <td className="px-4 py-4 text-sm">#{row.display_id || '—'}</td>
            <td className="px-4 py-4 font-medium text-gray-900">{clientName(row)}</td>
            <td className="px-4 py-4 text-sm text-gray-600">{retreatName(row)}</td>
            <td className="px-4 py-4"><div className="font-medium text-gray-900">{row.title || 'Health Questionnaire'}</div><div className="text-xs capitalize text-gray-500">{row.status || 'received'}</div></td>
            <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">{row.receivedAt ? new Date(row.receivedAt).toLocaleString() : '—'}</td>
            <td className="px-4 py-4"><button type="button" onClick={() => setSelected(row)} className="font-semibold text-blue-700 hover:underline">View answers</button></td>
          </tr>)}
          {!loading && !visible.length && <tr><td colSpan={6} className="p-10 text-center text-gray-500">No questionnaires found.</td></tr>}
        </tbody>
      </table>
    </div>
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Questionnaire answers">
      <section className="max-h-[90vh] w-full max-w-4xl overflow-auto bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-gray-200 pb-4"><div><h2 className="text-2xl font-bold text-gray-900">{selected.title || 'Health Questionnaire'} #{selected.display_id || '—'}</h2><p className="mt-1 text-sm text-gray-500">{clientName(selected)} · {retreatName(selected)}</p></div><button type="button" onClick={() => setSelected(null)} className="text-sm text-gray-600 hover:underline">Close</button></div>
        {answerEntries(selected).length > 0 ? <dl className="grid gap-4 sm:grid-cols-2">{answerEntries(selected).map(([key, value]) => <div key={key} className="bg-gray-50 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())}</dt><dd className="mt-2 whitespace-pre-wrap text-sm text-gray-900">{Array.isArray(value) ? value.join(', ') : String(value ?? '—')}</dd></div>)}</dl> : <pre className="whitespace-pre-wrap rounded bg-gray-50 p-5 font-sans text-sm leading-6 text-gray-800">{selected.textContent || 'No answer text is available for this submission.'}</pre>}
      </section>
    </div>}
  </section>;
};

export const ClientFormsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') as FormsTab | null;
  const activeTab: FormsTab = tabs.some((tab) => tab.id === requestedTab) ? requestedTab! : 'overview';
  const selectTab = (tab: FormsTab) => setSearchParams(tab === 'overview' ? {} : { tab });

  return <main className="min-h-full bg-gray-50 p-5 md:p-8">
    <div className="mx-auto max-w-[1320px]">
      <header className="mb-7"><div className="flex items-center gap-3"><div className="rounded-xl bg-blue-100 p-3 text-blue-700"><FileText size={24} /></div><div><h1 className="text-3xl font-bold text-gray-900">Client Forms</h1><p className="mt-1 text-gray-600">Questionnaires, food forms, and medication forms in one workspace.</p></div></div></header>
      <nav className="mb-8 flex gap-1 overflow-x-auto border-b border-gray-200" aria-label="Client forms sections">{tabs.map(({ id, label, Icon }) => <button key={id} type="button" onClick={() => selectTab(id)} className={`flex whitespace-nowrap items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === id ? 'border-blue-700 text-blue-800' : 'border-transparent text-gray-500 hover:text-gray-900'}`}><Icon size={17} />{label}</button>)}</nav>

      {activeTab === 'overview' && <section className="grid gap-5 md:grid-cols-3">{tabs.filter((tab) => tab.id !== 'overview').map(({ id, label, Icon }) => <button key={id} type="button" onClick={() => selectTab(id)} className="group border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"><Icon className="mb-5 text-blue-700" size={26} /><h2 className="text-lg font-semibold text-gray-900">{label}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-gray-600">{id === 'questionnaires' ? 'Health, intake, and preparation questionnaire submissions.' : id === 'food' ? 'Dietary preferences, allergies, and kitchen requirements.' : 'Medication records and submitted medication forms.'}</p><span className="mt-5 inline-block text-sm font-semibold text-blue-700">Open {label.toLowerCase()} →</span></button>)}</section>}
      {activeTab === 'questionnaires' && <QuestionnairesPanel />}
      {activeTab === 'food' && <ClientFoodFormsPage embedded />}
      {activeTab === 'medications' && <ClientMedicationsGrid embedded />}
    </div>
  </main>;
};

export default ClientFormsPage;
