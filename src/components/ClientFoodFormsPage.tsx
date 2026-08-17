import React, { useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import { clientFoodFormsApi, ClientFoodForm } from '../services/clientFoodFormsApi';

const label = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase());

const QUESTION_LABELS: Record<string, Record<string, string>> = {
  en: { fullName: 'Name', dietType: 'Usual diet', allergies: 'Food allergies and severity', foodIntolerances: 'Food intolerances', foodsAvoided: 'Foods not eaten', foodsDisliked: 'Strongly disliked foods', preferredProteins: 'Preferred proteins', height: 'Height (cm)', weight: 'Weight (kg)', additionalNotes: 'Additional kitchen notes' },
  cs: { fullName: 'Jméno', dietType: 'Obvyklá strava', allergies: 'Potravinové alergie a závažnost', foodIntolerances: 'Potravinové intolerance', foodsAvoided: 'Potraviny, které nejíte', foodsDisliked: 'Výrazně neoblíbené potraviny', preferredProteins: 'Preferované bílkoviny', height: 'Výška (cm)', weight: 'Hmotnost (kg)', additionalNotes: 'Další poznámky pro kuchyni' },
  pl: { fullName: 'Imię i nazwisko', dietType: 'Zwyczajowa dieta', allergies: 'Alergie pokarmowe i ich nasilenie', foodIntolerances: 'Nietolerancje pokarmowe', foodsAvoided: 'Niejedzone produkty', foodsDisliked: 'Bardzo nielubiane produkty', preferredProteins: 'Preferowane białka', height: 'Wzrost (cm)', weight: 'Waga (kg)', additionalNotes: 'Dodatkowe uwagi dla kuchni' },
};

const retreatLabel = (row: ClientFoodForm) => {
  if (!row.retreat_id || typeof row.retreat_id === 'string') return '—';
  return row.retreat_id.code || row.retreat_id.retreatCode || row.retreat_id.name || '—';
};

