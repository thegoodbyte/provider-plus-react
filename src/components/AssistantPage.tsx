import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAlertTriangle, FiArrowRight, FiCheckCircle, FiCpu, FiRefreshCw, FiSearch } from 'react-icons/fi';
import { assistantApi, bookingsApi, BookingReadinessAssistantResult } from '../services/api';
import { RetreatClient } from '../types';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon, className }) => (
  React.createElement(icon as any, { className })
);

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

const formatMoney = (amount?: number, currency?: string) => {
  if (typeof amount !== 'number') return '-';
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency || ''}`.trim();
};

const severityClass: Record<string, string> = {
  high: 'border-red-200 bg-red-50 text-red-950',
  medium: 'border-amber-200 bg-amber-50 text-amber-950',
  low: 'border-emerald-200 bg-emerald-50 text-emerald-950',
};

const AssistantPage: React.FC = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<RetreatClient[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<BookingReadinessAssistantResult | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoadingBookings(true);
    bookingsApi.getAll()
      .then((response) => {
        if (!mounted) return;
        const rows = response.data || [];
        setBookings(rows);
        const firstActive = rows.find((booking: any) => booking.status !== 'cancelled') || rows[0];
        if (firstActive?._id) setSelectedBookingId(firstActive._id);
      })
      .catch(() => {
        if (mounted) setError('Unable to load bookings.');
      })
      .finally(() => {
        if (mounted) setLoadingBookings(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filteredBookings = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return bookings.slice(0, 80);
    return bookings.filter((booking) => {
      const haystack = [
        booking.bookingNumber,
        getClientName(booking),
        getRetreatName(booking),
        (booking as any).clientId?.email,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    }).slice(0, 80);
  }, [bookings, searchTerm]);

  const selectedBooking = useMemo(
    () => bookings.find((booking) => booking._id === selectedBookingId),
    [bookings, selectedBookingId],
  );

  const runAnalysis = async () => {
    if (!selectedBookingId) return;
    setLoadingAnalysis(true);
    setError('');
    try {
      const response = await assistantApi.analyzeBookingReadiness(selectedBookingId);
      setAnalysis(response.data);
    } catch {
      setError('Unable to run assistant analysis.');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  useEffect(() => {
    if (selectedBookingId && !analysis && !loadingBookings) {
      runAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBookingId, loadingBookings]);

  const openLink = (link?: string) => {
    if (!link) return;
    navigate(link);
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 border-b border-gray-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-700">
            <Icon icon={FiCpu} className="h-4 w-4" />
            Assistant
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-gray-950">Booking Readiness Assistant</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            First version: reviews booking steps, payments, medical artifacts, and medical review requests.
          </p>
        </div>
        <button
          type="button"
          onClick={runAnalysis}
          disabled={!selectedBookingId || loadingAnalysis}
          className="inline-flex items-center justify-center gap-2 rounded-apple bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          <Icon icon={FiRefreshCw} className={`h-4 w-4 ${loadingAnalysis ? 'animate-spin' : ''}`} />
          Run Analysis
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-apple border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
          {error}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <section className="rounded-apple border border-gray-200 bg-white p-4 shadow-sm">
          <label className="mb-2 block text-sm font-semibold text-gray-900">Booking</label>
          <div className="mb-3 flex items-center gap-2 rounded-apple border border-gray-200 px-3 py-2">
            <Icon icon={FiSearch} className="h-4 w-4 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search booking, client, retreat"
              className="w-full border-0 bg-transparent text-sm outline-none"
            />
          </div>

          <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {loadingBookings ? (
              <div className="py-8 text-center text-sm text-gray-500">Loading bookings...</div>
            ) : filteredBookings.map((booking) => {
              const id = getObjectId(booking);
              const active = id === selectedBookingId;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setSelectedBookingId(id);
                    setAnalysis(null);
                  }}
                  className={`w-full rounded-apple border px-3 py-3 text-left transition-colors ${
                    active ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
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

        <section className="min-h-[560px] rounded-apple border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          {!analysis && loadingAnalysis && (
            <div className="flex min-h-[420px] items-center justify-center text-sm font-medium text-gray-500">
              Running assistant analysis...
            </div>
          )}

          {!analysis && !loadingAnalysis && (
            <div className="flex min-h-[420px] flex-col items-center justify-center text-center text-gray-500">
              <Icon icon={FiCpu} className="mb-3 h-10 w-10 text-gray-300" />
              <div className="text-sm font-medium">Select a booking and run analysis.</div>
            </div>
          )}

          {analysis && (
            <div className="space-y-5">
              <div className="rounded-apple border border-blue-100 bg-blue-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-blue-900">
                      Booking #{analysis.booking.bookingNumber || selectedBooking?.bookingNumber || '-'}
                    </div>
                    <h2 className="mt-1 text-xl font-semibold text-gray-950">{analysis.client.name || getClientName(selectedBooking as RetreatClient)}</h2>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-700">{analysis.summary}</p>
                  </div>
                  <div className="rounded-apple border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800">
                    {analysis.generatedBy === 'openai' ? `AI: ${analysis.model || 'OpenAI'}` : 'Rules fallback'}
                  </div>
                </div>
                {analysis.aiUnavailableReason && (
                  <div className="mt-3 text-xs text-blue-800">
                    AI note: {analysis.aiUnavailableReason}
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Steps" value={`${analysis.metrics.completedSteps || 0}/${analysis.metrics.totalSteps || 0}`} />
                <Metric label="Blocking" value={String(analysis.metrics.openBlockingSteps || 0)} />
                <Metric label="Overdue" value={String(analysis.metrics.overdueSteps || 0)} />
                <Metric label="Balance" value={formatMoney(analysis.booking.balanceDue, analysis.booking.currency)} />
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Findings</h3>
                <div className="space-y-3">
                  {analysis.findings.map((finding, index) => (
                    <button
                      key={`${finding.title}-${index}`}
                      type="button"
                      onClick={() => openLink(finding.link)}
                      className={`w-full rounded-apple border p-4 text-left ${severityClass[finding.severity] || severityClass.low}`}
                    >
                      <div className="flex items-start gap-3">
                        {finding.severity === 'low'
                          ? <Icon icon={FiCheckCircle} className="mt-0.5 h-5 w-5" />
                          : <Icon icon={FiAlertTriangle} className="mt-0.5 h-5 w-5" />}
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold">{finding.title}</div>
                          <div className="mt-1 text-sm opacity-85">{finding.detail}</div>
                        </div>
                        {finding.link && <Icon icon={FiArrowRight} className="mt-1 h-4 w-4 flex-shrink-0" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Suggested Next Actions</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {analysis.suggestedActions.length ? analysis.suggestedActions.map((action, index) => (
                    <button
                      key={`${action.label}-${index}`}
                      type="button"
                      onClick={() => openLink(action.link)}
                      className="rounded-apple border border-gray-200 bg-white p-4 text-left shadow-sm transition-colors hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-gray-950">{action.label}</div>
                        <Icon icon={FiArrowRight} className="h-4 w-4 text-gray-400" />
                      </div>
                      <div className="mt-2 text-sm text-gray-600">{action.reason}</div>
                    </button>
                  )) : (
                    <div className="rounded-apple border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                      No urgent next action found.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-apple border border-gray-200 bg-gray-50 p-3">
    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
    <div className="mt-1 text-lg font-semibold text-gray-950">{value}</div>
  </div>
);

export default AssistantPage;
