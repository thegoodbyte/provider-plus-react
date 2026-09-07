import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import LoadingSpinner from './LoadingSpinner';
import { bookingsApi } from '../services/api';
import { buildBookingPriceTimeline, BookingTimelineSource } from './bookingPriceTimeline';
import './AnalyticsPage.css';

const usd = (value: number) => `$${Math.round(value).toLocaleString()}`;

const AnalyticsPage: React.FC = () => {
  const [bookings, setBookings] = useState<BookingTimelineSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeCancelled, setIncludeCancelled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await bookingsApi.getAll();
        if (!cancelled) setBookings(response.data || []);
      } catch (err) {
        console.error('Error loading bookings for analytics:', err);
        if (!cancelled) setError('Could not load booking data. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const timeline = useMemo(
    () => buildBookingPriceTimeline(bookings, { includeCancelled }),
    [bookings, includeCancelled]
  );

  if (loading) {
    return <LoadingSpinner message="Loading booking analytics..." />;
  }

  return (
    <div className="analytics-page">
      <header className="analytics-header">
        <div>
          <h1>Booking Price Timeline</h1>
          <p>When clients book, plotted against price, so you can spot correlation between pricing and booking volume over time.</p>
        </div>
        <label className="analytics-toggle">
          <input
            type="checkbox"
            checked={includeCancelled}
            onChange={(e) => setIncludeCancelled(e.target.checked)}
          />
          Include cancelled bookings
        </label>
      </header>

      {error && <div className="analytics-error">{error}</div>}

      <div className="analytics-summary">
        <div>
          <strong>{timeline.includedCount}</strong>
          <span>Bookings plotted</span>
        </div>
        <div>
          <strong>{timeline.buckets.length}</strong>
          <span>Months covered</span>
        </div>
        <div>
          <strong>{timeline.excludedMissingPrice}</strong>
          <span>Missing a USD price (pending backfill)</span>
        </div>
        <div>
          <strong>{timeline.excludedMissingDate}</strong>
          <span>Missing a booking date</span>
        </div>
      </div>

      {timeline.buckets.length === 0 ? (
        <div className="analytics-empty">
          <p>No bookings with both a date and a USD-normalized price yet. Once historical bookings are backfilled, this chart will populate automatically.</p>
        </div>
      ) : (
        <div className="analytics-chart">
          <ResponsiveContainer width="100%" height={420}>
            <ComposedChart data={timeline.buckets} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="count" allowDecimals={false} tick={{ fontSize: 12 }} label={{ value: 'Bookings', angle: -90, position: 'insideLeft', fontSize: 12 }} />
              <YAxis yAxisId="price" orientation="right" tickFormatter={usd} tick={{ fontSize: 12 }} label={{ value: 'Price (USD)', angle: 90, position: 'insideRight', fontSize: 12 }} />
              <Tooltip
                formatter={(value: any, name?: string) => (name === 'Avg price (USD)' || name === 'Booking price' ? usd(Number(value)) : value)}
              />
              <Bar yAxisId="count" dataKey="count" name="Bookings" fill="#c7d2fe" radius={[4, 4, 0, 0]} />
              <Scatter yAxisId="price" data={timeline.points} dataKey="priceUsd" name="Booking price" fill="#2563eb" fillOpacity={0.45} />
              <Line yAxisId="price" dataKey="avgPriceUsd" name="Avg price (USD)" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