const ClientFoodFormsPage: React.FC = () => {
  const [rows, setRows] = useState<ClientFoodForm[]>([]);
  const [selected, setSelected] = useState<ClientFoodForm | null>(null);
  const [search, setSearch] = useState('');
  const [retreatFilter, setRetreatFilter] = useState('');
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [matrixLanguage, setMatrixLanguage] = useState<'en' | 'cs' | 'pl'>('en');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setRows((await clientFoodFormsApi.getAll()).data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const retreatOptions = useMemo(() => Array.from(new Set(rows.map(retreatLabel).filter((value) => value !== '—'))).sort(), [rows]);
  const visible = useMemo(() => rows.filter((row) => {
    const haystack = `${row.display_id} ${row.email} ${row.signature_name} ${row.client_id} ${retreatLabel(row)}`.toLowerCase();
    return haystack.includes(search.toLowerCase()) && (!retreatFilter || retreatLabel(row) === retreatFilter);
  }), [rows, search, retreatFilter]);
  const unreviewed = visible.filter((row) => row.status === 'submitted').length;
  const matrixRows = useMemo(() => {
    const keys = new Set<string>();
    visible.forEach((row) => Object.keys(row.answers || {}).forEach((key) => keys.add(key)));
    return Array.from(keys);
  }, [visible]);
  const matrixLabel = (key: string) => QUESTION_LABELS[matrixLanguage][key] || QUESTION_LABELS.en[key] || label(key);
  const answerText = (value: unknown) => Array.isArray(value) ? value.join(', ') : String(value ?? '—');

  const downloadMatrix = () => {
    if (!retreatFilter || !visible.length) return;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const margin = 28;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const questionWidth = 145;
    const clientWidth = Math.max(76, (pageWidth - margin * 2 - questionWidth) / visible.length);
    let y = margin;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.text(`Food matrix — ${retreatFilter}`, margin, y); y += 22;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.text(`Language: ${matrixLanguage.toUpperCase()} · ${new Date().toLocaleDateString()}`, margin, y); y += 16;
    const drawHeader = () => {
      pdf.setFillColor(232, 246, 251); pdf.rect(margin, y - 10, pageWidth - margin * 2, 28, 'F');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.text('Question', margin + 5, y + 6);
      visible.forEach((client, index) => pdf.text(client.signature_name.slice(0, 18), margin + questionWidth + index * clientWidth + 4, y + 6, { maxWidth: clientWidth - 8 }));
      y += 28;
    };
    drawHeader();
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7);
    matrixRows.forEach((key) => {
      const values = visible.map((client) => answerText(client.answers?.[key]));
      const rowHeight = 24;
      if (y + rowHeight > pageHeight - margin) { pdf.addPage(); y = margin; drawHeader(); }
      pdf.setDrawColor(210, 210, 210); pdf.line(margin, y, pageWidth - margin, y);
      pdf.setFont('helvetica', 'bold'); pdf.text(matrixLabel(key), margin + 5, y + 15, { maxWidth: questionWidth - 10 });
      pdf.setFont('helvetica', 'normal'); values.forEach((value, index) => pdf.text(value.slice(0, 42), margin + questionWidth + index * clientWidth + 4, y + 15, { maxWidth: clientWidth - 8 }));
      y += rowHeight;
    });
    pdf.save(`food-matrix-${retreatFilter}.pdf`);
  };

  const setStatus = async (row: ClientFoodForm, status: ClientFoodForm['status']) => {
    const updated = (await clientFoodFormsApi.update(row._id, { status })).data;
    setRows((all) => all.map((item) => item._id === updated._id ? updated : item));
    setSelected(updated);
  };

  const remove = async (row: ClientFoodForm) => {
    if (!window.confirm(`Delete food form #${row.display_id}?`)) return;
    await clientFoodFormsApi.delete(row._id);
    setSelected(null);
    await load();
  };

  return (
    <main className="min-h-full bg-[#f7f6f6] px-6 py-8 text-[#242122] md:px-10 lg:px-12">
      <div className="max-w-[1240px]">
        <header className="mb-12">
          <p className="font-serif text-xs font-bold uppercase tracking-[0.28em] text-[#07516c]">Kitchen desk</p>
          <h1 className="mt-2 font-serif text-5xl font-bold tracking-tight md:text-6xl">Client Food Forms</h1>
          <p className="mt-3 font-serif text-lg text-[#5d5859]">Submitted dietary preferences, allergies, and kitchen requirements.</p>
        </header>

        <section className="mb-10 grid items-end gap-7 md:grid-cols-[300px_300px_1fr]">
          <label className="block font-serif text-sm text-[#514c4d]">
            Search
            <input className="mt-2 h-10 w-full border border-[#c8c5c5] bg-[#f1f0f0] px-3 font-serif text-sm outline-none focus:border-[#07516c]" placeholder="Name, email, client, or reference" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label className="block font-serif text-sm text-[#514c4d]">
            Retreat
            <select className="mt-2 h-10 w-full border border-[#c8c5c5] bg-[#f1f0f0] px-3 font-serif text-sm outline-none focus:border-[#07516c]" value={retreatFilter} onChange={(event) => setRetreatFilter(event.target.value)}>
              <option value="">All retreats</option>
              {retreatOptions.map((retreat) => <option key={retreat} value={retreat}>{retreat}</option>)}
            </select>
          </label>
          <div className="font-serif md:pl-1">
            <div className="text-3xl leading-none">{visible.length}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[#777172]">of {rows.length} forms</div>
          </div>
        </section>

        <section>
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
            <div className="flex items-baseline gap-4"><h2 className="font-serif text-2xl font-bold">{retreatFilter || 'All retreats'}</h2><span className="font-serif text-sm italic text-[#777172]">{unreviewed} unreviewed across {retreatOptions.length || 0} retreats</span></div>
            <button type="button" disabled={!retreatFilter || !visible.length} onClick={() => setMatrixOpen(true)} className="border border-[#07516c] bg-[#07516c] px-4 py-2 font-serif text-sm text-white transition hover:bg-[#063d51] disabled:cursor-not-allowed disabled:border-[#c8c5c5] disabled:bg-[#dedbdb] disabled:text-[#777172]">Food matrix</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full border-collapse font-serif">
              <thead>
                <tr className="border-b border-[#d4d1d1] text-left text-[11px] uppercase tracking-[0.15em] text-[#777172]">
                  {['Ref', 'Client', 'Retreat', 'Submitted', 'Lang', 'Status', 'Actions'].map((title) => <th key={title} className="px-2 pb-3 font-normal">{title}</th>)}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} className="px-2 py-12 text-center text-sm text-[#777172]">Loading food forms…</td></tr>}
                {!loading && visible.map((row) => (
                  <tr key={row._id} className="border-b border-[#dedbdb] transition-colors hover:bg-[#efeeee]">
                    <td className="px-2 py-4 text-sm">#{row.display_id}</td>
                    <td className="px-2 py-4"><div className="text-base">{row.signature_name}</div><div className="mt-1 text-xs text-[#777172]">{row.email}</div></td>
                    <td className="px-2 py-4"><span className="inline-block bg-[#e8f6fb] px-3 py-1 text-xs text-[#07516c]">{retreatLabel(row)}</span></td>
                    <td className="whitespace-nowrap px-2 py-4 text-sm text-[#5d5859]">{row.submitted_at ? new Date(row.submitted_at).toLocaleString() : '—'}</td>
                    <td className="px-2 py-4 text-sm uppercase">{row.language === 'cs' ? 'CS' : row.language}</td>
                    <td className="px-2 py-4"><select value={row.status} onChange={(event) => setStatus(row, event.target.value as ClientFoodForm['status'])} className="h-9 min-w-[150px] border border-[#c8c5c5] bg-[#f1f0f0] px-2 text-sm"><option value="submitted">Received</option><option value="reviewed">Reviewed</option><option value="draft">Draft</option></select></td>
                    <td className="whitespace-nowrap px-2 py-4 text-sm"><button className="mr-3 text-[#07516c] hover:underline" onClick={() => setSelected(row)}>View</button><button className="text-[#8c003d] hover:underline" onClick={() => remove(row)}>Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && !visible.length && <p className="border-b border-[#dedbdb] py-12 text-center font-serif text-[#777172]">No food forms found.</p>}
        </section>
      </div>

      {matrixOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Food matrix">
        <section className="max-h-[92vh] w-full max-w-[1400px] overflow-hidden bg-white p-6 shadow-2xl">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-4"><div><h2 className="font-serif text-2xl font-bold">Food matrix · {retreatFilter}</h2><p className="mt-1 text-sm text-gray-500">Clients are columns; submitted questions are rows.</p></div><div className="flex items-center gap-3"><label className="text-sm text-gray-600">Translation<select className="ml-2 border border-gray-300 px-2 py-1" value={matrixLanguage} onChange={(event) => setMatrixLanguage(event.target.value as 'en' | 'cs' | 'pl')}><option value="en">English</option><option value="cs">Čeština</option><option value="pl">Polski</option></select></label><button type="button" onClick={downloadMatrix} className="bg-[#07516c] px-4 py-2 text-sm text-white hover:bg-[#063d51]">Download PDF</button><button type="button" onClick={() => setMatrixOpen(false)} className="text-sm text-gray-600 hover:underline">Close</button></div></div>
          <div className="max-h-[70vh] overflow-auto"><table className="min-w-full border-collapse text-sm"><thead className="sticky top-0 bg-[#e8f6fb]"><tr><th className="sticky left-0 z-10 min-w-[180px] border-b border-gray-300 bg-[#e8f6fb] p-3 text-left font-semibold">{matrixLanguage === 'cs' ? 'Otázka' : matrixLanguage === 'pl' ? 'Pytanie' : 'Question'}</th>{visible.map((client) => <th key={client._id} className="min-w-[150px] border-b border-gray-300 p-3 text-left font-semibold">{client.signature_name}</th>)}</tr></thead><tbody>{matrixRows.map((key) => <tr key={key} className="border-b border-gray-200"><th className="sticky left-0 bg-white p-3 text-left font-semibold">{matrixLabel(key)}</th>{visible.map((client) => <td key={`${client._id}-${key}`} className="max-w-[240px] whitespace-pre-wrap p-3 align-top text-gray-700">{answerText(client.answers?.[key])}</td>)}</tr>)}</tbody></table></div>
        </section>
      </div>}

      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
        <section className="max-h-[90vh] w-full max-w-3xl overflow-auto bg-white p-6 shadow-2xl">
          <div className="mb-5 flex justify-between border-b border-gray-200 pb-4"><div><h2 className="font-serif text-2xl font-bold">Food form #{selected.display_id}</h2><p className="text-sm text-gray-500">{selected.signature_name} · {retreatLabel(selected)} · {selected.email}</p></div><button className="text-sm text-gray-600 hover:underline" onClick={() => setSelected(null)}>Close</button></div>
          <dl className="grid gap-4 sm:grid-cols-2">{Object.entries(selected.answers || {}).map(([key, value]) => <div key={key} className="bg-gray-50 p-3"><dt className="text-xs font-semibold uppercase text-gray-500">{label(key)}</dt><dd className="mt-1 whitespace-pre-wrap text-gray-900">{Array.isArray(value) ? value.join(', ') : String(value || '—')}</dd></div>)}</dl>
        </section>
      </div>}
    </main>
  );
};

export default ClientFoodFormsPage;
