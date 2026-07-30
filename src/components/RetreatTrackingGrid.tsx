import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Modal } from 'antd';
import { RefreshCw } from 'lucide-react';
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

type SelectedCell = {
  cell: RetreatMedicalCell;
  client: RetreatMedicalGridData['clients'][number];
  row: RetreatMedicalRow;
};

const getClientInitials = (name: string) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
};

const getLocationPrefix = (pathname: string) => {
  const firstRouteSegment = pathname.split('/').filter(Boolean)[0];
  return ['admin', 'medical', 'staff', 'user', 'helper'].includes(firstRouteSegment)
    ? firstRouteSegment
    : 'admin';
};

const getToneClass = (cell: RetreatMedicalCell) => {
  if (cell.status === 'missing') return 'medical-cell-missing';
  if (cell.status === 'artifact_only') return 'medical-cell-artifact';
  if (cell.decisionTone === 'green') return 'medical-cell-green';
  if (cell.decisionTone === 'yellow') return 'medical-cell-yellow';
  if (cell.decisionTone === 'red') return 'medical-cell-red';
  return 'medical-cell-neutral';
};

const getStatusLabel = (cell: RetreatMedicalCell) => {
  if (cell.status === 'missing') return 'Missing';
  if (cell.status === 'artifact_only') return 'Artifact only';
  if (cell.status === 'pending') return cell.decisionLabel || 'Pending';
  if (cell.decisionLabel === 'OK') return 'Approved';
  return cell.decisionLabel || 'Reviewed';
};

const getDisplayId = (record?: { _id?: string; display_id?: number } | null) =>
  record?.display_id || record?._id?.slice(-6) || '';

