import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartHandshake } from 'lucide-react';
import { integrationApi, IntegrationRetreatSummary } from '../services/api';
import LoadingSpinner from './LoadingSpinner';

const CHECKPOINT_LABELS: Record<number, string> = { 1: 'Call 1 · week 1', 2: 'Call 2 · week 3', 3: 'Call 3 · week 5' };

const formatDate = (value?: string) => (value ? new Date(value).toISOString().slice(0, 10) : '—');

const IntegrationRetreatsPage: React.FC = () => {
  const navigate = useNavigate();
  const [retreats, setRetreats] = useState<IntegrationRetreatSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    integrationApi.listRetreats()
      .then((response) => { if (!cancelled) setRetreats(response.data); })
      .catch(() => { if (!cancelled) setRetreats([]); });
    return () => { cancelled = true; };
  }, []);

  if (!retreats) return <LoadingSpinner message="Loading integration retreats..." />;

  return (
    <section className="integration-retreats-shell">
      <header className="integration-retreats-hero">
        <span className="integration-retreats-icon"><HeartHandshake size={22} /></span>
        <div>
          <h2>Integration</h2>
          <p>Post-retreat follow-up calls, most recently finished retreat first.</p>
        </div>
      </header>

      {!retreats.length ? (
        <div className="integration-retreats-empty">No retreats found yet.</div>
      ) : (
        <div className="integration-retreats-list">
          {retreats.map((retreat) => (
            <button key={retreat.id} type="button" className="integration-retreat-card" onClick={() => navigate(`${retreat.id}`)}>
              <div className="integration-retreat-card-title">{retreat.name || 'Retreat'}</div>
              <div className="integration-retreat-card-dates">{formatDate(retreat.startDate)} – {formatDate(retreat.endDate)} · {retreat.totalClients} client{retreat.totalClients === 1 ? '' : 's'}</div>
              <div className="integration-retreat-card-checkpoints">
                {retreat.checkpoints.map((checkpoint) => (
                  <span key={checkpoint.checkpointNumber} className={checkpoint.reachedCount >= checkpoint.totalCount && checkpoint.totalCount > 0 ? 'complete' : ''}>
                    {CHECKPOINT_LABELS[checkpoint.checkpointNumber]} · {formatDate(checkpoint.targetDate)} · {checkpoint.reachedCount} / {checkpoint.totalCount}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

export default IntegrationRetreatsPage;
