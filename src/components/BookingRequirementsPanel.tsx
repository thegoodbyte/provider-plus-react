import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiX } from 'react-icons/fi';
import { artifactMatches, documentMatches, RequirementDefinition } from './bookingRequirementRows';
import { useBookingRequirements } from './useBookingRequirements';
const CloseIcon: React.FC = () => React.createElement(FiX as any);

export interface BookingRequirementsPanelProps { bookingId: string; clientId?: string; retreatId?: string; refreshKey: number; onStatusChange?: (status: { missing: number; total: number }) => void; }
export const routePrefixForPath = (pathname: string) => { const first = pathname.split('/').filter(Boolean)[0]; return ['admin', 'medical', 'staff', 'user'].includes(first) ? `/${first}` : ''; };
const time = (value?: Date | string) => new Date(value || 0).getTime();
export const formatRequirementDate = (value?: Date | string) => { if (!value) return 'N/A'; const date = new Date(value); return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); };

const BookingRequirementsPanel: React.FC<BookingRequirementsPanelProps> = (props) => {
  const navigate = useNavigate(); const location = useLocation(); const routePrefix = useMemo(() => routePrefixForPath(location.pathname), [location.pathname]);
  const [selected, setSelected] = useState<RequirementDefinition | null>(null); const state = useBookingRequirements(props);
  const artifacts = selected ? state.libraryArtifacts.filter(item => item._id && artifactMatches(item, selected)).sort((a, b) => time(b.receivedAt || b.createdAt) - time(a.receivedAt || a.createdAt)) : [];
  const documents = selected ? state.libraryDocuments.filter(item => item._id && documentMatches(item, selected) && item.files?.length).sort((a, b) => time(b.receivedAt || b.createdAt) - time(a.receivedAt || a.createdAt)) : [];
  const link = async (kind: 'artifact' | 'document', id: string) => { if (selected && await state.link(selected, kind, id)) setSelected(null); };
  return <div className="detail-section">
    <div className="section-header"><h3 className="pdf-section-title">Mandatory Booking Requirements</h3><button className="edit-btn" type="button" onClick={state.reload} disabled={state.loading}>{state.loading ? 'Refreshing...' : 'Refresh'}</button></div>
    <p>Driven by booking-flow requirements and linked booking artifacts/review requests.</p>{state.error && <div className="alert alert-danger">{state.error}</div>}
    <table><thead><tr>{['Requirement', 'Required', 'Uploaded', 'Reviewed', 'Latest File / Review'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{state.rows.map(row => <tr key={row.key}>
      <td>{row.label}</td><td>{row.required ? 'Yes' : 'No'}</td><td>{row.uploaded ? 'uploaded' : 'missing'}</td><td>{row.reviewed ? (row.latestReview?.reviewDecision || row.latestReview?.status || 'reviewed') : 'pending'}</td><td>
      {row.latestArtifact?._id && <button type="button" onClick={() => navigate(`${routePrefix}/medical-artifacts/${row.latestArtifact?._id}`)}>Artifact #{row.latestArtifact.display_id || row.latestArtifact._id}</button>}
      {row.latestDocument?._id && <button type="button" onClick={() => navigate(`${routePrefix}/booking-documents`)}>Document #{row.latestDocument.display_id || row.latestDocument._id}</button>}
      {row.latestReview?._id && <button type="button" onClick={() => navigate(`${routePrefix}/medical-review-requests/${row.latestReview?._id}`)}>Review #{row.latestReview.display_id || row.latestReview._id}</button>}
      <button type="button" onClick={() => setSelected(row)}>{row.latestArtifact || row.latestDocument ? 'Change linked record' : 'Find and link existing record'}</button></td>
    </tr>)}</tbody></table>
    {selected && <div role="dialog" aria-modal="true" aria-labelledby="requirement-link-title"><section><header><h2 id="requirement-link-title">Link {selected.label}</h2><button type="button" onClick={() => setSelected(null)} aria-label="Close record lookup"><CloseIcon /></button></header>
      {(selected.library === 'medical_artifacts' || selected.library === 'both') && <LookupSection title="Medical Artifacts" empty="No matching medical artifacts found for this client." records={artifacts.map((item, index) => ({ id: item._id!, title: `#${item.display_id || item._id} ${item.title || item.documentType || item.artifactType}`, detail: `${item.artifactType || 'artifact'} · ${formatRequirementDate(item.receivedAt || item.createdAt)}`, latest: index === 0 }))} kind="artifact" linkingId={state.linkingRecordId} onLink={link} />}
      {(selected.library === 'booking_documents' || selected.library === 'both') && <LookupSection title="Booking Documents" empty="No matching booking documents found for this client." records={documents.map((item, index) => ({ id: item._id!, title: `#${item.display_id || item._id} ${item.title || item.documentType}`, detail: `${item.documentType} · ${formatRequirementDate(item.receivedAt || item.createdAt)}`, latest: index === 0 }))} kind="document" linkingId={state.linkingRecordId} onLink={link} />}
    </section></div>}
  </div>;
};

const LookupSection: React.FC<{ title: string; empty: string; records: Array<{ id: string; title: string; detail: string; latest: boolean }>; kind: 'artifact' | 'document'; linkingId: string; onLink: (kind: 'artifact' | 'document', id: string) => void }> = ({ title, empty, records, kind, linkingId, onLink }) => <div><h3>{title}</h3>{records.length ? records.map(record => <div key={record.id}><div>{record.title}</div><div>{record.detail}{record.latest ? ' · latest' : ''}</div><button type="button" disabled={Boolean(linkingId)} onClick={() => onLink(kind, record.id)}>{linkingId === `${kind}:${record.id}` ? 'Linking...' : `Link ${kind}`}</button></div>) : <p>{empty}</p>}</div>;
export default BookingRequirementsPanel;
