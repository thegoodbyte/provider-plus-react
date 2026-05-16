import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { clientsApi, clientMedicalApi, medicalTrackingApi, retreatsApi } from '../services/api';
import { Client, MedicalItem, Retreat } from '../types';
import AppleButton from './AppleButton';
import SearchableClientDropdown from './SearchableClientDropdown';
import { FiArrowLeft, FiSave, FiTrash2, FiUpload, FiFileText, FiImage } from 'react-icons/fi';

const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const getMedicalItemClientId = (item: Partial<MedicalItem> | null | undefined): string => {
  if (!item) return '';
  return item.client_id || (item as any).clientId || '';
};

const getMedicalItemRetreatId = (item: Partial<MedicalItem> | null | undefined): string => {
  if (!item) return '';
  const retreat = (item as any).retreatId;
  if (typeof retreat === 'string') return retreat;
  return retreat?._id || '';
};

const isObjectId = (value: string): boolean => /^[a-f\d]{24}$/i.test(value);

const isImageFile = (filename: string): boolean => {
  if (!filename) return false;
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return imageExtensions.includes(extension);
};

const getFilenameFromPath = (value: string): string => {
  if (!value) return '';
  const parts = value.split('/');
  return parts[parts.length - 1];
};

const MedicalTrackingEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<MedicalItem | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [retreats, setRetreats] = useState<Retreat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    clientId: '',
    retreatId: '',
    liverPanelStatus: 'pending',
    ekgStatus: 'pending',
    medicalAdvisorName: '',
    medicalAdvisorEmail: '',
    finalMedicalClearance: false,
    medicalClearanceNotes: '',
    generalNotes: '',
    liverPanelAdvisorNotes: '',
    ekgAdvisorNotes: '',
    liverPanelFilePath: '',
    liverPanelFileName: '',
    liverPanelFileSize: undefined as number | undefined,
    ekgFilePath: '',
    ekgFileName: '',
    ekgFileSize: undefined as number | undefined,
  });
  const [ekgReplacementFile, setEkgReplacementFile] = useState<File | null>(null);
  const [liverReplacementFile, setLiverReplacementFile] = useState<File | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        setIsLoading(true);
        const [itemResponse, clientsResponse, retreatsResponse] = await Promise.all([
          medicalTrackingApi.getOne(id),
          clientsApi.getAll(),
          retreatsApi.getAll(),
        ]);

        const currentItem = itemResponse.data;
        setItem(currentItem);
        setClients(clientsResponse.data || []);
        setRetreats(retreatsResponse.data || []);

        setFormData({
          clientId: getMedicalItemClientId(currentItem),
          retreatId: getMedicalItemRetreatId(currentItem),
          liverPanelStatus: (currentItem as any).liverPanelStatus || 'pending',
          ekgStatus: (currentItem as any).ekgStatus || 'pending',
          medicalAdvisorName: (currentItem as any).medicalAdvisorName || '',
          medicalAdvisorEmail: (currentItem as any).medicalAdvisorEmail || '',
          finalMedicalClearance: Boolean((currentItem as any).finalMedicalClearance),
          medicalClearanceNotes: (currentItem as any).medicalClearanceNotes || '',
          generalNotes: (currentItem as any).generalNotes || (currentItem as any).notes || '',
          liverPanelAdvisorNotes: (currentItem as any).liverPanelAdvisorNotes || '',
          ekgAdvisorNotes: (currentItem as any).ekgAdvisorNotes || '',
          liverPanelFilePath: (currentItem as any).liverPanelFilePath || '',
          liverPanelFileName: (currentItem as any).liverPanelFileName || '',
          liverPanelFileSize: (currentItem as any).liverPanelFileSize,
          ekgFilePath: (currentItem as any).ekgFilePath || '',
          ekgFileName: (currentItem as any).ekgFileName || '',
          ekgFileSize: (currentItem as any).ekgFileSize,
        });
        setEkgReplacementFile(null);
        setLiverReplacementFile(null);
      } catch (loadError) {
        console.error('Error loading medical tracking item:', loadError);
        setError('Unable to load the medical tracking record.');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    try {
      setIsSaving(true);
      setError(null);

      const updateData: Record<string, any> = {
        liverPanelStatus: formData.liverPanelStatus,
        ekgStatus: formData.ekgStatus,
        medicalAdvisorName: formData.medicalAdvisorName,
        medicalAdvisorEmail: formData.medicalAdvisorEmail,
        finalMedicalClearance: formData.finalMedicalClearance,
        medicalClearanceNotes: formData.medicalClearanceNotes,
        generalNotes: formData.generalNotes,
        liverPanelAdvisorNotes: formData.liverPanelAdvisorNotes,
        ekgAdvisorNotes: formData.ekgAdvisorNotes,
        liverPanelFilePath: formData.liverPanelFilePath || null,
        liverPanelFileName: formData.liverPanelFileName || null,
        liverPanelFileSize: formData.liverPanelFileSize || null,
        ekgFilePath: formData.ekgFilePath || null,
        ekgFileName: formData.ekgFileName || null,
        ekgFileSize: formData.ekgFileSize || null,
      };

      if (isObjectId(formData.clientId)) {
        updateData.clientId = formData.clientId;
      }

      if (isObjectId(formData.retreatId)) {
        updateData.retreatId = formData.retreatId;
      }

      await medicalTrackingApi.update(id, updateData);

      const clientIdForUpload = formData.clientId || getMedicalItemClientId(item);
      const retreatIdForUpload = formData.retreatId || getMedicalItemRetreatId(item);

      if (ekgReplacementFile && isObjectId(clientIdForUpload) && isObjectId(retreatIdForUpload)) {
        const formData = new FormData();
        formData.append('clientId', clientIdForUpload);
        formData.append('retreatId', retreatIdForUpload);
        formData.append('file', ekgReplacementFile);
        await clientMedicalApi.uploadFile(formData, 'ekg');
      }

      if (liverReplacementFile && isObjectId(clientIdForUpload) && isObjectId(retreatIdForUpload)) {
        const formData = new FormData();
        formData.append('clientId', clientIdForUpload);
        formData.append('retreatId', retreatIdForUpload);
        formData.append('file', liverReplacementFile);
        await clientMedicalApi.uploadFile(formData, 'liver-panel');
      }

      navigate(`/medical-tracking/${id}`);
    } catch (saveError: any) {
      console.error('Error saving medical tracking record:', saveError);
      setError(saveError?.response?.data?.message || 'Failed to save medical tracking record.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-gray-500">Loading medical tracking record...</div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-6">
        <div className="text-red-500">{error || 'Medical tracking record not found.'}</div>
        <AppleButton onClick={() => navigate('/medical-tracking')} className="mt-4">
          Back to List
        </AppleButton>
      </div>
    );
  }

  const currentClientId = formData.clientId;
  const currentRetreatId = formData.retreatId;
  const retreatOptions = retreats
    .filter((retreat) => retreat._id)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  const selectedRetreatExists = retreatOptions.some((retreat) => retreat._id === currentRetreatId);
  const medicalFileSections = [
    {
      label: 'EKG File',
      type: 'ekg' as const,
      filePath: formData.ekgFilePath,
      fileName: formData.ekgFileName,
      fileSize: formData.ekgFileSize,
      replacementFile: ekgReplacementFile,
    },
    {
      label: 'Liver File',
      type: 'liver-panel' as const,
      filePath: formData.liverPanelFilePath,
      fileName: formData.liverPanelFileName,
      fileSize: formData.liverPanelFileSize,
      replacementFile: liverReplacementFile,
    }
  ];

  const clearMedicalFile = async (type: 'ekg' | 'liver-panel') => {
    if (!id) return;

    if (!window.confirm('Remove the uploaded file from the record and S3?')) {
      return;
    }

    setError(null);

    try {
      if (type === 'ekg') {
        await clientMedicalApi.clearEkgFile(id);
        setEkgReplacementFile(null);
        setFormData(prev => ({
          ...prev,
          ekgStatus: 'pending',
          ekgFilePath: '',
          ekgFileName: '',
          ekgFileSize: undefined,
        }));
      } else {
        await clientMedicalApi.clearLiverFile(id);
        setLiverReplacementFile(null);
        setFormData(prev => ({
          ...prev,
          liverPanelStatus: 'pending',
          liverPanelFilePath: '',
          liverPanelFileName: '',
          liverPanelFileSize: undefined,
        }));
      }

      const refreshed = await medicalTrackingApi.getOne(id);
      setItem(refreshed.data);
    } catch (clearError: any) {
      console.error('Error clearing medical file:', clearError);
      setError(clearError?.response?.data?.message || 'Failed to remove file from the record.');
    }
  };

  return (
    <div className="p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/medical-tracking/${id}`)}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            <Icon icon={FiArrowLeft} className="w-5 h-5" />
            Back
          </button>
          <div>
            <h1 className="text-2xl font-bold">Edit Medical Tracking</h1>
            <p className="text-sm text-gray-600">
              Record #{(item as any).display_id || 'n/a'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-4xl bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
              <SearchableClientDropdown
                clients={clients}
                selectedClientId={currentClientId}
                onClientSelect={(clientId) => setFormData(prev => ({ ...prev, clientId }))}
                placeholder="Select a client"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Retreat ID</label>
              <select
                value={currentRetreatId}
                onChange={(e) => setFormData(prev => ({ ...prev, retreatId: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="">Select a retreat</option>
                {currentRetreatId && !selectedRetreatExists && (
                  <option value={currentRetreatId}>
                    Current retreat {currentRetreatId}
                  </option>
                )}
                {retreatOptions.map((retreat) => (
                  <option key={retreat._id} value={retreat._id}>
                    {retreat.name}
                    {retreat.location ? ` - ${retreat.location}` : ''}
                    {retreat.status ? ` (${retreat.status})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">EKG Status</label>
                <select
                  value={formData.ekgStatus}
                  onChange={(e) => setFormData(prev => ({ ...prev, ekgStatus: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="pending">Pending</option>
                  <option value="received">Received</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Liver Status</label>
                <select
                  value={formData.liverPanelStatus}
                  onChange={(e) => setFormData(prev => ({ ...prev, liverPanelStatus: e.target.value }))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="pending">Pending</option>
                  <option value="received">Received</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={formData.finalMedicalClearance}
                onChange={(e) => setFormData(prev => ({ ...prev, finalMedicalClearance: e.target.checked }))}
              />
              Final medical clearance
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medical Advisor Name</label>
              <input
                type="text"
                value={formData.medicalAdvisorName}
                onChange={(e) => setFormData(prev => ({ ...prev, medicalAdvisorName: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medical Advisor Email</label>
              <input
                type="email"
                value={formData.medicalAdvisorEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, medicalAdvisorEmail: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medical Clearance Notes</label>
              <textarea
                value={formData.medicalClearanceNotes}
                onChange={(e) => setFormData(prev => ({ ...prev, medicalClearanceNotes: e.target.value }))}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">EKG Notes</label>
            <textarea
              value={formData.ekgAdvisorNotes}
              onChange={(e) => setFormData(prev => ({ ...prev, ekgAdvisorNotes: e.target.value }))}
              rows={4}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Liver Notes</label>
            <textarea
              value={formData.liverPanelAdvisorNotes}
              onChange={(e) => setFormData(prev => ({ ...prev, liverPanelAdvisorNotes: e.target.value }))}
              rows={4}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {medicalFileSections.map((section) => {
            const fileName = section.fileName || getFilenameFromPath(section.filePath || '');
            const hasFile = Boolean(section.filePath || fileName);
            const isImage = fileName ? isImageFile(fileName) : false;

            return (
              <div key={section.label} className="rounded-lg border border-gray-200 p-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-base font-semibold text-gray-900">{section.label}</h3>
                  {hasFile ? (
                    <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
                      File uploaded
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2 py-1 rounded-full">
                      No files
                    </span>
                  )}
                </div>

                {hasFile ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {isImage ? <Icon icon={FiImage} className="w-5 h-5 text-blue-500" /> : <Icon icon={FiFileText} className="w-5 h-5 text-gray-500" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => navigate(`/medical-tracking/${id}/view/${section.type}`)}
                          className="text-left text-sm font-medium text-blue-700 hover:underline truncate block"
                        >
                          {fileName}
                        </button>
                        <div className="text-xs text-gray-500">
                          {section.fileSize ? `${(section.fileSize / 1024 / 1024).toFixed(2)} MB` : 'File size unavailable'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <AppleButton
                        type="button"
                        variant="secondary"
                        onClick={() => clearMedicalFile(section.type)}
                      >
                        <Icon icon={FiTrash2} className="mr-2" />
                        Remove from record
                      </AppleButton>
                      <label className="inline-flex items-center gap-2 text-sm text-blue-700 cursor-pointer">
                        <Icon icon={FiUpload} className="w-4 h-4" />
                        Replace file
                        <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                          onChange={(e) => {
                            if (section.type === 'ekg') {
                              setEkgReplacementFile(e.target.files?.[0] || null);
                            } else {
                              setLiverReplacementFile(e.target.files?.[0] || null);
                            }
                          }}
                        />
                      </label>
                    </div>

                    {section.replacementFile && (
                      <div className="text-xs text-gray-600">
                        Replacement selected: {section.replacementFile.name}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm text-gray-500">No files uploaded.</div>
                    <label className="inline-flex items-center gap-2 text-sm text-blue-700 cursor-pointer">
                      <Icon icon={FiUpload} className="w-4 h-4" />
                      Upload file
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => {
                          if (section.type === 'ekg') {
                            setEkgReplacementFile(e.target.files?.[0] || null);
                          } else {
                            setLiverReplacementFile(e.target.files?.[0] || null);
                          }
                        }}
                      />
                    </label>
                    {section.replacementFile && (
                      <div className="text-xs text-gray-600">
                        Selected file: {section.replacementFile.name}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">General Notes</label>
          <textarea
            value={formData.generalNotes}
            onChange={(e) => setFormData(prev => ({ ...prev, generalNotes: e.target.value }))}
            rows={4}
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <AppleButton type="button" variant="secondary" onClick={() => navigate(`/medical-tracking/${id}`)}>
            Cancel
          </AppleButton>
          <AppleButton type="submit" disabled={isSaving}>
            <Icon icon={FiSave} className="mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </AppleButton>
        </div>
      </form>
    </div>
  );
};

export default MedicalTrackingEditPage;