const RetreatTrackingGrid: React.FC<RetreatTrackingGridProps> = ({ retreatId }) => {
  const location = useLocation();
  const routePrefix = getLocationPrefix(location.pathname);
  const [gridData, setGridData] = useState<RetreatMedicalGridData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<SelectedCell | null>(null);
  const [historyView, setHistoryView] = useState<SelectedCell | null>(null);

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
      const nextGrid = buildRetreatMedicalGridData(
        bookings,
        artifactsResponse.data || [],
        reviewsResponse.data || [],
        retreatFromBookings || { retreatCode: retreatId, code: retreatId, name: retreatId },
      );

      setGridData(nextGrid);
    } catch (error) {
      console.error('Error fetching retreat medical grid:', error);
      setGridData(null);
    } finally {
      setIsLoading(false);
    }
  }, [retreatId]);

  useEffect(() => {
    fetchGridData();
  }, [fetchGridData]);

  useEffect(() => {
    if (!gridData?.clients.length || !gridData.rows.length) {
      setSelected(null);
      return;
    }

    const currentStillExists = selected && gridData.clients.some((client, clientIndex) =>
      client.bookingId === selected.client.bookingId
      && gridData.rows.some((row) =>
        row.key === selected.row.key && row.cells[clientIndex]?.review?._id === selected.cell.review?._id));
    if (currentStillExists) return;

    for (let clientIndex = 0; clientIndex < gridData.clients.length; clientIndex += 1) {
      const row = gridData.rows.find((candidate) => candidate.cells[clientIndex]?.review || candidate.cells[clientIndex]?.artifact);
      if (row) {
        setSelected({ cell: row.cells[clientIndex], client: gridData.clients[clientIndex], row });
        return;
      }
    }
    setSelected({ cell: gridData.rows[0].cells[0], client: gridData.clients[0], row: gridData.rows[0] });
  }, [gridData, selected]);

  const summary = useMemo(() => {
    if (!gridData) return { clients: 0, reviews: 0, pending: 0, missing: 0 };
    const reviewIds = new Set<string>();
    let pending = 0;
    let missing = 0;
    gridData.rows.forEach((row) => row.cells.forEach((cell) => {
      cell.reviews.forEach((review) => reviewIds.add(review._id || String(review.display_id)));
      if (cell.status === 'pending') pending += 1;
      if (cell.status === 'missing') missing += 1;
    }));
    return { clients: gridData.totals.clients, reviews: reviewIds.size, pending, missing };
  }, [gridData]);

  if (isLoading) return <LoadingSpinner message="Loading medical grid..." />;

  if (!gridData || gridData.clients.length === 0) {
    return <div className="medical-grid-empty">No bookings found for this retreat yet.</div>;
  }

  const renderCompactCell = (
    cell: RetreatMedicalCell,
    client: RetreatMedicalGridData['clients'][number],
    row: RetreatMedicalRow,
  ) => {
    const isSelected = selected?.client.bookingId === client.bookingId
      && selected?.row.key === row.key;
    const identifier = cell.review
      ? `MRR #${getDisplayId(cell.review)}`
      : cell.artifact
        ? `#${getDisplayId(cell.artifact)}`
        : '';

    return (
      <button
        type="button"
        className={`medical-matrix-cell ${getToneClass(cell)} ${isSelected ? 'is-selected' : ''}`}
        onClick={() => setSelected({ cell, client, row })}
        aria-pressed={isSelected}
      >
        <span className="medical-matrix-status">
          <span className="medical-status-dot" />
          {getStatusLabel(cell)}
        </span>
        {identifier && <span className="medical-matrix-id">{identifier}</span>}
        {(cell.reviews.length > 1 || cell.artifacts.length > 1) && (
          <span className="medical-matrix-history-count">
            {cell.reviews.length} reviews · {cell.artifacts.length} files
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="retreat-medical-grid">
      <Modal
        title={historyView ? `${historyView.client.clientName} · ${historyView.row.label} history` : 'Medical history'}
        open={Boolean(historyView)}
        onCancel={() => setHistoryView(null)}
        footer={null}
        width={760}
      >
        {historyView && (
          <div className="space-y-5">
            <div>
              <h4 className="mb-2 font-semibold text-gray-900">
                Medical review iterations ({historyView.cell.reviews.length})
              </h4>
              <div className="space-y-2">
                {historyView.cell.reviews.map((review, index) => (
                  <div key={review._id || index} className={`rounded-lg border p-3 ${index === 0 ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link to={`/${routePrefix}/medical-review-requests/${review._id}`} className="font-semibold text-blue-700 hover:underline">
                        MRR #{getDisplayId(review)}
                      </Link>
                      <span className="text-xs font-semibold uppercase text-gray-500">
                        {index === 0 ? 'Latest' : `Previous ${index}`}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-700">
                      {review.reviewDecision || review.decision || review.status || 'Pending'}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                      {review.reviewNotes || review.overallNotes || review.medicalStaffNotes || 'No review notes.'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="mb-2 font-semibold text-gray-900">Artifacts ({historyView.cell.artifacts.length})</h4>
              <div className="flex flex-wrap gap-2">
                {historyView.cell.artifacts.map((artifact, index) => (
                  <Link key={artifact._id || index} to={`/${routePrefix}/medical-artifacts/${artifact._id}`} className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50">
                    Artifact #{getDisplayId(artifact)}{index === 0 ? ' · latest' : ''}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <div className="medical-grid-toolbar">
        <div className="medical-grid-summary">
          <div><strong>{summary.clients}</strong><span>clients</span></div>
          <div><strong>{summary.reviews}</strong><span>review requests</span></div>
          <div><strong>{summary.pending}</strong><span>pending</span></div>
          <div><strong>{summary.missing}</strong><span>missing</span></div>
        </div>
        <div className="medical-grid-toolbar-actions">
          <div className="medical-grid-legend" aria-label="Status legend">
            <span className="legend-approved">Approved</span>
            <span className="legend-caution">Caution</span>
            <span className="legend-pending">Pending</span>
            <span className="legend-artifact">Artifact only</span>
            <span className="legend-missing">Missing</span>
          </div>
          <button type="button" onClick={fetchGridData} className="medical-grid-refresh-btn">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <Link
            to={`/${routePrefix}/medical-review-requests/new?retreatId=${encodeURIComponent(retreatId)}`}
            className="medical-grid-request-btn"
          >
            Request review
          </Link>
        </div>
      </div>

      <div className="medical-grid-workspace">
        <div className="medical-matrix-wrap">
          <table className="medical-matrix">
            <thead>
              <tr>
                <th>Client</th>
                {gridData.rows.map((row) => <th key={row.key}>{row.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {gridData.clients.map((client, clientIndex) => (
                <tr key={client.bookingId}>
                  <td className="medical-matrix-client">
                    <div className="medical-client-avatar">{getClientInitials(client.clientName)}</div>
                    <div>
                      <Link to={`/${routePrefix}/clients/${client.clientId}`} className="medical-client-name">
                        {client.clientName}
                      </Link>
                      <div className="medical-client-subline">
                        <Link to={`/${routePrefix}/bookings/${client.bookingId}`}>#{client.bookingNumber}</Link>
                        {client.clientDisplayId ? ` · client #${client.clientDisplayId}` : ''}
                      </div>
                    </div>
                  </td>
                  {gridData.rows.map((row) => (
                    <td key={`${client.bookingId}-${row.key}`}>
                      {renderCompactCell(row.cells[clientIndex], client, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="medical-detail-panel">
          {selected ? (
            <>
              <div className="medical-detail-scroll">
                <div className="medical-detail-heading">
                  <div>
                    <div className="medical-detail-eyebrow">
                      {selected.client.clientName} · {selected.row.label}
                    </div>
                    <h3>
                      {selected.cell.review
                        ? `MRR #${getDisplayId(selected.cell.review)}`
                        : selected.cell.artifact
                          ? `Artifact #${getDisplayId(selected.cell.artifact)}`
                          : 'Missing record'}
                    </h3>
                  </div>
                  <span className={`medical-detail-status ${getToneClass(selected.cell)}`}>
                    {getStatusLabel(selected.cell)}
                  </span>
                </div>

                <dl className="medical-detail-list">
                  <div><dt>Stage</dt><dd>{selected.cell.review?.documentStage || selected.cell.artifact?.documentStage || 'Entry'}</dd></div>
                  <div><dt>Submitted</dt><dd>{selected.cell.submittedAt || '—'}</dd></div>
                  <div><dt>Artifact</dt><dd>{selected.cell.artifact ? `#${getDisplayId(selected.cell.artifact)}` : '—'}</dd></div>
                  <div><dt>Booking</dt><dd>#{selected.client.bookingNumber}</dd></div>
                </dl>

                <div className="medical-detail-notes">
                  <h4>Advisor notes</h4>
                  <p>{selected.cell.notes?.trim() || 'No advisor notes yet.'}</p>
                </div>
              </div>

              <div className="medical-detail-actions">
                {(selected.cell.reviews.length > 1 || selected.cell.artifacts.length > 1) && (
                  <button type="button" className="medical-detail-primary" onClick={() => setHistoryView(selected)}>
                    View {selected.cell.reviews.length} review iterations
                  </button>
                )}
                <div>
                  {selected.cell.artifact?._id && (
                    <Link to={`/${routePrefix}/medical-artifacts/${selected.cell.artifact._id}`}>Open artifact</Link>
                  )}
                  {selected.cell.review?._id && (
                    <Link to={`/${routePrefix}/medical-review-requests/${selected.cell.review._id}`}>Full request</Link>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="medical-detail-empty">Select a medical result to see its details.</div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default RetreatTrackingGrid;
