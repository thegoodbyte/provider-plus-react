import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAlertTriangle, FiArrowRight, FiCheckCircle, FiCpu, FiRefreshCw, FiSearch, FiSend } from 'react-icons/fi';
import {
  assistantApi,
  bookingsApi,
  retreatsApi,
  BookingReadinessAssistantResult,
  RetreatReadinessAssistantResult,
} from '../services/api';
import { Retreat, RetreatClient } from '../types';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon, className }) => React.createElement(icon as any, { className });

const getObjectId = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
};

const getClientName = (booking: RetreatClient): string => {
  const client: any = booking.clientId || {};
  return [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ').trim() || 'Unknown client';
};

const getRetreatName = (booking: RetreatClient): string => {
  const retreat: any = booking.retreatId || {};
  return retreat.code || retreat.retreatCode || retreat.name || 'Unknown retreat';
};

const formatRetreatName = (retreat: Retreat): string => retreat.code || retreat.retreatCode || retreat.name || 'Unnamed retreat';

const formatMoney = (amount?: number, currency?: string) => {
  if (typeof amount !== 'number') return '-';
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency || ''}`.trim();
};

const severityClass: Record<string, string> = {
  high: 'border-red-200 bg-red-50 text-red-950',
  medium: 'border-amber-200 bg-amber-50 text-amber-950',
  low: 'border-emerald-200 bg-emerald-50 text-emerald-950',
};

type Mode = 'retreat' | 'booking';
type ChatMessage = { role: 'user' | 'assistant'; text: string; generatedBy?: 'rules' | 'openai' };

const AssistantPage: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('retreat');
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [bookings, setBookings] = useState<RetreatClient[]>([]);
  const [selectedRetreatId, setSelectedRetreatId] = useState('');
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [error, setError] = useState('');
  const [bookingAnalysis, setBookingAnalysis] = useState<BookingReadinessAssistantResult | null>(null);
  const [retreatAnalysis, setRetreatAnalysis] = useState<RetreatReadinessAssistantResult | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: 'Select a retreat and ask me things like: who is missing EKG, who is missing liver, who has no MRR, who is medically approved, or what steps are blocking this retreat.',
      generatedBy: 'rules',
    },
  ]);

  useEffect(() => {
    let mounted = true;
    setLoadingOptions(true);
    Promise.all([retreatsApi.getAll(), bookingsApi.getAll()])
      .then(([retreatResponse, bookingResponse]) => {
        if (!mounted) return;
        const retreatRows = retreatResponse.data || [];
        const bookingRows = bookingResponse.data || [];
        setRetreats(retreatRows);
        setBookings(bookingRows);
        const upcoming = retreatRows.find((retreat: any) => retreat.status === 'upcoming') || retreatRows[0];
        const firstActiveBooking = bookingRows.find((booking: any) => booking.status !== 'cancelled') || bookingRows[0];
        if (upcoming?._id) setSelectedRetreatId(upcoming._id);
        if (firstActiveBooking?._id) setSelectedBookingId(firstActiveBooking._id);
      })
      .catch(() => {
        if (mounted) setError('Unable to load assistant options.');
      })
      .finally(() => {
        if (mounted) setLoadingOptions(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filteredRetreats = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const rows = retreats.slice().sort((a: any, b: any) => String(a.startDate || '').localeCompare(String(b.startDate || '')));
    if (!query) return rows.slice(0, 80);
    return rows.filter((retreat) => [formatRetreatName(retreat), retreat.location, retreat.location_town, retreat.locationTown].filter(Boolean).join(' ').toLowerCase().includes(query)).slice(0, 80);
  }, [retreats, searchTerm]);

  const filteredBookings = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return bookings.slice(0, 80);
    return bookings.filter((booking) => [booking.bookingNumber, getClientName(booking), getRetreatName(booking), (booking as any).clientId?.email].filter(Boolean).join(' ').toLowerCase().includes(query)).slice(0, 80);
  }, [bookings, searchTerm]);

  const selectedBooking = useMemo(() => bookings.find((booking) => booking._id === selectedBookingId), [bookings, selectedBookingId]);

  const runAnalysis = async () => {
    setLoadingAnalysis(true);
    setError('');
    try {
      if (mode === 'retreat') {
        if (!selectedRetreatId) return;
        const response = await assistantApi.analyzeRetreatReadiness(selectedRetreatId);
        setRetreatAnalysis(response.data);
      } else {
        if (!selectedBookingId) return;
        const response = await assistantApi.analyzeBookingReadiness(selectedBookingId);
        setBookingAnalysis(response.data);
      }
    } catch {
      setError('Unable to run assistant analysis.');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  useEffect(() => {
    if (loadingOptions) return;
    if (mode === 'retreat' && selectedRetreatId && !retreatAnalysis) runAnalysis();
    if (mode === 'booking' && selectedBookingId && !bookingAnalysis) runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedRetreatId, selectedBookingId, loadingOptions]);

  const sendChat = async (preset?: string) => {
    const message = (preset || chatInput).trim();
    if (!message) return;
    setMessages((items) => [...items, { role: 'user', text: message }]);
    setChatInput('');
    setLoadingChat(true);
    setError('');
    try {
      const response = await assistantApi.chat({
        scope: mode,
        retreatId: mode === 'retreat' ? selectedRetreatId : undefined,
        bookingId: mode === 'booking' ? selectedBookingId : undefined,
        message,
      });
      setMessages((items) => [...items, { role: 'assistant', text: response.data.answer, generatedBy: response.data.generatedBy }]);
      if (mode === 'retreat' && response.data.analysis) setRetreatAnalysis(response.data.analysis as RetreatReadinessAssistantResult);
      if (mode === 'booking' && response.data.analysis) setBookingAnalysis(response.data.analysis as BookingReadinessAssistantResult);
    } catch {
      setMessages((items) => [...items, { role: 'assistant', text: 'I could not answer that question from the current data.', generatedBy: 'rules' }]);
    } finally {
      setLoadingChat(false);
    }
  };

  const openLink = (link?: string) => {
    if (link) navigate(link);
  };

  const activeAnalysis = mode === 'retreat' ? retreatAnalysis : bookingAnalysis;

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 border-b border-gray-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-700">
            <Icon icon={FiCpu} className="h-4 w-4" />
            Assistant
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-gray-950">Readiness Assistant</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Chat with retreat or booking readiness data, then drill down client by client.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setMode('retreat')} className={`rounded-apple px-4 py-2 text-sm font-semibold ${mode === 'retreat' ? 'bg-gray-950 text-white' : 'border border-gray-200 bg-white text-gray-700'}`}>
            Retreat
          </button>
          <button type="button" onClick={() => setMode('booking')} className={`rounded-apple px-4 py-2 text-sm font-semibold ${mode === 'booking' ? 'bg-gray-950 text-white' : 'border border-gray-200 bg-white text-gray-700'}`}>
            Booking
          </button>
          <button type="button" onClick={runAnalysis} disabled={loadingAnalysis} className="inline-flex items-center justify-center gap-2 rounded-apple bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300">
            <Icon icon={FiRefreshCw} className={`h-4 w-4 ${loadingAnalysis ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-apple border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <section className="rounded-apple border border-gray-200 bg-white p-4 shadow-sm">
          <label className="mb-2 block text-sm font-semibold text-gray-900">{mode === 'retreat' ? 'Retreat' : 'Booking'}</label>
          <div className="mb-3 flex items-center gap-2 rounded-apple border border-gray-200 px-3 py-2">
            <Icon icon={FiSearch} className="h-4 w-4 text-gray-400" />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={mode === 'retreat' ? 'Search retreat' : 'Search booking, client, retreat'} className="w-full border-0 bg-transparent text-sm outline-none" />
          </div>

          <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
            {loadingOptions ? <div className="py-8 text-center text-sm text-gray-500">Loading...</div> : null}
            {!loadingOptions && mode === 'retreat' && filteredRetreats.map((retreat) => {
              const id = getObjectId(retreat);
              const active = id === selectedRetreatId;
              return (
                <button key={id} type="button" onClick={() => { setSelectedRetreatId(id); setRetreatAnalysis(null); setMessages([{ role: 'assistant', text: 'Ask me about EKGs, liver panels, MRRs, approvals, or missing steps for this retreat.', generatedBy: 'rules' }]); }} className={`w-full rounded-apple border px-3 py-3 text-left transition-colors ${active ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                  <div className="text-sm font-semibold text-blue-700">{formatRetreatName(retreat)}</div>
                  <div className="mt-1 text-xs text-gray-500">{String(retreat.startDate || '').slice(0, 10)} {retreat.location_town || retreat.locationTown || retreat.location || ''}</div>
                </button>
              );
            })}
            {!loadingOptions && mode === 'booking' && filteredBookings.map((booking) => {
              const id = getObjectId(booking);
              const active = id === selectedBookingId;
              return (
                <button key={id} type="button" onClick={() => { setSelectedBookingId(id); setBookingAnalysis(null); }} className={`w-full rounded-apple border px-3 py-3 text-left transition-colors ${active ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-blue-700">#{booking.bookingNumber || '-'}</span>
                    <span className="text-xs font-medium text-gray-500">{booking.status || 'pending'}</span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-950">{getClientName(booking)}</div>
                  <div className="mt-1 text-xs text-gray-500">{getRetreatName(booking)}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="min-h-[680px] rounded-apple border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-5 2xl:grid-cols-[1fr_420px]">
            <div className="space-y-5">
              <SummaryPanel analysis={activeAnalysis} selectedBooking={selectedBooking} mode={mode} />
              {mode === 'retreat' && retreatAnalysis && <RetreatClientTable analysis={retreatAnalysis} onOpen={openLink} />}
              {mode === 'booking' && bookingAnalysis && <BookingDetails analysis={bookingAnalysis} onOpen={openLink} />}
            </div>

            <aside className="rounded-apple border border-gray-200 bg-gray-50 p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Chat</h2>
              <div className="mb-3 flex flex-wrap gap-2">
                {['Who is missing EKG?', 'Who is missing liver?', 'Who has no MRR?', 'Who is medically approved?', 'What steps are missing?'].map((question) => (
                  <button key={question} type="button" onClick={() => sendChat(question)} className="rounded-apple border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100">
                    {question}
                  </button>
                ))}
              </div>
              <div className="mb-3 max-h-[440px] space-y-3 overflow-y-auto pr-1">
                {messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`rounded-apple border p-3 text-sm leading-6 ${message.role === 'user' ? 'border-blue-200 bg-blue-50 text-blue-950' : 'border-gray-200 bg-white text-gray-800'}`}>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{message.role === 'user' ? 'You' : message.generatedBy === 'openai' ? 'Assistant AI' : 'Assistant'}</div>
                    <div className="whitespace-pre-line">{message.text}</div>
                  </div>
                ))}
                {loadingChat && <div className="rounded-apple border border-gray-200 bg-white p-3 text-sm text-gray-500">Thinking...</div>}
              </div>
              <div className="flex gap-2">
                <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') sendChat(); }} placeholder="Ask about this retreat..." className="min-w-0 flex-1 rounded-apple border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400" />
                <button type="button" onClick={() => sendChat()} disabled={loadingChat || !chatInput.trim()} className="inline-flex h-10 w-10 items-center justify-center rounded-apple bg-blue-600 text-white disabled:bg-gray-300">
                  <Icon icon={FiSend} className="h-4 w-4" />
                </button>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </div>
  );
};

const SummaryPanel: React.FC<{ analysis: RetreatReadinessAssistantResult | BookingReadinessAssistantResult | null; selectedBooking?: RetreatClient; mode: Mode }> = ({ analysis, selectedBooking, mode }) => {
  if (!analysis) {
    return <div className="flex min-h-[220px] flex-col items-center justify-center rounded-apple border border-gray-200 bg-white text-center text-gray-500"><Icon icon={FiCpu} className="mb-3 h-10 w-10 text-gray-300" /><div className="text-sm font-medium">Select {mode === 'retreat' ? 'a retreat' : 'a booking'} and ask a question.</div></div>;
  }
  const generatedBy = analysis.generatedBy === 'openai' ? `AI: ${analysis.model || 'OpenAI'}` : 'Rules fallback';
  return (
    <div className="rounded-apple border border-blue-100 bg-blue-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-blue-900">{mode === 'retreat' ? ((analysis as RetreatReadinessAssistantResult).retreat.code || (analysis as RetreatReadinessAssistantResult).retreat.name) : `Booking #${(analysis as BookingReadinessAssistantResult).booking.bookingNumber || selectedBooking?.bookingNumber || '-'}`}</div>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-700">{analysis.summary}</p>
        </div>
        <div className="rounded-apple border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800">{generatedBy}</div>
      </div>
      {analysis.aiUnavailableReason && <div className="mt-3 text-xs text-blue-800">AI note: {analysis.aiUnavailableReason}</div>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {mode === 'retreat' ? (
          <>
            <Metric label="Bookings" value={String((analysis as RetreatReadinessAssistantResult).metrics.totalBookings || 0)} />
            <Metric label="EKG" value={`${(analysis as RetreatReadinessAssistantResult).metrics.ekgReceivedCount || 0}/${(analysis as RetreatReadinessAssistantResult).metrics.totalBookings || 0}`} />
            <Metric label="Liver" value={`${(analysis as RetreatReadinessAssistantResult).metrics.liverReceivedCount || 0}/${(analysis as RetreatReadinessAssistantResult).metrics.totalBookings || 0}`} />
            <Metric label="Approved" value={`${(analysis as RetreatReadinessAssistantResult).metrics.medicalApprovedCount || 0}/${(analysis as RetreatReadinessAssistantResult).metrics.totalBookings || 0}`} />
          </>
        ) : (
          <>
            <Metric label="Steps" value={`${(analysis as BookingReadinessAssistantResult).metrics.completedSteps || 0}/${(analysis as BookingReadinessAssistantResult).metrics.totalSteps || 0}`} />
            <Metric label="Blocking" value={String((analysis as BookingReadinessAssistantResult).metrics.openBlockingSteps || 0)} />
            <Metric label="Overdue" value={String((analysis as BookingReadinessAssistantResult).metrics.overdueSteps || 0)} />
            <Metric label="Balance" value={formatMoney((analysis as BookingReadinessAssistantResult).booking.balanceDue, (analysis as BookingReadinessAssistantResult).booking.currency)} />
          </>
        )}
      </div>
    </div>
  );
};

const RetreatClientTable: React.FC<{ analysis: RetreatReadinessAssistantResult; onOpen: (link?: string) => void }> = ({ analysis, onOpen }) => (
  <div className="overflow-hidden rounded-apple border border-gray-200">
    <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900">Client-by-client readiness</div>
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2">Client</th>
            <th className="px-3 py-2">EKG</th>
            <th className="px-3 py-2">Liver</th>
            <th className="px-3 py-2">MRR</th>
            <th className="px-3 py-2">Approved</th>
            <th className="px-3 py-2">Missing</th>
            <th className="px-3 py-2">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {analysis.clients.map((row) => (
            <tr key={row.bookingId} className={row.severity === 'high' ? 'bg-red-50/50' : row.severity === 'medium' ? 'bg-amber-50/50' : 'bg-white'}>
              <td className="px-3 py-3">
                <button type="button" onClick={() => onOpen(row.bookingLink)} className="font-semibold text-blue-700 hover:underline">{row.clientName}</button>
                <div className="text-xs text-gray-500">Booking #{row.bookingNumber || '-'}</div>
              </td>
              <StatusCell ok={row.ekgReceived} />
              <StatusCell ok={row.liverReceived} />
              <StatusCell ok={row.medicalReviewSent} />
              <StatusCell ok={row.medicalApproved} />
              <td className="px-3 py-3 text-gray-700">{row.missingSteps.length ? row.missingSteps.join(', ') : '-'}</td>
              <td className="px-3 py-3">
                <button type="button" onClick={() => onOpen(row.bookingLink)} className="inline-flex items-center gap-1 rounded-apple border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                  {row.nextAction}<Icon icon={FiArrowRight} className="h-3 w-3" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const BookingDetails: React.FC<{ analysis: BookingReadinessAssistantResult; onOpen: (link?: string) => void }> = ({ analysis, onOpen }) => (
  <div className="space-y-5">
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Findings</h3>
      <div className="space-y-3">{analysis.findings.map((finding, index) => <FindingButton key={`${finding.title}-${index}`} finding={finding} onOpen={onOpen} />)}</div>
    </div>
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Suggested Next Actions</h3>
      <div className="grid gap-3 md:grid-cols-2">{analysis.suggestedActions.map((action, index) => <button key={`${action.label}-${index}`} type="button" onClick={() => onOpen(action.link)} className="rounded-apple border border-gray-200 bg-white p-4 text-left shadow-sm transition-colors hover:bg-gray-50"><div className="flex items-center justify-between gap-3"><div className="font-semibold text-gray-950">{action.label}</div><Icon icon={FiArrowRight} className="h-4 w-4 text-gray-400" /></div><div className="mt-2 text-sm text-gray-600">{action.reason}</div></button>)}</div>
    </div>
  </div>
);

const FindingButton: React.FC<{ finding: any; onOpen: (link?: string) => void }> = ({ finding, onOpen }) => (
  <button type="button" onClick={() => onOpen(finding.link)} className={`w-full rounded-apple border p-4 text-left ${severityClass[finding.severity] || severityClass.low}`}>
    <div className="flex items-start gap-3">
      {finding.severity === 'low' ? <Icon icon={FiCheckCircle} className="mt-0.5 h-5 w-5" /> : <Icon icon={FiAlertTriangle} className="mt-0.5 h-5 w-5" />}
      <div className="min-w-0 flex-1"><div className="font-semibold">{finding.title}</div><div className="mt-1 text-sm opacity-85">{finding.detail}</div></div>
      {finding.link && <Icon icon={FiArrowRight} className="mt-1 h-4 w-4 flex-shrink-0" />}
    </div>
  </button>
);

const StatusCell: React.FC<{ ok: boolean }> = ({ ok }) => (
  <td className="px-3 py-3">{ok ? <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">Yes</span> : <span className="inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">No</span>}</td>
);

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-apple border border-gray-200 bg-white/80 p-3">
    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
    <div className="mt-1 text-lg font-semibold text-gray-950">{value}</div>
  </div>
);

export default AssistantPage;
