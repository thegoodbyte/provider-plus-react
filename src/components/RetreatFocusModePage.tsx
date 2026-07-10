import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileText,
  HeartPulse,
  RefreshCw,
  Settings2,
  Stethoscope,
  Users,
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import { helperAccessApi } from '../services/api';

type ClientSummary = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  display_id?: number;
};

type HelperBooking = {
  _id: string;
  bookingNumber?: number;
  clientId: ClientSummary;
  status?: string;
};

type HelperDashboard = {
  retreat?: {
    _id: string;
    name: string;
    code?: string;
    retreatCode?: string;
    startDate?: string;
    endDate?: string;
    location?: string;
  };
  bookings: HelperBooking[];
  records: Array<{ _id: string }>;
};

const getObjectId = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value._id || value.id || '';
};

const clientName = (client?: ClientSummary) => {
  const name = [client?.firstName, client?.lastName].filter(Boolean).join(' ').trim();
  return name || 'Participant';
};

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString();
};

const RetreatFocusModePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routePrefix = location.pathname.startsWith('/medical/') ? '/medical'
    : location.pathname.startsWith('/staff/') ? '/staff'
    : location.pathname.startsWith('/user/') ? '/user'
    : '/admin';

  const [dashboard, setDashboard] = useState<HelperDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await helperAccessApi.getCurrentRetreat();
      setDashboard(response.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load retreat focus mode.');
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const retreat = dashboard?.retreat;
  const bookings = dashboard?.bookings || [];
  const clients = useMemo(() => bookings.filter((booking) => getObjectId(booking.clientId)), [bookings]);

  const go = (path: string) => navigate(path);

  const getClientProfileRoute = (clientId: string) => {
    if (routePrefix === '/admin' || routePrefix === '/medical') return `${routePrefix}/medical/${clientId}`;
    return `${routePrefix}/clients/${clientId}`;
  };

  const getScreeningRoute = (clientId: string) => {
    if (routePrefix === '/admin') return `${routePrefix}/clients/${clientId}/screening`;
    return getClientProfileRoute(clientId);
  };

  const exitFocusMode = () => {
    localStorage.removeItem('appFocusMode');
    navigate(`${routePrefix}/launcher`);
  };

  if (loading && !dashboard) {
    return <LoadingSpinner message="Loading retreat focus mode..." />;
  }

  return (
    <div className="min-h-[calc(100vh-120px)] bg-white">
      <div className="border-b border-gray-200 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">In-retreat mode</div>
            <h1 className="truncate text-2xl font-semibold text-gray-900">
              {retreat ? (retreat.code || retreat.retreatCode || retreat.name) : 'Current retreat'}
            </h1>
            <p className="text-sm text-gray-600">
              {retreat
                ? `${formatDate(retreat.startDate)} - ${formatDate(retreat.endDate)}`
                : 'No current retreat found'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadDashboard}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={exitFocusMode}
              className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              <Settings2 className="h-4 w-4" />
              Exit retreat mode
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 text-sm text-red-700 sm:px-6 lg:px-8">
          {error}
        </div>
      )}

      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Clients', value: clients.length, icon: Users },
            { label: 'Records', value: dashboard?.records?.length || 0, icon: FileText },
            { label: 'Medical docs', value: clients.length, icon: HeartPulse },
            { label: 'Ceremonies', value: retreat ? 'Open' : '—', icon: CalendarDays },
          ].map((card) => (
            <div key={card.label} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{card.label}</div>
                  <div className="mt-1 text-2xl font-semibold text-gray-900">{card.value as any}</div>
                </div>
                <card.icon className="h-6 w-6 text-blue-700" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 px-4 pb-6 sm:px-6 lg:px-8 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Current clients</h2>
                <p className="text-sm text-gray-600">One card per participant. Keep this open in ceremony.</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {bookings.map((booking) => {
                const clientId = getObjectId(booking.clientId);
                return (
                  <div key={booking._id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Booking #{booking.bookingNumber || booking._id.slice(-6)}</div>
                        <div className="truncate text-lg font-semibold text-gray-900">{clientName(booking.clientId)}</div>
                        <div className="text-sm text-gray-600">{booking.clientId?.email || 'No email'}</div>
                      </div>
                      <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        {booking.status || 'active'}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {clientId && (
                        <button
                          type="button"
                          onClick={() => go(getClientProfileRoute(clientId))}
                          className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100"
                        >
                          <Users className="h-4 w-4" />
                          Profile
                        </button>
                      )}
                      {clientId && (
                        <button
                          type="button"
                          onClick={() => go(getScreeningRoute(clientId))}
                          className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                        >
                          <ClipboardList className="h-4 w-4" />
                          Screening
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => go(`${routePrefix}/bookings/${booking._id}`)}
                        className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                      >
                        <BookOpen className="h-4 w-4" />
                        Booking
                      </button>
                      {retreat?._id && (
                        <button
                          type="button"
                          onClick={() => go(`${routePrefix}/retreats/${retreat._id}`)}
                          className="inline-flex items-center justify-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100"
                        >
                          <CalendarDays className="h-4 w-4" />
                          Retreat
                        </button>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => go(`${routePrefix}/current-retreat`)}
                        className="inline-flex items-center justify-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
                      >
                        <Activity className="h-4 w-4" />
                        Record EKG / BP
                      </button>
                      {clientId && (
                        <button
                          type="button"
                          onClick={() => go(`${routePrefix}/medical-artifacts?clientId=${clientId}${retreat?._id ? `&retreatId=${retreat._id}` : ''}`)}
                          className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <FileText className="h-4 w-4" />
                          Docs & labs
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {bookings.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
                  No clients found for the current retreat.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-gray-900">Fast access</h2>
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                onClick={() => go(`${routePrefix}/retreats/${retreat?._id || ''}`)}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800 hover:bg-gray-100"
              >
                <CalendarDays className="h-4 w-4" />
                Retreat overview
              </button>
              <button
                type="button"
                onClick={() => go(`${routePrefix}/medical-tracking`)}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
              >
                <Stethoscope className="h-4 w-4" />
                Medical readiness
              </button>
              <button
                type="button"
                onClick={() => go(`${routePrefix}/medical-artifacts${retreat?._id ? `?retreatId=${retreat._id}` : ''}`)}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100"
              >
                <FileText className="h-4 w-4" />
                Medical docs and labs
              </button>
              <button
                type="button"
                onClick={() => go(`${routePrefix}/medical-review-requests`)}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-medium text-violet-700 hover:bg-violet-100"
              >
                <HeartPulse className="h-4 w-4" />
                Review requests
              </button>
              <button
                type="button"
                onClick={() => go(`${routePrefix}/retreats/${retreat?._id || ''}/ceremonies`)}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 hover:bg-amber-100"
              >
                <CalendarDays className="h-4 w-4" />
                Ceremony info
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RetreatFocusModePage;
