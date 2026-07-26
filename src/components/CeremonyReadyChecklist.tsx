import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { ceremoniesApi, medicalArtifactsApi } from '../services/api';
import { Ceremony, CeremonyParticipant, MedicalArtifact } from '../types';
import { message } from 'antd';

type ChecklistItem = NonNullable<Ceremony['readyChecklistItems']>[number];

const defaultItems: ChecklistItem[] = [
  { id: 'ekg_taken', label: 'EKG taken', kind: 'ekg' },
  { id: 'bp_taken', label: 'BP taken', kind: 'bp' },
  { id: 'questions_gone_over', label: 'Questions gone over', kind: 'manual' },
  { id: 'med_responses_reviewed', label: 'Medication responses reviewed', kind: 'manual' },
  { id: 'saunas_made', label: 'Saunas made if needed', kind: 'manual' },
];

const getId = (value: any) => typeof value === 'string' ? value : value?._id || value?.id || '';
const getClientName = (participant: CeremonyParticipant) => {
  const client = participant.clientId as any;
  if (!client || typeof client === 'string') return `Client ${getId(client).slice(-6)}`;
  return [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ') || client.email || 'Client';
};

const artifactMatchesCeremony = (artifact: MedicalArtifact, ceremony: Ceremony) => {
  const artifactCeremonyId = getId(artifact.ceremonyId);
  if (artifactCeremonyId) return artifactCeremonyId === ceremony._id;
  return Number(artifact.ceremonyNumber || 0) === Number(ceremony.ceremonyNumber || 0);
};

const CeremonyReadyChecklist: React.FC<{ ceremonyId: string }> = ({ ceremonyId }) => {
  const [ceremony, setCeremony] = useState<Ceremony | null>(null);
  const [participants, setParticipants] = useState<CeremonyParticipant[]>([]);
  const [artifacts, setArtifacts] = useState<MedicalArtifact[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [newItemLabel, setNewItemLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [ceremonyResponse, participantResponse] = await Promise.all([
        ceremoniesApi.getOne(ceremonyId),
        ceremoniesApi.getParticipants(ceremonyId),
      ]);
      const loadedCeremony = ceremonyResponse.data;
      const retreatId = getId(loadedCeremony.retreatId);
      const artifactResponse = retreatId
        ? await medicalArtifactsApi.getAll({ retreatId, documentStage: 'pre_ceremony' })
        : { data: [] as MedicalArtifact[] };
      setCeremony(loadedCeremony);
      setParticipants(participantResponse.data || []);
      setArtifacts(((artifactResponse.data || []) as MedicalArtifact[]).filter((artifact: MedicalArtifact) => artifactMatchesCeremony(artifact, loadedCeremony)));
      const nextNotes: Record<string, string> = {};
      (participantResponse.data || []).forEach((participant: CeremonyParticipant) => {
        (participant.readyChecklist || []).forEach((entry: NonNullable<CeremonyParticipant['readyChecklist']>[number]) => {
          nextNotes[`${participant._id}:${entry.itemId}`] = entry.note || '';
        });
      });
      setNotes(nextNotes);
    } catch (error) {
      console.error('Failed to load ceremony ready checklist:', error);
      message.error('Failed to load ceremony ready checklist');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [ceremonyId]);

  const items = useMemo(() => {
    const customItems = ceremony?.readyChecklistItems || [];
    return [...defaultItems, ...customItems.filter((item) => !defaultItems.some((defaultItem) => defaultItem.id === item.id))];
  }, [ceremony?.readyChecklistItems]);

  const getAutomaticStatus = (participant: CeremonyParticipant, item: ChecklistItem) => {
    if (item.kind === 'manual') return undefined;
    const clientId = getId(participant.clientId);
    const clientArtifacts = artifacts.filter((artifact) => getId(artifact.clientId) === clientId);
    if (item.kind === 'ekg') {
      return clientArtifacts.some((artifact) => artifact.artifactType === 'ceremony_ekg' || artifact.documentType === 'EKG');
    }
    return clientArtifacts.some((artifact) => artifact.artifactType === 'blood_pressure' || artifact.documentType === 'BP');
  };

  const getEntry = (participant: CeremonyParticipant, itemId: string) =>
    (participant.readyChecklist || []).find((entry) => entry.itemId === itemId);

  const saveEntry = async (participant: CeremonyParticipant, item: ChecklistItem, checked: boolean, note: string) => {
    if (!participant._id) return;
    const key = `${participant._id}:${item.id}`;
    const nextChecklist = [
      ...(participant.readyChecklist || []).filter((entry) => entry.itemId !== item.id),
      { itemId: item.id, checked, note, updatedAt: new Date().toISOString() },
    ];
    try {
      setSavingKey(key);
      const response = await ceremoniesApi.updateParticipant(participant._id, { readyChecklist: nextChecklist });
      setParticipants((current) => current.map((row) => row._id === participant._id ? { ...row, ...response.data } : row));
    } catch (error) {
      console.error('Failed to save checklist item:', error);
      message.error('Failed to save checklist item');
    } finally {
      setSavingKey('');
    }
  };

  const addItem = async () => {
    const label = newItemLabel.trim();
    if (!ceremony?._id || !label) return;
    const newItem: ChecklistItem = {
      id: `custom_${Date.now()}`,
      label,
      kind: 'manual',
    };
    try {
      const response = await ceremoniesApi.update(ceremony._id, {
        readyChecklistItems: [...(ceremony.readyChecklistItems || []), newItem],
      });
      setCeremony((current) => current ? { ...current, ...response.data } : response.data);
      setNewItemLabel('');
      message.success('Checklist item added');
    } catch (error) {
      message.error('Failed to add checklist item');
    }
  };

  const removeItem = async (item: ChecklistItem) => {
    if (!ceremony?._id || item.kind !== 'manual' || defaultItems.some((defaultItem) => defaultItem.id === item.id)) return;
    const nextItems = (ceremony.readyChecklistItems || []).filter((entry) => entry.id !== item.id);
    try {
      const response = await ceremoniesApi.update(ceremony._id, { readyChecklistItems: nextItems });
      setCeremony((current) => current ? { ...current, ...response.data } : response.data);
    } catch (error) {
      message.error('Failed to remove checklist item');
    }
  };

  if (loading) return <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading checklist...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Ceremony ready checklist</h3>
          <p className="text-sm text-gray-500">Green is ready. Red still needs attention. EKG and BP are detected from this ceremony’s medical artifacts.</p>
        </div>
        <button type="button" onClick={loadData} className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="flex gap-2 rounded-lg border border-gray-200 bg-white p-3">
        <input
          value={newItemLabel}
          onChange={(event) => setNewItemLabel(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && addItem()}
          placeholder="Add checklist item"
          className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button type="button" onClick={addItem} disabled={!newItemLabel.trim()} className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-max border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 z-10 min-w-[180px] border-b border-r border-gray-200 bg-gray-50 px-3 py-3 text-left font-semibold text-gray-700">Client</th>
              {items.map((item) => (
                <th key={item.id} className="min-w-[210px] border-b border-r border-gray-200 px-3 py-3 text-left align-top font-semibold text-gray-700">
                  <div className="flex items-start justify-between gap-2">
                    <span>{item.label}</span>
                    {!defaultItems.some((defaultItem) => defaultItem.id === item.id) && (
                      <button type="button" onClick={() => removeItem(item)} className="text-gray-400 hover:text-red-600" title="Remove item">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {item.kind !== 'manual' && <div className="mt-1 text-[11px] font-normal text-blue-600">Automatic</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {participants.map((participant) => (
              <tr key={participant._id}>
                <th className="sticky left-0 z-10 border-b border-r border-gray-200 bg-white px-3 py-3 text-left font-semibold text-gray-900">{getClientName(participant)}</th>
                {items.map((item) => {
                  const entry = getEntry(participant, item.id);
                  const automaticStatus = getAutomaticStatus(participant, item);
                  const checked = automaticStatus ?? Boolean(entry?.checked);
                  const key = `${participant._id}:${item.id}`;
                  return (
                    <td key={item.id} className={`border-b border-r border-gray-200 p-2 align-top ${checked ? 'bg-emerald-100' : 'bg-red-100'}`}>
                      <label className="flex items-center gap-2 font-semibold text-gray-900">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={item.kind !== 'manual' || savingKey === key}
                          onChange={(event) => saveEntry(participant, item, event.target.checked, notes[key] || '')}
                          className="h-4 w-4"
                        />
                        {checked ? 'OK' : 'Not ready'}
                      </label>
                      <textarea
                        value={notes[key] ?? entry?.note ?? ''}
                        onChange={(event) => setNotes((current) => ({ ...current, [key]: event.target.value }))}
                        onBlur={() => saveEntry(participant, item, Boolean(entry?.checked), notes[key] || '')}
                        rows={2}
                        placeholder="Note"
                        className="mt-2 w-full resize-none rounded-md border border-white/80 bg-white/80 px-2 py-1 text-xs text-gray-800"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {participants.length === 0 && <div className="p-6 text-sm text-gray-500">No clients are linked to this ceremony. Link the ceremony to a retreat with active bookings first.</div>}
      </div>
    </div>
  );
};

export default CeremonyReadyChecklist;
