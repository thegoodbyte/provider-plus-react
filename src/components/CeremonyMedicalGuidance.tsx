import React, { useEffect, useMemo, useState } from 'react';
import { Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import { bookingsApi, ceremoniesApi, medicalArtifactsApi, medicalReviewRequestsApi } from '../services/api';
import { Ceremony, CeremonyParticipant, MedicalArtifact, MedicalReviewRequest, RetreatClient } from '../types';
import { message } from 'antd';
import { getRetreatCeremonyPosition, orderRetreatCeremonies } from './ceremonyPosition';

type GuidanceRow = {
  id: string;
  label: string;
  automatic?: boolean;
  matches?: (request: MedicalReviewRequest, artifacts: MedicalArtifact[]) => boolean;
};

const getId = (value: any) => typeof value === 'string' ? value : value?._id || value?.id || '';
const getClientName = (participant: CeremonyParticipant) => {
  const client = participant.clientId as any;
  if (!client || typeof client === 'string') return `Client ${getId(client).slice(-6)}`;
  return [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ') || client.email || 'Client';
};
const getBookingClientName = (booking: RetreatClient) => {
  const client = booking.clientId as any;
  if (!client || typeof client === 'string') return `Client ${getId(client).slice(-6)}`;
  return [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ') || client.email || 'Client';
};
const getReviewArtifactIds = (request: MedicalReviewRequest) => [
  getId(request.medicalArtifactId),
  ...(request.artifactIds || []).map(getId),
].filter(Boolean);
const getReviewNote = (request?: MedicalReviewRequest) => {
  if (!request) return '';
  const decisionValue = request.reviewDecision || request.decision;
  const decision = decisionValue ? String(decisionValue).replace(/_/g, ' ') : '';
  const note = request.medicalStaffNotes || request.overallNotes || request.reviewNotes || '';
  return [decision, note].filter(Boolean).join(' — ');
};
const getReviewDate = (request: MedicalReviewRequest) =>
  request.requestedAt || request.createdAt || request.sentForReviewAt || request.assignedDate;
const getReviewStage = (request: MedicalReviewRequest, linkedArtifacts: MedicalArtifact[]) =>
  request.documentStage || request.artifactSnapshot?.documentStage || linkedArtifacts[0]?.documentStage || 'entry';
const reviewHasType = (request: MedicalReviewRequest, linkedArtifacts: MedicalArtifact[], type: 'ekg' | 'liver' | 'medications' | 'questionnaire' | 'bp') => {
  const values = [
    request.requestType,
    request.documentType,
    request.artifactSnapshot?.documentType,
    ...linkedArtifacts.flatMap((artifact) => [artifact.artifactType, artifact.documentType]),
  ].filter(Boolean).map((value) => String(value).toLowerCase());
  if (type === 'ekg') return values.some((value) => value.includes('ekg'));
  if (type === 'liver') return values.some((value) => value.includes('liver'));
  if (type === 'medications') return values.some((value) => value.includes('medication') || value === 'meds');
  if (type === 'questionnaire') return values.some((value) => value.includes('questionnaire'));
  return values.some((value) => value === 'bp' || value.includes('blood_pressure') || value.includes('blood pressure'));
};

const CeremonyMedicalGuidance: React.FC<{ ceremonyId: string }> = ({ ceremonyId }) => {
  const [ceremony, setCeremony] = useState<Ceremony | null>(null);
  const [participants, setParticipants] = useState<CeremonyParticipant[]>([]);
  const [bookings, setBookings] = useState<RetreatClient[]>([]);
  const [artifacts, setArtifacts] = useState<MedicalArtifact[]>([]);
  const [reviews, setReviews] = useState<MedicalReviewRequest[]>([]);
  const [retreatCeremonies, setRetreatCeremonies] = useState<Ceremony[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ceremonyResponse, participantResponse] = await Promise.all([
        ceremoniesApi.getOne(ceremonyId),
        ceremoniesApi.getParticipants(ceremonyId),
      ]);
      const loadedCeremony = ceremonyResponse.data;
      const retreatId = getId(loadedCeremony.retreatId);
      const [artifactResponse, reviewResponse, bookingResponse, ceremoniesResponse] = retreatId
        ? await Promise.all([
            medicalArtifactsApi.getAll({ retreatId }),
            medicalReviewRequestsApi.getAll({ retreatId }),
            bookingsApi.getByRetreatWithDetails(retreatId),
            ceremoniesApi.getByRetreat(retreatId),
          ])
        : [{ data: [] as MedicalArtifact[] }, { data: [] as MedicalReviewRequest[] }, { data: [] as RetreatClient[] }, { data: [] as Ceremony[] }];
      setCeremony(loadedCeremony);
      setParticipants(participantResponse.data || []);
      setBookings(bookingResponse.data || []);
      setArtifacts(artifactResponse.data || []);
      setReviews(reviewResponse.data || []);
      setRetreatCeremonies(ceremoniesResponse.data || []);
      const nextDrafts: Record<string, string> = {};
      (participantResponse.data || []).forEach((participant: CeremonyParticipant) => {
        (participant.medicalGuidance || []).forEach((entry) => {
          nextDrafts[`${participant._id}:${entry.itemId}`] = entry.value || '';
        });
      });
      setDrafts(nextDrafts);
    } catch (error) {
      console.error('Failed to load ceremony medical guidance:', error);
      message.error('Failed to load ceremony medical guidance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [ceremonyId]);

  useEffect(() => {
    if (!isFullScreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFullScreen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isFullScreen]);

  const clientColumns = useMemo(() => {
    const activeBookings = bookings.filter((booking) => !['cancelled', 'declined', 'moved'].includes(String(booking.status || '').toLowerCase()));
    const seen = new Set<string>();
    const bookingColumns = activeBookings.filter((booking) => {
      const key = getId(booking.clientId) || getId(booking);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((booking) => {
      const clientId = getId(booking.clientId);
      return {
        key: getId(booking) || clientId,
        clientId,
        booking,
        participant: participants.find((participant) => getId(participant.clientId) === clientId),
        name: getBookingClientName(booking),
      };
    });
    if (bookingColumns.length) return bookingColumns;
    return participants.map((participant) => ({
      key: getId(participant),
      clientId: getId(participant.clientId),
      booking: undefined,
      participant,
      name: getClientName(participant),
    }));
  }, [bookings, participants]);

  const rows = useMemo<GuidanceRow[]>(() => {
    const orderedCeremonies = orderRetreatCeremonies([...(retreatCeremonies || []), ...(ceremony ? [ceremony] : [])]);
    const reviewCeremonyPosition = (request: MedicalReviewRequest, linkedArtifacts: MedicalArtifact[]) =>
      getRetreatCeremonyPosition(
        orderedCeremonies,
        (request as any).ceremonyId || (request.artifactSnapshot as any)?.ceremonyId || linkedArtifacts[0]?.ceremonyId,
        request.ceremonyNumber || request.artifactSnapshot?.ceremonyNumber || linkedArtifacts[0]?.ceremonyNumber,
      );
    const entryStage = (request: MedicalReviewRequest, linkedArtifacts: MedicalArtifact[]) =>
      !['pre_ceremony', 'in_ceremony', 'post_ceremony'].includes(getReviewStage(request, linkedArtifacts));
    const common: GuidanceRow[] = [
      { id: 'entry_ekg', label: 'Entry EKG', automatic: true, matches: (request, linked) => entryStage(request, linked) && reviewHasType(request, linked, 'ekg') },
      { id: 'entry_liver', label: 'Entry liver panel', automatic: true, matches: (request, linked) => entryStage(request, linked) && reviewHasType(request, linked, 'liver') },
      { id: 'medications_form', label: 'Medications form', automatic: true, matches: (request, linked) => reviewHasType(request, linked, 'medications') },
      { id: 'questionnaire', label: 'Health questionnaire', automatic: true, matches: (request, linked) => reviewHasType(request, linked, 'questionnaire') },
      { id: 'entry_bp', label: 'Entry / monitored blood pressure', automatic: true, matches: (request, linked) => entryStage(request, linked) && reviewHasType(request, linked, 'bp') },
    ];
    const ceremonyNumbers = Array.from(new Set([
      1,
      2,
      ...artifacts.map((artifact) => getRetreatCeremonyPosition(orderedCeremonies, artifact.ceremonyId, artifact.ceremonyNumber)),
      ...reviews.map((review) => reviewCeremonyPosition(review, getLinkedArtifacts(review))),
    ].filter((value) => value > 0))).sort((a, b) => a - b);
    ceremonyNumbers.forEach((ceremonyNumber) => {
      common.push(
        { id: `pre_${ceremonyNumber}_ekg`, label: `Pre-ceremony ${ceremonyNumber} · EKG`, automatic: true, matches: (request, linked) => getReviewStage(request, linked) === 'pre_ceremony' && reviewCeremonyPosition(request, linked) === ceremonyNumber && reviewHasType(request, linked, 'ekg') },
        { id: `pre_${ceremonyNumber}_bp`, label: `Pre-ceremony ${ceremonyNumber} · Blood pressure`, automatic: true, matches: (request, linked) => getReviewStage(request, linked) === 'pre_ceremony' && reviewCeremonyPosition(request, linked) === ceremonyNumber && reviewHasType(request, linked, 'bp') },
      );
    });
    const otherStageRows: Array<{ stage: MedicalArtifact['documentStage']; label: string }> = [
      { stage: 'in_ceremony', label: 'In ceremony' },
      { stage: 'post_ceremony', label: 'Post ceremony' },
    ];
    otherStageRows.forEach(({ stage, label }) => {
      const hasStage = reviews.some((request) => getReviewStage(request, getLinkedArtifacts(request)) === stage);
      if (hasStage) {
        common.push(
          { id: `${stage}_ekg`, label: `${label} · EKG`, automatic: true, matches: (request, linked) => getReviewStage(request, linked) === stage && reviewHasType(request, linked, 'ekg') },
          { id: `${stage}_bp`, label: `${label} · Blood pressure`, automatic: true, matches: (request, linked) => getReviewStage(request, linked) === stage && reviewHasType(request, linked, 'bp') },
        );
      }
    });
    common.push({ id: 'medical_notes', label: 'Medical notes' });
    return common;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifacts, ceremony, retreatCeremonies, reviews]);

  function getLinkedArtifacts(request: MedicalReviewRequest) {
    const populated = [
      typeof request.medicalArtifactId === 'object' ? request.medicalArtifactId : undefined,
      ...(request.artifactIds || []).filter((artifact): artifact is MedicalArtifact => typeof artifact === 'object'),
    ].filter((artifact): artifact is MedicalArtifact => Boolean(artifact));
    const ids = getReviewArtifactIds(request);
    const resolved = artifacts.filter((artifact) => artifact._id && ids.includes(artifact._id));
    return Array.from(new Map([...populated, ...resolved].filter((artifact) => artifact._id).map((artifact) => [artifact._id!, artifact])).values());
  }

  const getAutomaticValue = (clientId: string, row: GuidanceRow) => {
    if (!row.automatic || !row.matches) return '';
    const matchingReviews = reviews
      .filter((request) => {
        const linked = getLinkedArtifacts(request);
        const requestClientId = getId(request.clientId) || getId(linked[0]?.clientId);
        if (requestClientId !== clientId) return false;
        return row.matches!(request, linked);
      })
      .sort((a, b) => new Date(getReviewDate(a) || 0).getTime() - new Date(getReviewDate(b) || 0).getTime());
    if (!matchingReviews.length) return 'No MRR for this booking and category';
    return matchingReviews.map((request) => {
      const date = getReviewDate(request);
      const status = String(request.status || 'pending').replace(/_/g, ' ');
      const response = getReviewNote(request);
      const heading = `MRR #${request.display_id || request._id || '—'} · ${date ? new Date(date).toLocaleDateString() : 'date unknown'} · ${status}`;
      return `${heading}\n${response || 'Pending — no medical advisor response yet'}`;
    }).join('\n\n');
  };

  const getStoredValue = (participant: CeremonyParticipant, itemId: string) =>
    (participant.medicalGuidance || []).find((entry) => entry.itemId === itemId)?.value || '';

  const saveValue = async (participant: CeremonyParticipant, itemId: string, value: string) => {
    if (!participant._id) return;
    const key = `${participant._id}:${itemId}`;
    const medicalGuidance = [
      ...(participant.medicalGuidance || []).filter((entry) => entry.itemId !== itemId),
      { itemId, value, updatedAt: new Date().toISOString() },
    ];
    try {
      setSavingKey(key);
      const response = await ceremoniesApi.updateParticipant(participant._id, { medicalGuidance });
      setParticipants((current) => current.map((row) => row._id === participant._id ? { ...row, ...response.data } : row));
    } catch (error) {
      message.error('Failed to save medical guidance');
    } finally {
      setSavingKey('');
    }
  };

  if (loading) return <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading medical guidance...</div>;

  return (
    <div className={isFullScreen ? 'fixed inset-0 z-[100] flex flex-col gap-4 overflow-hidden bg-gray-100 p-4 sm:p-6' : 'space-y-4'}>
      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Retreat summarized medical results</h3>
          <p className="text-sm text-gray-500">All MRRs for each client are grouped by medical category and ceremony stage. Attempts are shown oldest first, including pending reviews.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsFullScreen((current) => !current)}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            aria-label={isFullScreen ? 'Return medical guidance to normal size' : 'Enlarge medical guidance'}
          >
            {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {isFullScreen ? 'Back to small' : 'Enlarge'}
          </button>
          <button type="button" onClick={loadData} className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      <div className={`overflow-auto rounded-lg border border-gray-200 bg-white ${isFullScreen ? 'min-h-0 flex-1' : ''}`}>
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col style={{ width: '12%' }} />
            {clientColumns.map((column) => (
              <col key={column.key} style={{ width: `${88 / Math.max(clientColumns.length, 1)}%` }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-20">
            <tr className="bg-gray-50">
              <th className="sticky left-0 top-0 z-30 border-b border-r border-gray-200 bg-gray-50 px-2 py-3 text-left font-semibold text-gray-700">Medical guidance</th>
              {clientColumns.map((column) => (
                <th key={column.key} className="sticky top-0 z-20 break-words border-b border-r border-gray-200 bg-gray-50 px-2 py-3 text-left font-semibold text-gray-900">
                  {column.name}
                  {column.booking?.bookingNumber && <div className="mt-1 text-xs font-normal text-gray-500">Booking #{column.booking.bookingNumber}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th className="sticky left-0 z-10 break-words border-b border-r border-gray-200 bg-gray-50 px-2 py-3 text-left align-top font-semibold text-gray-800">
                  {row.label}
                  {row.automatic && <div className="mt-1 text-[11px] font-normal text-blue-600">From medical review</div>}
                </th>
                {clientColumns.map((column) => {
                  const participant = column.participant;
                  const key = `${participant?._id || column.key}:${row.id}`;
                  const value = row.automatic ? getAutomaticValue(column.clientId, row) : (participant ? (drafts[key] ?? getStoredValue(participant, row.id)) : '');
                  return (
                    <td key={column.key} className="min-w-0 break-words border-b border-r border-gray-200 p-2 align-top">
                      {row.automatic ? (
                        <div className={`min-h-[72px] whitespace-pre-wrap rounded-md p-2 text-xs ${value.startsWith('No MRR') ? 'bg-red-50 text-red-800' : value.includes('Pending —') ? 'bg-amber-50 text-gray-800' : 'bg-emerald-50 text-gray-800'}`}>{value}</div>
                      ) : !participant ? (
                        <div className="min-h-[72px] rounded-md bg-gray-50 p-2 text-xs text-gray-500">Add this client to the ceremony to save ceremony-specific notes.</div>
                      ) : (
                        <textarea
                          value={value}
                          disabled={savingKey === key}
                          onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))}
                          onBlur={() => saveValue(participant, row.id, drafts[key] ?? value)}
                          rows={3}
                          placeholder={`Add ${row.label.toLowerCase()}`}
                          className="w-full min-w-0 resize-y rounded-md border border-gray-300 px-2 py-2 text-xs"
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {clientColumns.length === 0 && <div className="p-6 text-sm text-gray-500">No active clients are booked for this retreat.</div>}
      </div>
    </div>
  );
};

export default CeremonyMedicalGuidance;
