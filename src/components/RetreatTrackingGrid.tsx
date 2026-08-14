import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, HeartPulse, Leaf, RefreshCw } from 'lucide-react';
import { Modal } from 'antd';
import { bookingsApi, medicalArtifactsApi, medicalReviewRequestsApi } from '../services/api';
import { Retreat, RetreatClient } from '../types';
import LoadingSpinner from './LoadingSpinner';
import {
  buildRetreatMedicalGridData,
  RetreatMedicalCell,
  RetreatMedicalGridData,
  RetreatMedicalRow,
} from './RetreatMedicalGrid.helpers';
import './RetreatTrackingGrid.css';

interface RetreatTrackingGridProps {
  retreatId: string;
}

const getClientInitials = (name: string) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
};

const getLocationPrefix = (pathname: string) => {
  const firstRouteSegment = pathname.split('/').filter(Boolean)[0];
  return ['admin', 'medical', 'staff', 'user', 'helper'].includes(firstRouteSegment) ? firstRouteSegment : 'admin';
};

const getStageIcon = (stageKey: RetreatMedicalRow['key']) => {
  if (stageKey === 'ekg') return <HeartPulse className="h-4 w-4" />;
  if (stageKey === 'liver') return <Leaf className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
};

const getStageToneClass = (cell: RetreatMedicalCell) => {
  if (cell.status === 'missing') return 'medical-cell-missing';
  if (cell.status === 'artifact_only') return 'medical-cell-artifact';
  if (cell.decisionTone === 'green') return 'medical-cell-green';
  if (cell.decisionTone === 'yellow') return 'medical-cell-yellow';
  if (cell.decisionTone === 'red') return 'medical-cell-red';
  return 'medical-cell-neutral';
};

const getStageStatusLabel = (cell: RetreatMedicalCell) => {
  if (cell.status === 'missing') return 'Missing';
  if (cell.status === 'artifact_only') return 'Artifact only';
  if (cell.status === 'pending') return cell.decisionLabel || 'Pending';
  return cell.decisionLabel || 'Reviewed';
};

const getCellNotes = (cell: RetreatMedicalCell) => {
  if (cell.notes && cell.notes.trim()) return cell.notes.trim();
  return 'No notes yet.';
};

