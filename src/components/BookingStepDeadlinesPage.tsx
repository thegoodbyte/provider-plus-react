import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarClock, Filter, MapPin, RefreshCw, Search, User } from 'lucide-react';
import { bookingFlowApi } from '../services/api';
import { BookingFlowItem } from '../types';
import {
  BookingStepDeadlinesFilters,
  buildBookingStepDeadlineRows,
  filterBookingStepDeadlineRows,
  getBookingStepDeadlinesSummary,
} from './BookingStepDeadlinesPage.helpers';
import './BookingStepDeadlinesPage.css';

const getRoutePrefix = (pathname: string) => {
  if (pathname.startsWith('/medical/')) return '/medical';
  if (pathname.startsWith('/staff/')) return '/staff';
  if (pathname.startsWith('/user/')) return '/user';
  if (pathname.startsWith('/admin/')) return '/admin';
  return '';
};

const formatCompactStatus = (status: string) => {
  const value = status.replace(/_/g, ' ').trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Pending';
};

const BookingStepDeadlinesPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const routePrefix = useMemo(() => getRoutePrefix(location.pathname), [location.pathname]);
  const [items, setItems] = useState<BookingFlowItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<BookingStepDeadlinesFilters>({
    search: '',
    retreatId: '',
    stepKey: '',
    dateFrom: '',
    dateTo: '',
  });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await bookingFlowApi.getItems({});
        if (mounted) {
          setItems(response.data || []);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load booking step deadlines');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const rows = useMemo(() => buildBookingStepDeadlineRows(items), [items]);

  const retreatOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((row) => {
      if (row.retreatId && !map.has(row.retreatId)) {
        map.set(row.retreatId, row.retreatLabel);
      }
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [rows]);

  const stepOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((row) => {
      if (row.stepKey && !map.has(row.stepKey)) {
        map.set(row.stepKey, row.stepTitle);
      }
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [rows]);

  const filteredRows = useMemo(() => filterBookingStepDeadlineRows(rows, filters), [rows, filters]);
  const summary = useMemo(() => getBookingStepDeadlinesSummary(filteredRows), [filteredRows]);

  const bookingLink = (bookingId: string) => `${routePrefix}/bookings/${bookingId}`;
  const retreatLink = (retreatId: string) => `${routePrefix}/retreats/${retreatId}`;

  const updateFilter = (field: keyof BookingStepDeadlinesFilters, value: string) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      retreatId: '',
      stepKey: '',
      dateFrom: '',
      dateTo: '',
    });
  };

  return (
    <div className="booking-step-deadlines-page">
      <div className="booking-step-deadlines-header">
        <div>
          <div className="booking-step-deadlines-eyebrow">Global operations</div>
          <h1>Booking Step Deadlines</h1>
          <p>All booking-step deadlines across every retreat in one searchable grid.</p>
        </div>

        <button type="button" className="deadline-refresh-btn" onClick={() => window.location.reload()}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="booking-step-deadlines-summary">
        <div className="summary-card">
          <span className="summary-value">{summary.total}</span>
          <span className="summary-label">Deadlines</span>
        </div>
        <div className="summary-card">
          <span className="summary-value">{summary.dueSoon}</span>
          <span className="summary-label">Due soon</span>
        </div>
        <div className="summary-card">
          <span className="summary-value">{summary.overdue}</span>
          <span className="summary-label">Overdue</span>
        </div>
        <div className="summary-card">
          <span className="summary-value">{summary.retreats}</span>
          <span className="summary-label">Retreats</span>
        </div>
      </div>

      <div className="booking-step-deadlines-filters">
        <label className="deadline-search">
          <Search size={16} />
          <input
            type="search"
            placeholder="Search retreat, step, client, booking, notes..."
            value={filters.search}
            onChange={(event) => updateFilter('search', event.target.value)}
          />
        </label>

        <label className="deadline-field">
          <span className="deadline-field-label">Retreat</span>
          <select value={filters.retreatId} onChange={(event) => updateFilter('retreatId', event.target.value)}>
            <option value="">All retreats</option>
            {retreatOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="deadline-field">
          <span className="deadline-field-label">Booking step</span>
          <select value={filters.stepKey} onChange={(event) => updateFilter('stepKey', event.target.value)}>
            <option value="">All steps</option>
            {stepOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="deadline-field">
          <span className="deadline-field-label">From</span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(event) => updateFilter('dateFrom', event.target.value)}
          />
        </label>

        <label className="deadline-field">
          <span className="deadline-field-label">To</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(event) => updateFilter('dateTo', event.target.value)}
          />
        </label>

        <button type="button" className="deadline-clear-btn" onClick={resetFilters}>
          <Filter size={16} />
          Clear filters
        </button>
      </div>

      {error && (
        <div className="deadline-error" role="alert">
          {error}
        </div>
      )}

      <div className="booking-step-deadlines-table-shell">
        {loading ? (
          <div className="deadline-loading">Loading deadlines...</div>
        ) : (
          <table className="booking-step-deadlines-table">
            <thead>
              <tr>
                <th className="deadline-col-index">#</th>
                <th className="deadline-col-date"><CalendarClock size={14} /> Date</th>
                <th>Booking step</th>
                <th>Retreat</th>
                <th>Booking</th>
                <th>Client</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="deadline-empty">
                    No deadlines match these filters.
                  </td>
                </tr>
              ) : filteredRows.map((row, visibleIndex) => (
                <tr key={row.id}>
                  <td className="deadline-col-index">{visibleIndex + 1}</td>
                  <td className="deadline-col-date">
                    <div className="deadline-date">{row.dueDateLabel}</div>
                    {row.dueDateKey && <div className="deadline-date-key">{row.dueDateKey}</div>}
                  </td>
                  <td>
                    <div className="deadline-step">
                      <span className="deadline-step-title">{row.stepTitle}</span>
                      <span className="deadline-step-meta">{row.stepKey}</span>
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="deadline-link-button"
                      onClick={() => row.retreatId && navigate(retreatLink(row.retreatId))}
                      disabled={!row.retreatId}
                    >
                      <MapPin size={14} />
                      <span>{row.retreatLabel}</span>
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="deadline-link-button"
                      onClick={() => row.bookingId && navigate(bookingLink(row.bookingId))}
                      disabled={!row.bookingId}
                    >
                      <ArrowRight size={14} />
                      <span>{row.bookingLabel}</span>
                    </button>
                  </td>
                  <td>
                    <div className="deadline-client">
                      <User size={14} />
                      <span>{row.clientLabel}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`deadline-status deadline-status-${row.status.replace(/_/g, '-')}`}>
                      {formatCompactStatus(row.status)}
                    </span>
                  </td>
                  <td>
                    <div className="deadline-notes">{row.notes || '—'}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default BookingStepDeadlinesPage;
