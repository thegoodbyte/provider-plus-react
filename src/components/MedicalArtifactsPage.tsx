import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, FileText, Inbox, Plus, RefreshCw } from 'lucide-react';
import { medicalArtifactsApi } from '../services/api';
import { Client, MedicalArtifact } from '../types';
import LoadingSpinner from './LoadingSpinner';

const artifactTypeLabels: Record<NonNullable<MedicalArtifact['artifactType']>, string> = {
  ekg: 'EKG',
  ceremony_ekg: 'Ceremony EKG',
  blood_pressure: 'Blood Pressure',
  liver_panel: 'Liver Panel',
  medications_form: 'Medications Form',
  medication_list: 'Medication List',
  questionnaire: 'Questionnaire',
  food_intake: 'Food Intake',
  contract: 'Contract',
  question: 'Question',
  other: 'Other',
};

const getArtifactTypeLabel = (artifactType?: MedicalArtifact['artifactType']) =>
  artifactType ? artifactTypeLabels[artifactType] : 'Medical Artifact';

const documentStageLabels: Record<NonNullable<MedicalArtifact['documentStage']>, string> = {
  entry: 'Entry',
  pre_ceremony: 'Pre-Ceremony',
  in_ceremony: 'In-Ceremony',
  post_ceremony: 'Post-Ceremony',
  additional: 'Additional',
};

const documentTypeLabels: Record<NonNullable<MedicalArtifact['documentType']>, string> = {
  BP: 'Blood Pressure',
  EKG: 'EKG',
  Liver: 'Liver panel tests',
  Medications: 'Medications',
  other: 'Other',
};

const getDocumentStageLabel = (stage?: MedicalArtifact['documentStage']) =>
  stage ? documentStageLabels[stage] : 'Entry';

const getDocumentTypeLabel = (type?: MedicalArtifact['documentType'], artifactType?: MedicalArtifact['artifactType']) =>
  type ? documentTypeLabels[type] : getArtifactTypeLabel(artifactType);

const getObjectId = (value: any) => typeof value === 'object' ? value?._id || value?.id : value;

const getClientName = (client?: string | Client) => {
  if (!client || typeof client === 'string') return 'Unknown client';
  return [client.firstName || client.fname, client.lastName || client.lname].filter(Boolean).join(' ') || client.email || 'Unknown client';
};

const MedicalArtifactsPage: React.FC = () => {
  const navigate = useNavigate();
  const [artifacts, setArtifacts] = useState<MedicalArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<'all' | NonNullable<MedicalArtifact['documentStage']>>('all');
  const [documentTypeFilter, setDocumentTypeFilter] = useState<'all' | NonNullable<MedicalArtifact['documentType']>>('all');

  const loadData = async () => {
    setLoading(true);
    try {
      const artifactsResponse = await medicalArtifactsApi.getAll();
      setArtifacts(artifactsResponse.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredArtifacts = useMemo(() => {
    return artifacts.filter((artifact) => {
      if (stageFilter !== 'all' && (artifact.documentStage || 'entry') !== stageFilter) return false;
      if (documentTypeFilter !== 'all' && (artifact.documentType || 'other') !== documentTypeFilter) return false;
      return true;
    });
  }, [artifacts, stageFilter, documentTypeFilter]);

  const handleRequestReview = async (artifact: MedicalArtifact) => {
    if (!artifact._id) return;
    navigate(`/admin/medical-review-requests/new?artifactId=${artifact._id}`);
  };

  if (loading) {
    return <LoadingSpinner message="Loading medical artifacts..." />;
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Medical Artifacts</h1>
          <p className="text-sm text-gray-600">Stored EKGs, liver panels, medication forms, questions, and other medical records.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('new')} className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black">
            <Plus className="h-4 w-4" />
            Add New
          </button>
          <button onClick={loadData} className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value as typeof stageFilter)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="all">All document stages</option>
          {Object.entries(documentStageLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select value={documentTypeFilter} onChange={(event) => setDocumentTypeFilter(event.target.value as typeof documentTypeFilter)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
          <option value="all">All document types</option>
          {Object.entries(documentTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-md border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Preview</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Document Type</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Booking / Ceremony</th>
              <th className="px-4 py-3">Received</th>
              <th className="px-4 py-3">Files</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filteredArtifacts.map((artifact) => (
              <tr key={artifact._id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">#{artifact.display_id}</td>
                <td className="px-4 py-3">
                  {artifact.files?.find((file) => file.thumbnailUrl)?.thumbnailUrl ? (
                    <img
                      src={artifact.files.find((file) => file.thumbnailUrl)?.thumbnailUrl}
                      alt={artifact.title}
                      className="h-[60px] w-[80px] rounded border border-gray-200 object-contain"
                    />
                  ) : (
                    <div className="flex h-[60px] w-[80px] items-center justify-center rounded border border-dashed border-gray-200 text-xs text-gray-400">No thumb</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    {getDocumentStageLabel(artifact.documentStage)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                    {getDocumentTypeLabel(artifact.documentType, artifact.artifactType)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <span>{artifact.title}</span>
                  </div>
                </td>
                <td className="px-4 py-3">{getClientName(artifact.clientId)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1 text-xs text-gray-600">
                    <span>{getObjectId(artifact.bookingId) ? `Booking ${String(getObjectId(artifact.bookingId)).slice(-6)}` : '-'}</span>
                    {artifact.ceremonyNumber ? <span>Ceremony #{artifact.ceremonyNumber}</span> : null}
                  </div>
                </td>
                <td className="px-4 py-3">{artifact.receivedAt ? new Date(artifact.receivedAt).toLocaleDateString() : '-'}</td>
                <td className="px-4 py-3">{artifact.files?.length || 0}</td>
                <td className="px-4 py-3 capitalize">{artifact.status || 'stored'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => navigate(`${artifact._id}`)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                      <Eye className="h-3.5 w-3.5" />
                      View/Edit
                    </button>
                    <button onClick={() => handleRequestReview(artifact)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                      <Inbox className="h-3.5 w-3.5" />
                      Request Review
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredArtifacts.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-gray-500">No medical artifacts yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MedicalArtifactsPage;
