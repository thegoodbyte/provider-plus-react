import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, ChefHat, Download, LayoutGrid, Mail, Table2, Utensils } from 'lucide-react';
import { foodMatrixApi, FoodMatrixColumn, FoodMatrixData } from '../services/api';
import LoadingSpinner from './LoadingSpinner';

interface FoodMatrixGridProps { retreatId: string; }
type ViewMode = 'table' | 'cards';
const LANGUAGE_OPTIONS = [{ value: '', label: 'Original language' }, { value: 'en', label: 'English' }, { value: 'pl', label: 'Polish' }, { value: 'cs', label: 'Czech' }];
const meaningful = (value: unknown) => { const text = String(value ?? '').trim().toLowerCase(); return Boolean(text && !['none', 'no', '—', 'not applicable', 'brak', 'nie', 'žádné', 'zadne', 'ne'].includes(text)); };
const hasSafetyFlag = (column: FoodMatrixColumn) => meaningful(column.answers.allergies) || meaningful(column.answers.foodIntolerances);
const valueFor = (column: FoodMatrixColumn, key: string) => String(column.answers[key] ?? '').trim();

const FoodMatrixGrid: React.FC<FoodMatrixGridProps> = ({ retreatId }) => {
  const [data, setData] = useState<FoodMatrixData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [language, setLanguage] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isExporting, setIsExporting] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const fetchMatrix = useCallback(async () => {
    try { setIsLoading(true); setData((await foodMatrixApi.get(retreatId)).data); }
    catch (error) { console.error('Error fetching food matrix:', error); setData(null); }
    finally { setIsLoading(false); }
  }, [retreatId]);
  useEffect(() => { fetchMatrix(); }, [fetchMatrix]);

  const summary = useMemo(() => ({
    submitted: data?.columns.filter((column) => column.submitted).length || 0,
    missing: data?.columns.filter((column) => !column.submitted).length || 0,
    safety: data?.columns.filter(hasSafetyFlag).length || 0,
  }), [data]);

  const handleDownloadPdf = async () => {
    try {
      setIsExporting(true); setMessage(null);
      const response = await foodMatrixApi.getPdf(retreatId, language || undefined);
      const url = URL.createObjectURL(response.data as Blob); const link = document.createElement('a');
      link.href = url; link.download = `food-matrix-${data?.retreatLabel || retreatId}${language ? `-${language}` : ''}.pdf`; link.click(); URL.revokeObjectURL(url);
    } catch (error: any) { setMessage({ tone: 'error', text: error?.response?.data?.message || 'Unable to generate the PDF. Please try again.' }); }
    finally { setIsExporting(false); }
  };

  const handleEmailCook = async () => {
    if (!data?.cook?.email) return;
    try {
      setIsEmailing(true); setMessage(null); const response = await foodMatrixApi.emailCook(retreatId);
      setMessage({ tone: 'success', text: `Food Matrix emailed to ${response.data.cookName} at ${response.data.to}.` });
    } catch (error: any) { setMessage({ tone: 'error', text: error?.response?.data?.message || 'Unable to email the Food Matrix.' }); }
    finally { setIsEmailing(false); }
  };

  if (isLoading) return <LoadingSpinner message="Loading food matrix..." />;
  if (!data) return <div className="p-6 text-sm text-gray-500">Unable to load the food matrix.</div>;

  return <section className="food-matrix-shell">
    <header className="food-matrix-hero">
      <div className="food-matrix-title"><span className="food-matrix-icon"><Utensils size={22} /></span><div><h2>Food Matrix</h2><p>{data.retreatLabel || 'Retreat kitchen overview'} · {data.columns.length} clients</p></div></div>
      <div className="food-matrix-actions">
        <div className="food-view-toggle" role="group" aria-label="Food matrix view"><button className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}><Table2 size={15} /> Table</button><button className={viewMode === 'cards' ? 'active' : ''} onClick={() => setViewMode('cards')}><LayoutGrid size={15} /> Cards</button></div>
        <select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label="PDF language">{LANGUAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        <button className="food-action secondary" onClick={handleDownloadPdf} disabled={isExporting || !data.columns.length}><Download size={16} />{isExporting ? 'Generating…' : 'Download PDF'}</button>
        {data.cook?.email && <button className="food-action primary" onClick={handleEmailCook} disabled={isEmailing || !data.columns.length}><Mail size={16} />{isEmailing ? 'Sending…' : 'Email cook'}</button>}
      </div>
    </header>

    <div className="food-summary-strip">
      <div><Check size={17} /><span><strong>{summary.submitted}</strong> submitted</span></div>
      <div className={summary.missing ? 'warning' : ''}><AlertTriangle size={17} /><span><strong>{summary.missing}</strong> missing forms</span></div>
      <div className={summary.safety ? 'danger' : ''}><AlertTriangle size={17} /><span><strong>{summary.safety}</strong> allergy/intolerance flags</span></div>
      <div className="cook-summary"><ChefHat size={18} /><span>{data.cook ? <><strong>{data.cook.name}</strong>{data.cook.email ? ` · ${data.cook.language.toUpperCase()}` : ' · email missing'}</> : 'No cook assigned'}</span></div>
    </div>
    {message && <div className={`food-matrix-message ${message.tone}`}>{message.text}</div>}
    {!data.cook && <div className="food-matrix-notice">Assign a cook on the retreat file to enable emailing the translated PDF.</div>}
    {data.cook && !data.cook.email && <div className="food-matrix-notice">Add an email address for {data.cook.name} to enable emailing the PDF.</div>}

    {!data.columns.length ? <div className="food-matrix-empty">No active clients booked on this retreat yet.</div> : viewMode === 'table' ? <div className="food-matrix-table-wrap"><table className="food-matrix-table"><thead><tr><th>Kitchen information</th>{data.columns.map((column) => <th key={column.clientId} className={hasSafetyFlag(column) ? 'client-risk' : column.submitted ? 'client-ready' : 'client-missing'}><div className="client-heading"><span>{column.label}</span>{hasSafetyFlag(column) ? <small><AlertTriangle size={12} /> Check allergy</small> : column.submitted ? <small><Check size={12} /> Submitted</small> : <small>Not submitted</small>}</div></th>)}</tr></thead><tbody>{data.questions.map((question) => <tr key={question.key} className={['allergies', 'foodIntolerances'].includes(question.key) ? 'safety-row' : ''}><th>{question.label}</th>{data.columns.map((column) => { const value = valueFor(column, question.key); const flagged = ['allergies', 'foodIntolerances'].includes(question.key) && meaningful(value); return <td key={column.clientId} className={flagged ? 'flagged-cell' : ''}>{value || <span className="empty-value">—</span>}</td>; })}</tr>)}</tbody></table></div> : <div className="food-matrix-cards">{data.columns.map((column) => <article key={column.clientId} className={`food-client-card ${hasSafetyFlag(column) ? 'has-risk' : ''}`}><header><div><h3>{column.label}</h3><p>{column.submitted ? 'Food form submitted' : 'Food form not submitted'}</p></div><span className={`food-client-status ${column.submitted ? 'ready' : 'missing'}`}>{column.submitted ? <Check size={14} /> : <AlertTriangle size={14} />}{column.submitted ? 'Ready' : 'Missing'}</span></header>{column.submitted ? <dl className="food-client-fields">{data.questions.map((question) => { const value = valueFor(column, question.key); const flagged = ['allergies', 'foodIntolerances'].includes(question.key) && meaningful(value); return <div key={question.key} className={flagged ? 'risk-field' : ''}><dt>{question.label}</dt><dd>{value || '—'}</dd></div>; })}</dl> : <div className="food-card-missing">No kitchen information is available for this client.</div>}</article>)}</div>}
  </section>;
};
export default FoodMatrixGrid;