const RetreatTrackingGrid: React.FC<RetreatTrackingGridProps> = ({ retreatId }) => {
  const location = useLocation();
  const routePrefix = getLocationPrefix(location.pathname);
  const [gridData, setGridData] = useState<RetreatMedicalGridData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retreat, setRetreat] = useState<Retreat | null>(null);
  const [historyView, setHistoryView] = useState<{ cell: RetreatMedicalCell; clientName: string; stage: string } | null>(null);

  const fetchGridData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [bookingsResponse, artifactsResponse, reviewsResponse] = await Promise.all([
        bookingsApi.getByRetreatWithDetails(retreatId),
        medicalArtifactsApi.getAll({ retreatId }),
        medicalReviewRequestsApi.getAll({ retreatId }),
      ]);

      const bookings = (bookingsResponse.data || []) as RetreatClient[];
      const retreatFromBookings = bookings
        .map((booking: any) => booking.retreatId)
        .find((value) => value && typeof value === 'object') as Retreat | undefined;

      setRetreat(retreatFromBookings || null);
      setGridData(
        buildRetreatMedicalGridData(
          bookings,
          artifactsResponse.data || [],
          reviewsResponse.data || [],
          retreatFromBookings || { retreatCode: retreatId, code: retreatId, name: retreatId },
        ),
      );
    } catch (error) {
      console.error('Error fetching retreat medical grid:', error);
      setGridData(null);
      setRetreat(null);
    } finally {
      setIsLoading(false);
    }
  }, [retreatId]);

  useEffect(() => {
    fetchGridData();
  }, [fetchGridData]);

  const summaryCards = useMemo(() => {
    if (!gridData) return [];

    const reviewed = gridData.rows.reduce((sum, row) => sum + row.cells.filter((cell) => cell.status === 'reviewed').length, 0);
    const pending = gridData.rows.reduce((sum, row) => sum + row.cells.filter((cell) => cell.status === 'pending').length, 0);
    const missing = gridData.rows.reduce((sum, row) => sum + row.cells.filter((cell) => cell.status === 'missing').length, 0);

    return [
      { label: 'Clients', value: gridData.totals.clients },
      { label: 'MRRs', value: reviewed },
      { label: 'Pending', value: pending },
      { label: 'Missing', value: missing },
    ];
  }, [gridData]);

  const renderCell = (stageKey: RetreatMedicalRow['key'], cell: RetreatMedicalCell, client: any, clientIndex: number) => {
    const bookingId = client.bookingId || '';
    const clientId = client.clientId || '';
    const artifactId = cell.artifact?._id || '';
    const reviewId = cell.review?._id || '';
    const toneClass = getStageToneClass(cell);
    const notes = getCellNotes(cell);

    return (
      <div className={`medical-cell ${toneClass}`}>
        <div className="medical-cell-top">
          <div className="medical-cell-title">
            {reviewId ? (
              <Link to={`/${routePrefix}/medical-review-requests/${reviewId}`} className="medical-cell-link">
                {cell.reviewLabel}
              </Link>
            ) : (
              <span className="medical-cell-empty">No MRR yet</span>
            )}
          </div>
          <span className={`medical-status-pill ${toneClass}`}>{getStageStatusLabel(cell)}</span>
        </div>

        <div className="medical-cell-subline">
          Submitted {cell.submittedAt || '—'}
        </div>

        <div className="medical-cell-notes" title={notes}>
          {notes}
        </div>

        <div className="medical-cell-links">
          {!reviewId && artifactId ? (
            <Link
              to={`/${routePrefix}/medical-review-requests/new?artifactId=${encodeURIComponent(artifactId)}`}
              className="medical-cell-create-mrr"
              aria-label={`Create MRR for ${client.clientName} ${stageKey}`}
            >
              Create MRR
            </Link>
          ) : null}
          {artifactId ? (
            <Link to={`/${routePrefix}/medical-artifacts/${artifactId}`} className="medical-cell-mini-link">
              Artifact #{cell.artifact?.display_id || artifactId.slice(-6)}
            </Link>
          ) : (
            <span className="medical-cell-mini-muted">Upload an artifact before creating an MRR</span>
          )}
          {clientId ? (
            <Link to={`/${routePrefix}/bookings/${bookingId}`} className="medical-cell-mini-link">
              Booking #{client.bookingNumber || bookingId.slice(-6)}
            </Link>
          ) : null}
          {(cell.reviews.length > 1 || cell.artifacts.length > 1) && (
            <button
              type="button"
              className="medical-cell-mini-link"
              onClick={() => setHistoryView({ cell, clientName: client.clientName, stage: stageKey.toUpperCase() })}
            >
              {cell.reviews.length} MRR{cell.reviews.length === 1 ? '' : 's'} · {cell.artifacts.length} artifact{cell.artifacts.length === 1 ? '' : 's'}
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderClientHeader = (client: any, index: number) => {
    const displayId = client.clientDisplayId ? `#${client.clientDisplayId}` : '';
    const initials = getClientInitials(client.clientName);

    return (
      <th key={client.clientId || client.bookingId || index} className={`medical-client-header medical-client-header-${index % 6}`}>
        <div className="medical-client-header-inner">
          <div className="medical-client-avatar" aria-hidden="true">
            {initials}
          </div>
          <div className="medical-client-meta">
            <Link to={`/${routePrefix}/clients/${client.clientId}`} className="medical-client-name">
              {client.clientName}
            </Link>
            <Link to={`/${routePrefix}/bookings/${client.bookingId}`} className="medical-client-booking">
              Booking #{client.bookingNumber}
            </Link>
            {displayId ? (
              <Link to={`/${routePrefix}/clients/${client.clientId}`} className="medical-client-id">
                Client {displayId}
              </Link>
            ) : null}
          </div>
        </div>
      </th>
    );
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading medical grid..." />;
  }

  if (!gridData || gridData.clients.length === 0) {
    return (
      <div className="retreat-medical-grid">
        <div className="medical-grid-empty">
          No bookings found for this retreat yet.
        </div>
      </div>
    );
  }

  return (
    <div className="retreat-medical-grid">
      <Modal
        title={historyView ? `${historyView.clientName} · ${historyView.stage} history` : 'Medical history'}
        open={Boolean(historyView)}
        onCancel={() => setHistoryView(null)}
        footer={null}
        width={760}
      >
        {historyView && (
          <div className="space-y-5">
            <div>
              <h4 className="mb-2 font-semibold text-gray-900">Medical review iterations ({historyView.cell.reviews.length})</h4>
              <div className="space-y-2">
                {historyView.cell.reviews.map((review, index) => (
                  <div key={review._id || index} className={`rounded-lg border p-3 ${index === 0 ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link to={`/${routePrefix}/medical-review-requests/${review._id}`} className="font-semibold text-blue-700 hover:underline">
                        MRR #{review.display_id || review._id?.slice(-6)}
                      </Link>
                      <span className="text-xs font-semibold uppercase text-gray-500">{index === 0 ? 'Latest' : `Previous ${index}`}</span>
                    </div>
                    <div className="mt-1 text-sm text-gray-700">{review.reviewDecision || review.decision || review.status || 'Pending'}</div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{review.reviewNotes || review.overallNotes || review.medicalStaffNotes || 'No review notes.'}</div>
                  </div>
                ))}
                {historyView.cell.reviews.length === 0 && <div className="text-sm text-gray-500">No MRRs.</div>}
              </div>
            </div>
            <div>
              <h4 className="mb-2 font-semibold text-gray-900">Artifacts ({historyView.cell.artifacts.length})</h4>
              <div className="flex flex-wrap gap-2">
                {historyView.cell.artifacts.map((artifact, index) => (
                  <Link key={artifact._id || index} to={`/${routePrefix}/medical-artifacts/${artifact._id}`} className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">
                    Artifact #{artifact.display_id || artifact._id?.slice(-6)}{index === 0 ? ' · latest' : ''}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
      <div className="medical-grid-header">
        <div>
          <h3>
            Medical Grid {gridData.retreatCode || retreat?.retreatCode || retreat?.code || retreatId}
          </h3>
          <p>
            EKG, liver, and medication-form review requests with linked artifacts, MRR numbers, submitted dates, decisions, and notes.
          </p>
        </div>
        <button type="button" onClick={fetchGridData} className="medical-grid-refresh-btn">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="medical-grid-summary">
        {summaryCards.map((card) => (
          <div key={card.label} className="medical-grid-summary-card">
            <div className="medical-grid-summary-value">{card.value}</div>
            <div className="medical-grid-summary-label">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="medical-grid-desktop">
        <div className="medical-grid-table-wrap">
          <table className="medical-grid-table">
            <thead>
              <tr>
                <th className="medical-row-header">Stage</th>
                {gridData.clients.map((client, index) => renderClientHeader(client, index))}
              </tr>
            </thead>
            <tbody>
              {gridData.rows.map((row) => (
                <tr key={row.key} className={`medical-row ${row.accentClass}`}>
                  <td className="medical-row-label">
                    <div className="medical-row-label-inner">
                      <span className="medical-row-icon">{getStageIcon(row.key)}</span>
                      <div>
                        <div className="medical-row-title">{row.label}</div>
                        <div className="medical-row-subtitle">MRR · submitted · result · notes</div>
                      </div>
                    </div>
                  </td>
                  {row.cells.map((cell, index) => (
                    <td key={`${row.key}-${gridData.clients[index].bookingId}`} className="medical-grid-cell-td">
                      {renderCell(row.key, cell, gridData.clients[index], index)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="medical-grid-mobile">
        {gridData.clients.map((client, clientIndex) => (
          <article key={client.bookingId} className={`medical-mobile-card medical-client-header-${clientIndex % 6}`}>
            <div className="medical-mobile-card-header">
              <div className="medical-client-avatar" aria-hidden="true">
                {getClientInitials(client.clientName)}
              </div>
              <div className="medical-mobile-card-meta">
                <Link to={`/${routePrefix}/clients/${client.clientId}`} className="medical-client-name">
                  {client.clientName}
                </Link>
                <Link to={`/${routePrefix}/bookings/${client.bookingId}`} className="medical-client-booking">
                  Booking #{client.bookingNumber}
                </Link>
                <span className="medical-client-id">
                  {client.clientDisplayId ? `Client #${client.clientDisplayId}` : client.clientId.slice(-6)}
                </span>
              </div>
            </div>

            <div className="medical-mobile-stage-stack">
              {gridData.rows.map((row) => {
                const cell = row.cells[clientIndex];
                return (
                  <section key={`${client.bookingId}-${row.key}`} className="medical-mobile-stage">
                    <div className="medical-mobile-stage-header">
                      <span className="medical-row-icon">{getStageIcon(row.key)}</span>
                      <span>{row.label}</span>
                    </div>
                    {renderCell(row.key, cell, client, clientIndex)}
                  </section>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default RetreatTrackingGrid;
