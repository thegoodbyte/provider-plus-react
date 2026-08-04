import React, { useEffect, useMemo, useState } from 'react';
import { Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import { ceremoniesApi, medicalArtifactsApi, medicalReviewRequestsApi } from '../services/api';
import { Ceremony, CeremonyParticipant, MedicalArtifact, MedicalReviewRequest } from '../types';
import { message } from 'antd';

type GuidanceRow = {
  id: string;
  label: string;
  automatic?: boolean;
  matches?: (artifact: MedicalArtifact) => boolean;
};

const getId = (value: any) => typeof value === 'string' ? value : value?._id || value?.id || '';
const getClientName = (participant: CeremonyParticipant) => {
  const client = participant.clientId as any;
  if (!client || typeof client === 'string') return `Client ${getId(client).slice(-6)}`;
  return [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ') || client.email || 'Client';
};
const getReviewArtifactIds = (request: MedicalReviewRequest) => [
  getId(request.medicalArtifactId),
  ...(request.artifactIds || []).map(getId),
].filter(Boolean);
const getReviewNote = (request?: MedicalReviewRequest) => {
  if (!request) return '';
  const decision = request.reviewDecision ? String(request.reviewDecision).replace(/_/g, ' ') : '';
  const note = request.medicalStaffNotes || request.overallNotes || request.reviewNotes || '';
  return [decision, note].filter(Boolean).join(' — ');
};

const CeremonyMedicalGuidance: React.FC<{ ceremonyId: string }> = ({ ceremonyId }) => {
  const [ceremony, setCeremony] = useState<Ceremony | null>(null);
  const [participants, setParticipants] = useState<CeremonyParticipant[]>([]);
  const [artifacts, setArtifacts] = useState<MedicalArtifact[]>([]);
  const [reviews, setReviews] = useState<MedicalReviewRequest[]>([]);
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
      const [artifactResponse, reviewResponse] = retreatId
        ? await Promise.all([
            medicalArtifactsApi.getAll({ retreatId }),
            medicalReviewRequestsApi.getAll({ retreatId }),
          ])
        : [{ data: [] as MedicalArtifact[] }, { data: [] as MedicalReviewRequest[] }];
      setCeremony(loadedCeremony);
      setParticipants(participantResponse.data || []);
      setArtifacts(artifactResponse.data || []);
      setReviews(reviewResponse.data || []);
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

  const rows = useMemo<GuidanceRow[]>(() => {
    const common: GuidanceRow[] = [
      { id: 'entry_ekg', label: 'Entry EKG', automatic: true, matches: (artifact) => artifact.documentStage === 'entry' && (artifact.documentType === 'EKG' || artifact.artifactType === 'ekg') },
      { id: 'entry_liver', label: 'Entry liver panel', automatic: true, matches: (artifact) => artifact.documentStage === 'entry' && (artifact.documentType === 'Liver' || artifact.artifactType === 'liver_panel') },
      { id: 'medications_form', label: 'Medications form', automatic: true, matches: (artifact) => artifact.artifactType === 'medications_form' || artifact.documentType === 'Medications' || artifact.documentType === 'meds' },
      { id: 'arrival_bp', label: 'Blood pressure on arrival', automatic: true, matches: (artifact) => artifact.documentStage === 'pre_ceremony' && (artifact.documentType === 'BP' || artifact.artifactType === 'blood_pressure') },
      { id: 'arrival_ekg', label: 'EKG on arrival', automatic: true, matches: (artifact) => artifact.documentStage === 'pre_ceremony' && (artifact.documentType === 'EKG' || artifact.artifactType === 'ceremony_ekg') },
    ];
    if (Number(ceremony?.ceremonyNumber || 0) > 1) {
      common.push({
        id: 'extra_ekg_before_ceremony',
        label: `Extra EKG before ceremony ${ceremony?.ceremonyNumber}`,
        automatic: true,
        matches: (artifact) => artifact.documentStage === 'pre_ceremony' && (artifact.documentType === 'EKG' || artifact.artifactType === 'ceremony_ekg'),
      });
    }
    common.push(
      { id: 'special_note', label: 'Special note' },
      { id: 'spoon_limit', label: 'Spoon limit' },
      { id: 'walking_guidance', label: 'Walking guidance' },
    );
    if (Number(ceremony?.ceremonyNumber || 0) > 1) {
      common.push({ id: 'previous_ceremony_guidance', label: `Guidance after ceremony ${Number(ceremony?.ceremonyNumber || 0) - 1} / overall observations` });
    }
    return common;
  }, [ceremony?.ceremonyNumber]);

  const getAutomaticValue = (participant: CeremonyParticipant, row: GuidanceRow) => {
    if (!row.automatic || !row.matches || !ceremony) return '';
    const clientId = getId(participant.clientId);
    const matchingArtifacts = artifacts.filter((artifact) => {
      if (getId(artifact.clientId) !== clientId || !row.matches!(artifact)) return false;
      if (artifact.documentStage !== 'pre_ceremony') return true;
      const artifactCeremonyId = getId(artifact.ceremonyId);
      return artifactCeremonyId
        ? artifactCeremonyId === ceremony._id
        : Number(artifact.ceremonyNumber || 0) === Number(ceremony.ceremonyNumber || 0);
    });
    if (!matchingArtifacts.length) return 'No reviewed record';
    return matchingArtifacts.map((artifact) => {
      const request = reviews
        .filter((review) => getId(review.clientId) === clientId && getReviewArtifactIds(review).includes(artifact._id || ''))
        .sort((a, b) => new Date(b.reviewedAt || b.updatedAt || 0).getTime() - new Date(a.reviewedAt || a.updatedAt || 0).getTime())[0];
      return getReviewNote(request) || artifact.notes || artifact.textContent || 'Recorded — no medical guidance yet';
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
          <h3 className="text-lg font-semibold text-gray-900">Ceremony medical guidance</h3>
          <p className="text-sm text-gray-500">Medical review decisions and notes appear automatically. Add ceremony-specific limits and guidance in the editable rows.</p>
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
        <table className="min-w-max border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 z-10 min-w-[220px] border-b border-r border-gray-200 bg-gray-50 px-3 py-3 text-left font-semibold text-gray-700">Medical guidance</th>
              {participants.map((participant) => (
                <th key={participant._id} className="min-w-[240px] max-w-[300px] border-b border-r border-gray-200 px-3 py-3 text-left font-semibold text-gray-900">{getClientName(participant)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th className="sticky left-0 z-10 border-b border-r border-gray-200 bg-gray-50 px-3 py-3 text-left align-top font-semibold text-gray-800">
                  {row.label}
                  {row.automatic && <div className="mt-1 text-[11px] font-normal text-blue-600">From medical review</div>}
                </th>
                {participants.map((participant) => {
                  const key = `${participant._id}:${row.id}`;
                  const value = row.automatic ? getAutomaticValue(participant, row) : (drafts[key] ?? getStoredValue(participant, row.id));
                  return (
                    <td key={participant._id} className="max-w-[300px] border-b border-r border-gray-200 p-2 align-top">
                      {row.automatic ? (
                        <div className={`min-h-[72px] whitespace-pre-wrap rounded-md p-2 text-xs ${value === 'No reviewed record' ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-gray-800'}`}>{value}</div>
                      ) : (
                        <textarea
                          value={value}
                          disabled={savingKey === key}
                          onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))}
                          onBlur={() => saveValue(participant, row.id, drafts[key] ?? value)}
                          rows={3}
                          placeholder={`Add ${row.label.toLowerCase()}`}
                          className="w-full min-w-[220px] resize-y rounded-md border border-gray-300 px-2 py-2 text-xs"
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {participants.length === 0 && <div className="p-6 text-sm text-gray-500">No clients are linked to this ceremony.</div>}
      </div>
    </div>
  );
};

export default CeremonyMedicalGuidance;
