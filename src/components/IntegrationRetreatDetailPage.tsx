import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronUp, HeartHandshake } from 'lucide-react';
import { integrationApi, IntegrationCheckpointDetail, IntegrationTile } from '../services/api';
import LoadingSpinner from './LoadingSpinner';

const CHECKPOINT_NUMBERS = [1, 2, 3];
const CHECKPOINT_TAB_LABELS: Record<number, string> = { 1: 'Call 1', 2: 'Call 2', 3: 'Call 3' };

const toDateInputValue = (value?: string) => (value ? new Date(value).toISOString().slice(0, 10) : '');
const toDateTimeInputValue = (value?: string) => (value ? new Date(value).toISOString().slice(0, 16) : '');

const IntegrationRetreatDetailPage: React.FC = () => {
  const { retreatId } = useParams();
  const navigate = useNavigate();
  const [checkpointNumber, setCheckpointNumber] = useState(1);
  const [detail, setDetail] = useState<IntegrationCheckpointDetail | null>(null);
  // Tiles default to expanded -- typing the answers straight onto each
  // client's tile is the primary workflow here, not something to unlock
  // with an extra click. Collapsing is just for tidying up a finished tile.
  const [collapsedTileIds, setCollapsedTileIds] = useState<Set<string>>(new Set());

  const fetchDetail = useCallback(async () => {
    if (!retreatId) return;
    const response = await integrationApi.getCheckpointDetail(retreatId, checkpointNumber);
    setDetail(response.data);
  }, [retreatId, checkpointNumber]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const saveCheckpoint = async (updates: { targetDate?: string; notes?: string }) => {
    if (!retreatId) return;
    await integrationApi.updateCheckpoint(retreatId, checkpointNumber, updates);
  };

  const saveResponse = async (responseId: string, updates: Parameters<typeof integrationApi.updateResponse>[1]) => {
    await integrationApi.updateResponse(responseId, updates);
    setDetail((current) => {
      if (!current) return current;
      return {
        ...current,
        tiles: current.tiles.map((tile) => (tile.responseId === responseId ? { ...tile, ...updates } as IntegrationTile : tile)),
      };
    });
  };

  if (!detail) return <LoadingSpinner message="Loading integration calls..." />;

  return (
    <section className="integration-detail-shell">
      <header className="integration-detail-hero">
        <span className="integration-retreats-icon"><HeartHandshake size={22} /></span>
        <div>
          <h2>{detail.retreat.name || 'Retreat'}</h2>
          <p>Integration calls</p>
        </div>
      </header>

      <div className="integration-checkpoint-tabs" role="tablist">
        {CHECKPOINT_NUMBERS.map((number) => (
          <button
            key={number}
            type="button"
            role="tab"
            aria-selected={checkpointNumber === number}
            className={checkpointNumber === number ? 'active' : ''}
            onClick={() => setCheckpointNumber(number)}
          >
            {CHECKPOINT_TAB_LABELS[number]}
          </button>
        ))}
      </div>

      <div className="integration-checkpoint-config">
        <label>
          Target date
          <input
            type="date"
            aria-label="Target date"
            defaultValue={toDateInputValue(detail.checkpoint.targetDate)}
            onBlur={(event) => { if (event.target.value) saveCheckpoint({ targetDate: event.target.value }); }}
          />
        </label>
        <label className="integration-session-notes">
          Session notes
          <textarea
            aria-label="Session notes"
            defaultValue={detail.checkpoint.notes || ''}
            onBlur={(event) => saveCheckpoint({ notes: event.target.value })}
            placeholder="Notes about this call session as a whole..."
          />
        </label>
      </div>

      <div className="integration-tiles">
        {detail.tiles.map((tile) => {
          const expanded = !collapsedTileIds.has(tile.responseId);
          const toggleExpanded = () => setCollapsedTileIds((current) => {
            const next = new Set(current);
            if (next.has(tile.responseId)) next.delete(tile.responseId); else next.add(tile.responseId);
            return next;
          });
          return (
            <article key={tile.responseId} className={`integration-tile status-${tile.status}`}>
              <header>
                <button type="button" className="integration-tile-name" onClick={() => (tile.clientLink ? navigate(tile.clientLink) : undefined)}>{tile.clientName}</button>
                <div className="integration-tile-controls">
                  <label>
                    Call type
                    <select
                      aria-label="Call type"
                      value={tile.callType}
                      onChange={(event) => saveResponse(tile.responseId, { callType: event.target.value as 'group' | 'individual' })}
                    >
                      <option value="group">Group</option>
                      <option value="individual">Individual (1:1)</option>
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      aria-label="Status"
                      value={tile.status}
                      onChange={(event) => saveResponse(tile.responseId, { status: event.target.value })}
                    >
                      <option value="not_reached">Not reached</option>
                      <option value="reached">Reached</option>
                      <option value="no_show">No-show</option>
                      <option value="rescheduled">Rescheduled</option>
                    </select>
                  </label>
                  {tile.callType === 'individual' && (
                    <label>
                      Scheduled for
                      <input
                        type="datetime-local"
                        aria-label="Scheduled for"
                        defaultValue={toDateTimeInputValue(tile.scheduledAt)}
                        onBlur={(event) => { if (event.target.value) saveResponse(tile.responseId, { scheduledAt: event.target.value }); }}
                      />
                    </label>
                  )}
                  <button type="button" className="integration-tile-toggle" onClick={toggleExpanded} aria-label={expanded ? 'Collapse' : 'Expand'}>
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </header>

              {tile.reachedAt && <div className="integration-tile-reached">Reached {new Date(tile.reachedAt).toLocaleString()}</div>}

              {expanded && (
                <div className="integration-tile-body">
                  {detail.questions.map((question) => (
                    <label key={question.key} className="integration-tile-question">
                      {question.label}
                      <textarea
                        defaultValue={tile.answers[question.key] || ''}
                        onBlur={(event) => saveResponse(tile.responseId, { answers: { [question.key]: event.target.value } })}
                      />
                    </label>
                  ))}
                  <label className="integration-tile-question">
                    Notes
                    <textarea
                      defaultValue={tile.notes || ''}
                      onBlur={(event) => saveResponse(tile.responseId, { notes: event.target.value })}
                      placeholder="Anything else worth remembering about this client's call..."
                    />
                  </label>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default IntegrationRetreatDetailPage;
