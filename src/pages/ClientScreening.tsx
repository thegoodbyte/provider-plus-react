import React, { useState, useEffect, ChangeEvent, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppleButton from '../components/AppleButton';
import { clientsApi, screeningApi } from '../services/api';
import { Client } from '../types';

interface ScreeningData {
  clientId: string;
  firstName: string;
  lastName: string;
  displayId: number;
  phoneNumber: string;
  mainIntent: string;
  childhood: string;
  sexualAbuse: boolean;
  sexualAbuseDetails: string;
  physicalAbuse: boolean;
  physicalAbuseDetails: string;
  psychologicalAbuse: boolean;
  psychologicalAbuseDetails: string;
  age: number;
  screeningDate: string;
  riskLevel: number;
  heartConditionOk: boolean;
  heartCondition: string;
  liverConditionOk: boolean;
  liverCondition: string;
  asthmaConditionOk: boolean;
  asthmaCondition: string;
  depression: boolean;
  depressionDetails: string;
  anxiety: boolean;
  anxietyDetails: string;
  medications: string;
  ssris: string;
  drugsHistory: string;
  marijuana: boolean;
  marijuanaDetails: string;
  cocaine: boolean;
  cocaineDetails: string;
  meth: boolean;
  methDetails: string;
  heroin: boolean;
  heroinDetails: string;
  benzos: boolean;
  benzosDetails: string;
  alcoholHistory: string;
  healthComplications: string;
  bloodPressure: string;
  bloodPressureStatus: string;
  bloodPressureValue: string;
  ekgRequested: boolean;
  liverPanelRequested: boolean;
  medicalTestsDetails: string;
  vitaminsSupplements: {
    vitaminD: boolean;
    vitaminB12: boolean;
    vitaminC: boolean;
    omega3: boolean;
    magnesium: boolean;
    zinc: boolean;
    iron: boolean;
    probiotics: boolean;
    multivitamin: boolean;
    creatine: boolean;
    other: boolean;
    details: string;
  };
  plantMedicineExperience: boolean;
  ayahuasca: boolean;
  ayahuascaDetails: string;
  iboga: boolean;
  ibogaDetails: string;
  psilocybin: boolean;
  psilocybinDetails: string;
  bufo: boolean;
  bufoDetails: string;
  kambo: boolean;
  kamboDetails: string;
  sanPedro: boolean;
  sanPedroDetails: string;
  mescaline: boolean;
  mescalineDetails: string;
  dmt: boolean;
  dmtDetails: string;
  ketamine: boolean;
  ketamineDetails: string;
  mdma: boolean;
  mdmaDetails: string;
  handwritingImageUrl: string;
  riskNotes: string;
  generalNotes: string;
  desiredRetreat: string;
  quotedPrice: string;
  screenedBy: string;
  status: string;
}

const sectionStyles = {
  client: {
    container: 'bg-slate-50 rounded-lg border border-slate-200 p-6 mb-6 shadow-sm',
    heading: 'text-lg font-semibold mb-4 text-slate-800',
  },
  context: {
    container: 'bg-amber-50 rounded-lg border border-amber-200 p-6 mb-6 shadow-sm',
    heading: 'text-lg font-semibold mb-4 text-amber-900',
  },
  health: {
    container: 'bg-green-50 rounded-lg border border-green-200 p-6 mb-6 shadow-sm',
    heading: 'text-lg font-semibold mb-4 text-green-900',
  },
  vitamins: {
    container: 'bg-sky-50 rounded-lg border border-sky-200 p-6 mb-6 shadow-sm',
    heading: 'text-lg font-semibold mb-4 text-sky-900',
  },
  substances: {
    container: 'bg-rose-50 rounded-lg border border-rose-200 p-6 mb-6 shadow-sm',
    heading: 'text-lg font-semibold mb-4 text-rose-900',
  },
  plantMedicine: {
    container: 'bg-violet-50 rounded-lg border border-violet-200 p-6 mb-6 shadow-sm',
    heading: 'text-lg font-semibold mb-4 text-violet-900',
  },
  files: {
    container: 'bg-gray-50 rounded-lg border border-gray-200 p-6 mb-6 shadow-sm',
    heading: 'text-lg font-semibold mb-4 text-gray-900',
  },
  notes: {
    container: 'bg-yellow-50 rounded-lg border border-yellow-200 p-6 mb-6 shadow-sm',
    heading: 'text-lg font-semibold mb-4 text-yellow-900',
  },
};

const compressScreeningImage = (file: File, maxDimension = 1800, quality = 0.82): Promise<File> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      try {
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Image compression is not available in this browser.');

        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);

        canvas.toBlob((blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) {
            reject(new Error('Could not compress screening image.'));
            return;
          }

          const originalBaseName = file.name.replace(/\.[^/.]+$/, '').trim() || 'screening';
          const compressed = new File([blob], `${originalBaseName}-compressed.jpg`, { type: 'image/jpeg' });
          resolve(compressed.size < file.size ? compressed : file);
        }, 'image/jpeg', quality);
      } catch (compressionError) {
        URL.revokeObjectURL(objectUrl);
        reject(compressionError);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read this screening image.'));
    };

    image.src = objectUrl;
  });
};

const ClientScreening: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const mainIntentRef = useRef<HTMLTextAreaElement | null>(null);
  const saveMessageTimeoutRef = useRef<number | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [formData, setFormData] = useState<ScreeningData>({
    clientId: clientId || '',
    firstName: '',
    lastName: '',
    displayId: 0,
    phoneNumber: '',
    mainIntent: '',
    childhood: '',
    sexualAbuse: false,
    sexualAbuseDetails: '',
    physicalAbuse: false,
    physicalAbuseDetails: '',
    psychologicalAbuse: false,
    psychologicalAbuseDetails: '',
    age: undefined as any,
    screeningDate: new Date().toISOString().split('T')[0],
    riskLevel: 1,
    heartConditionOk: false,
    heartCondition: '',
    liverConditionOk: false,
    liverCondition: '',
    asthmaConditionOk: false,
    asthmaCondition: '',
    depression: false,
    depressionDetails: '',
    anxiety: false,
    anxietyDetails: '',
    medications: '',
    ssris: '',
    drugsHistory: '',
    marijuana: false,
    marijuanaDetails: '',
    cocaine: false,
    cocaineDetails: '',
    meth: false,
    methDetails: '',
    heroin: false,
    heroinDetails: '',
    benzos: false,
    benzosDetails: '',
    alcoholHistory: '',
    healthComplications: '',
    bloodPressure: '',
    bloodPressureStatus: '',
    bloodPressureValue: '',
    ekgRequested: false,
    liverPanelRequested: false,
    medicalTestsDetails: '',
    vitaminsSupplements: {
      vitaminD: false,
      vitaminB12: false,
      vitaminC: false,
      omega3: false,
      magnesium: false,
      zinc: false,
      iron: false,
      probiotics: false,
      multivitamin: false,
      creatine: false,
      other: false,
      details: '',
    },
    plantMedicineExperience: false,
    ayahuasca: false,
    ayahuascaDetails: '',
    iboga: false,
    ibogaDetails: '',
    psilocybin: false,
    psilocybinDetails: '',
    bufo: false,
    bufoDetails: '',
    kambo: false,
    kamboDetails: '',
    sanPedro: false,
    sanPedroDetails: '',
    mescaline: false,
    mescalineDetails: '',
    dmt: false,
    dmtDetails: '',
    ketamine: false,
    ketamineDetails: '',
    mdma: false,
    mdmaDetails: '',
    handwritingImageUrl: '',
    riskNotes: '',
    generalNotes: '',
    desiredRetreat: '',
    quotedPrice: '',
    screenedBy: user?.username || '',
    status: 'pending'
  });

  useEffect(() => {
    fetchClient();
  }, [clientId]);

  useEffect(() => {
    return () => {
      if (saveMessageTimeoutRef.current) {
        window.clearTimeout(saveMessageTimeoutRef.current);
      }
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Auto-save when form changes
  useEffect(() => {
    if (hasChanges && !loading && formData.clientId) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      autoSaveTimeoutRef.current = setTimeout(() => {
        handleAutoSave();
      }, 2000); // Auto-save after 2 seconds of inactivity
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [formData, hasChanges]);

  const fetchClient = async () => {
    if (!clientId) return;

    try {
      const response = await clientsApi.getOne(clientId);
      const clientData = response.data;
      setClient(clientData);
      const existingScreening = clientData.screeningData || {};
      const existingValue = (screeningKey: keyof ScreeningData, ...clientKeys: string[]) => {
        const screeningValue = existingScreening[screeningKey as string];
        if (screeningValue !== undefined && screeningValue !== null && screeningValue !== '') return screeningValue;
        for (const key of clientKeys) {
          const clientValue = (clientData as any)[key];
          if (clientValue !== undefined && clientValue !== null && clientValue !== '') return clientValue;
        }
        return undefined;
      };
      const heartCondition = existingValue('heartCondition', 'heartConditions') ?? '';
      const liverCondition = existingValue('liverCondition', 'liverConditions') ?? '';
      const asthmaCondition = existingValue('asthmaCondition', 'asthmaConditions') ?? '';
      const plantMedicineFields = [
        'ayahuasca',
        'iboga',
        'psilocybin',
        'bufo',
        'kambo',
        'sanPedro',
        'mescaline',
        'dmt',
        'ketamine',
        'mdma',
      ];
      const hasPlantMedicineExperience = existingScreening.plantMedicineExperience === true
        || plantMedicineFields.some((field) => Boolean(existingScreening[field] || existingScreening[`${field}Details`]));

      // Pre-populate client info
      setFormData(prev => ({
        ...prev,
        ...existingScreening,
        clientId,
        firstName: clientData.firstName || '',
        lastName: clientData.lastName || '',
        displayId: clientData.display_id || 0,
        phoneNumber: clientData.phone || '',
        mainIntent: existingValue('mainIntent', 'whySeekingIboga') ?? prev.mainIntent,
        riskNotes: existingValue('riskNotes', 'whatToChange') ?? prev.riskNotes,
        childhood: existingValue('childhood', 'childhood') ?? prev.childhood,
        heartConditionOk: existingScreening.heartConditionOk === true || heartCondition === 'OK',
        heartCondition,
        liverConditionOk: existingScreening.liverConditionOk === true || liverCondition === 'OK',
        liverCondition,
        asthmaConditionOk: existingScreening.asthmaConditionOk === true || asthmaCondition === 'OK',
        asthmaCondition,
        depression: existingScreening.depression === true,
        depressionDetails: existingValue('depressionDetails') ?? prev.depressionDetails,
        anxiety: existingScreening.anxiety === true,
        anxietyDetails: existingValue('anxietyDetails') ?? prev.anxietyDetails,
        medications: existingValue('medications', 'currentMedications') ?? prev.medications,
        drugsHistory: existingValue('drugsHistory', 'recreationalDrugs', 'addictionHistory') ?? prev.drugsHistory,
        alcoholHistory: existingValue('alcoholHistory', 'alcoholConsumption') ?? prev.alcoholHistory,
        healthComplications: existingValue('healthComplications', 'otherMedicalComplications') ?? prev.healthComplications,
        bloodPressure: existingValue('bloodPressure', 'bloodPressureIssues') ?? prev.bloodPressure,
        bloodPressureStatus: existingValue('bloodPressureStatus') ?? prev.bloodPressureStatus,
        bloodPressureValue: existingValue('bloodPressureValue') ?? prev.bloodPressureValue,
        vitaminsSupplements: {
          ...prev.vitaminsSupplements,
          ...(typeof existingScreening.vitaminsSupplements === 'object' && existingScreening.vitaminsSupplements
            ? existingScreening.vitaminsSupplements
            : {}),
        },
        plantMedicineExperience: hasPlantMedicineExperience,
        generalNotes: existingValue('generalNotes', 'notes') ?? prev.generalNotes,
        handwritingImageUrl: existingValue('handwritingImageUrl', 'handwritingImageUrl') ?? prev.handwritingImageUrl,
        screeningDate: existingValue('screeningDate', 'screeningCompletedDate')
          ? new Date(existingValue('screeningDate', 'screeningCompletedDate') as string).toISOString().split('T')[0]
          : prev.screeningDate,
      }));

      setLoading(false);
    } catch (error) {
      console.error('Error fetching client:', error);
      setLoading(false);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setHasChanges(true);

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      if (['heartConditionOk', 'liverConditionOk', 'asthmaConditionOk'].includes(name)) {
        const conditionField = name.replace('Ok', '');
        setFormData(prev => ({
          ...prev,
          [name]: checked,
          [conditionField]: checked ? 'OK' : '',
        }));
        return;
      }
      if (name === 'plantMedicineExperience') {
        setFormData(prev => ({
          ...prev,
          plantMedicineExperience: checked,
          ...(!checked ? {
            ayahuasca: false,
            ayahuascaDetails: '',
            iboga: false,
            ibogaDetails: '',
            psilocybin: false,
            psilocybinDetails: '',
            bufo: false,
            bufoDetails: '',
            kambo: false,
            kamboDetails: '',
            sanPedro: false,
            sanPedroDetails: '',
            mescaline: false,
            mescalineDetails: '',
            dmt: false,
            dmtDetails: '',
            ketamine: false,
            ketamineDetails: '',
            mdma: false,
            mdmaDetails: '',
          } : {}),
        }));
        return;
      }
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const applyTextFormat = (format: 'bold' | 'italic' | 'heading' | 'bullet' | 'numbered' | 'quote') => {
    const textarea = mainIntentRef.current;
    if (!textarea) return;

    const value = formData.mainIntent || '';
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const selectedText = value.slice(selectionStart, selectionEnd);
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
    const lineEndIndex = value.indexOf('\n', selectionEnd);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const selectedLines = value.slice(lineStart, lineEnd);

    let nextValue = value;
    let nextSelectionStart = selectionStart;
    let nextSelectionEnd = selectionEnd;

    const wrapSelection = (prefix: string, suffix: string, placeholder: string) => {
      const text = selectedText || placeholder;
      nextValue = `${value.slice(0, selectionStart)}${prefix}${text}${suffix}${value.slice(selectionEnd)}`;
      nextSelectionStart = selectionStart + prefix.length;
      nextSelectionEnd = nextSelectionStart + text.length;
    };

    const prefixLines = (prefix: string, defaultText: string) => {
      const text = selectedLines || defaultText;
      const formatted = text
        .split('\n')
        .map((line, index) => {
          if (format === 'numbered') return `${index + 1}. ${line.replace(/^\d+\.\s*/, '') || defaultText}`;
          return `${prefix}${line.replace(/^([#>*-]\s*)/, '') || defaultText}`;
        })
        .join('\n');
      nextValue = `${value.slice(0, lineStart)}${formatted}${value.slice(lineEnd)}`;
      nextSelectionStart = lineStart;
      nextSelectionEnd = lineStart + formatted.length;
    };

    if (format === 'bold') wrapSelection('**', '**', 'important text');
    if (format === 'italic') wrapSelection('_', '_', 'emphasis');
    if (format === 'heading') prefixLines('### ', 'Section title');
    if (format === 'bullet') prefixLines('- ', 'List item');
    if (format === 'numbered') prefixLines('', 'List item');
    if (format === 'quote') prefixLines('> ', 'Quoted note');

    setFormData(prev => ({ ...prev, mainIntent: nextValue }));

    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextSelectionStart, nextSelectionEnd);
    });
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);

    try {
      const uploadFile = await compressScreeningImage(file);
      const formDataUpload = new FormData();
      formDataUpload.append('file', uploadFile);

      // First save the screening to get an ID
      let screeningId = formData.clientId;

      // Upload image
      const response = await screeningApi.uploadHandwriting(screeningId, formDataUpload);
      setFormData(prev => ({ ...prev, handwritingImageUrl: response.data.imageUrl }));
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleVitaminChange = (name: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      vitaminsSupplements: {
        ...prev.vitaminsSupplements,
        [name]: checked,
      },
    }));
  };

  const handleVitaminDetailsChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      vitaminsSupplements: {
        ...prev.vitaminsSupplements,
        details: value,
      },
    }));
  };

  const persistScreening = async () => {
    const bloodPressure = [
      formData.bloodPressureStatus,
      formData.bloodPressureValue,
    ].filter(Boolean).join(' - ');
    const mentalHealthParts = [
      formData.depression ? `Depression: ${formData.depressionDetails || 'yes'}` : '',
      formData.anxiety ? `Anxiety: ${formData.anxietyDetails || 'yes'}` : '',
    ].filter(Boolean);

    return screeningApi.create({
      ...formData,
      heartCondition: formData.heartConditionOk ? 'OK' : formData.heartCondition,
      liverCondition: formData.liverConditionOk ? 'OK' : formData.liverCondition,
      asthmaCondition: formData.asthmaConditionOk ? 'OK' : formData.asthmaCondition,
      bloodPressure: bloodPressure || formData.bloodPressure,
      mentalHealthHistory: mentalHealthParts.join('\n'),
    });
  };

  const flashSaveMessage = (message: string) => {
    setSaveMessage(message);
    if (saveMessageTimeoutRef.current) {
      window.clearTimeout(saveMessageTimeoutRef.current);
    }
    saveMessageTimeoutRef.current = window.setTimeout(() => {
      setSaveMessage('');
      saveMessageTimeoutRef.current = null;
    }, 2400);
  };

  const handleFloatingSave = async () => {
    setSaving(true);
    try {
      const response = await persistScreening();
      setClient(response.data);
      setHasChanges(false);
      flashSaveMessage('Screening saved.');
    } catch (error) {
      console.error('Error saving screening:', error);
      flashSaveMessage('Could not save screening.');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoSave = async () => {
    setSaving(true);
    try {
      const response = await persistScreening();
      setClient(response.data);
      setHasChanges(false);
      flashSaveMessage('Auto-saved.');
    } catch (error) {
      console.error('Error auto-saving screening:', error);
      flashSaveMessage('Could not auto-save screening.');
    } finally {
      setSaving(false);
    }
  };

  const formatButtonClass = 'inline-flex h-8 w-8 flex-none items-center justify-center rounded border border-gray-200 bg-transparent p-0 text-sm text-gray-700 hover:bg-white hover:text-gray-950 focus:outline-none focus:ring-2 focus:ring-blue-500';

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Client Screening Form</h1>
        <div className="flex gap-3">
          <AppleButton variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </AppleButton>
          <AppleButton variant="primary" onClick={handleFloatingSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Screening'}
          </AppleButton>
        </div>
      </div>

      {/* Client Info Section */}
      <div className={sectionStyles.client.container}>
        <h2 className={sectionStyles.client.heading}>Client Information</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input
              type="text"
              value={formData.firstName}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input
              type="text"
              value={formData.lastName}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display ID</label>
            <input
              type="text"
              value={formData.displayId}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="text"
              value={formData.phoneNumber}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50"
            />
          </div>
        </div>
      </div>

      {/* Main Screening Info */}
      <div className={sectionStyles.context.container}>
        <h2 className={sectionStyles.context.heading}>Screening Information</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Main Intent</label>
            <div className="mb-2 inline-flex w-auto flex-wrap gap-1 rounded-md border border-gray-200 bg-gray-50 p-1">
              <button type="button" onClick={() => applyTextFormat('bold')} className={`${formatButtonClass} font-bold`} title="Bold">
                B
              </button>
              <button type="button" onClick={() => applyTextFormat('italic')} className={`${formatButtonClass} italic`} title="Italic">
                I
              </button>
              <button type="button" onClick={() => applyTextFormat('heading')} className={`${formatButtonClass} font-semibold`} title="Heading">
                H
              </button>
              <button type="button" onClick={() => applyTextFormat('bullet')} className={formatButtonClass} title="Bullet list">
                •
              </button>
              <button type="button" onClick={() => applyTextFormat('numbered')} className={formatButtonClass} title="Numbered list">
                1.
              </button>
              <button type="button" onClick={() => applyTextFormat('quote')} className={formatButtonClass} title="Quote">
                “
              </button>
            </div>
            <textarea
              ref={mainIntentRef}
              name="mainIntent"
              value={formData.mainIntent}
              onChange={handleInputChange}
              rows={5}
              className="w-full px-3 py-2 border border-gray-200 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Childhood</label>
            <textarea
              name="childhood"
              value={formData.childhood}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-md"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="sexualAbuse"
                  checked={formData.sexualAbuse}
                  onChange={handleInputChange}
                  className="rounded"
                />
                <span className="text-sm font-medium text-gray-700">Sexual Abuse</span>
              </label>
              {formData.sexualAbuse && (
                <textarea
                  name="sexualAbuseDetails"
                  value={formData.sexualAbuseDetails}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-md"
                  placeholder="Details..."
                />
              )}
            </div>

            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="physicalAbuse"
                  checked={formData.physicalAbuse}
                  onChange={handleInputChange}
                  className="rounded"
                />
                <span className="text-sm font-medium text-gray-700">Physical Abuse</span>
              </label>
              {formData.physicalAbuse && (
                <textarea
                  name="physicalAbuseDetails"
                  value={formData.physicalAbuseDetails}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-md"
                  placeholder="Details..."
                />
              )}
            </div>

            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="psychologicalAbuse"
                  checked={formData.psychologicalAbuse}
                  onChange={handleInputChange}
                  className="rounded"
                />
                <span className="text-sm font-medium text-gray-700">Psychological Abuse</span>
              </label>
              {formData.psychologicalAbuse && (
                <textarea
                  name="psychologicalAbuseDetails"
                  value={formData.psychologicalAbuseDetails}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-md"
                  placeholder="Details..."
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
              <input
                type="number"
                name="age"
                value={formData.age || ''}
                onChange={handleInputChange}
                placeholder="Enter age"
                className="w-full px-3 py-2 border border-gray-200 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Screening Date</label>
              <input
                type="date"
                name="screeningDate"
                value={formData.screeningDate}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Risk Level (1-5)</label>
              <input
                type="number"
                name="riskLevel"
                value={formData.riskLevel}
                onChange={handleInputChange}
                min="1"
                max="5"
                className="w-full px-3 py-2 border border-gray-200 rounded-md"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Health Section */}
      <div className={sectionStyles.health.container}>
        <h2 className={sectionStyles.health.heading}>Health Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="mb-1 flex items-center justify-between gap-3">
              <label className="block text-sm font-medium text-gray-700">Heart Condition</label>
              <label className="flex items-center gap-2 text-sm font-medium text-green-700">
                <input
                  type="checkbox"
                  name="heartConditionOk"
                  checked={formData.heartConditionOk}
                  onChange={handleInputChange}
                  className="rounded"
                />
                OK
              </label>
            </div>
            {!formData.heartConditionOk && (
              <textarea
                name="heartCondition"
                value={formData.heartCondition}
                onChange={handleInputChange}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-md"
              />
            )}
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-3">
              <label className="block text-sm font-medium text-gray-700">Liver Condition</label>
              <label className="flex items-center gap-2 text-sm font-medium text-green-700">
                <input
                  type="checkbox"
                  name="liverConditionOk"
                  checked={formData.liverConditionOk}
                  onChange={handleInputChange}
                  className="rounded"
                />
                OK
              </label>
            </div>
            {!formData.liverConditionOk && (
              <textarea
                name="liverCondition"
                value={formData.liverCondition}
                onChange={handleInputChange}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-md"
              />
            )}
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-3">
              <label className="block text-sm font-medium text-gray-700">Asthma</label>
              <label className="flex items-center gap-2 text-sm font-medium text-green-700">
                <input
                  type="checkbox"
                  name="asthmaConditionOk"
                  checked={formData.asthmaConditionOk}
                  onChange={handleInputChange}
                  className="rounded"
                />
                OK
              </label>
            </div>
            {!formData.asthmaConditionOk && (
              <textarea
                name="asthmaCondition"
                value={formData.asthmaCondition}
                onChange={handleInputChange}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-md"
              />
            )}
          </div>
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                name="depression"
                checked={formData.depression}
                onChange={handleInputChange}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700">Depression</span>
            </label>
            {formData.depression && (
              <textarea
                name="depressionDetails"
                value={formData.depressionDetails}
                onChange={handleInputChange}
                rows={2}
                className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-md"
                placeholder="Current or past depression, treatment, severity, dates, hospitalizations, or notes"
              />
            )}
          </div>
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                name="anxiety"
                checked={formData.anxiety}
                onChange={handleInputChange}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700">Anxiety</span>
            </label>
            {formData.anxiety && (
              <textarea
                name="anxietyDetails"
                value={formData.anxietyDetails}
                onChange={handleInputChange}
                rows={2}
                className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-md"
                placeholder="Current or past anxiety, panic attacks, treatment, severity, dates, or notes"
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Medications/Pills</label>
            <textarea
              name="medications"
              value={formData.medications}
              onChange={handleInputChange}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SSRIs</label>
            <textarea
              name="ssris"
              value={formData.ssris}
              onChange={handleInputChange}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-md"
              placeholder="Current or recent SSRI medications, dose, and stop date if applicable"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Blood Pressure</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                name="bloodPressureStatus"
                value={formData.bloodPressureStatus}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-md"
              >
                <option value="">Select status...</option>
                <option value="higher">Higher</option>
                <option value="normal">Normal</option>
                <option value="lower">Lower</option>
                <option value="unknown">Unknown</option>
              </select>
              <input
                type="text"
                name="bloodPressureValue"
                value={formData.bloodPressureValue}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-md"
                placeholder="e.g. 120/80"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Health Complications</label>
            <textarea
              name="healthComplications"
              value={formData.healthComplications}
              onChange={handleInputChange}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Medical Tests Requested</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="ekgRequested"
                  checked={formData.ekgRequested}
                  onChange={handleInputChange}
                  className="mr-2"
                />
                <span>EKG Requested</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="liverPanelRequested"
                  checked={formData.liverPanelRequested}
                  onChange={handleInputChange}
                  className="mr-2"
                />
                <span>Liver Panel Requested</span>
              </label>
              <textarea
                name="medicalTestsDetails"
                value={formData.medicalTestsDetails}
                onChange={handleInputChange}
                placeholder="Additional details about medical tests..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-md mt-2"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Vitamins and Supplements */}
      <div className={sectionStyles.vitamins.container}>
        <h2 className={sectionStyles.vitamins.heading}>Vitamins & Supplements</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { name: 'vitaminD', label: 'Vitamin D' },
            { name: 'vitaminB12', label: 'Vitamin B12' },
            { name: 'vitaminC', label: 'Vitamin C' },
            { name: 'omega3', label: 'Omega-3' },
            { name: 'magnesium', label: 'Magnesium' },
            { name: 'zinc', label: 'Zinc' },
            { name: 'iron', label: 'Iron' },
            { name: 'probiotics', label: 'Probiotics' },
            { name: 'multivitamin', label: 'Multivitamin' },
            { name: 'creatine', label: 'Creatine' },
            { name: 'other', label: 'Other' },
          ].map(vitamin => (
            <label key={vitamin.name} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={Boolean((formData.vitaminsSupplements as any)[vitamin.name])}
                onChange={(e) => handleVitaminChange(vitamin.name, e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700">{vitamin.label}</span>
            </label>
          ))}
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">More Information</label>
          <textarea
            value={formData.vitaminsSupplements.details}
            onChange={(e) => handleVitaminDetailsChange(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-md"
            placeholder="Dose, frequency, brand, start date, or other supplement details"
          />
        </div>
      </div>

      {/* Drug History */}
      <div className={sectionStyles.substances.container}>
        <h2 className={sectionStyles.substances.heading}>Substance History</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">General Drug History</label>
          <textarea
            name="drugsHistory"
            value={formData.drugsHistory}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-md"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { name: 'marijuana', label: 'Marijuana' },
            { name: 'cocaine', label: 'Cocaine' },
            { name: 'meth', label: 'Meth' },
            { name: 'heroin', label: 'Heroin' },
            { name: 'benzos', label: 'Benzos' }
          ].map(drug => (
            <div key={drug.name}>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name={drug.name}
                  checked={formData[drug.name as keyof ScreeningData] as boolean}
                  onChange={handleInputChange}
                  className="rounded"
                />
                <span className="text-sm font-medium text-gray-700">{drug.label}</span>
              </label>
              {formData[drug.name as keyof ScreeningData] && (
                <input
                  type="text"
                  name={`${drug.name}Details`}
                  value={formData[`${drug.name}Details` as keyof ScreeningData] as string}
                  onChange={handleInputChange}
                  className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-md"
                  placeholder="Details..."
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Alcohol History</label>
          <textarea
            name="alcoholHistory"
            value={formData.alcoholHistory}
            onChange={handleInputChange}
            rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-md"
          />
        </div>
      </div>

      {/* Plant Medicines */}
      <div className={sectionStyles.plantMedicine.container}>
        <h2 className={sectionStyles.plantMedicine.heading}>Plant Medicine Experience</h2>

        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            name="plantMedicineExperience"
            checked={formData.plantMedicineExperience}
            onChange={handleInputChange}
            className="rounded"
          />
          <span className="text-sm font-medium text-gray-700">Has plant medicine experience</span>
        </label>

        {formData.plantMedicineExperience && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: 'ayahuasca', label: 'Ayahuasca' },
              { name: 'iboga', label: 'Iboga' },
              { name: 'psilocybin', label: 'Psilocybin' },
              { name: 'bufo', label: 'Bufo' },
              { name: 'kambo', label: 'Kambo' },
              { name: 'sanPedro', label: 'San Pedro' },
              { name: 'mescaline', label: 'Mescaline' },
              { name: 'dmt', label: 'DMT' },
              { name: 'ketamine', label: 'Ketamine' },
              { name: 'mdma', label: 'MDMA' }
            ].map(medicine => (
              <div key={medicine.name}>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name={medicine.name}
                    checked={formData[medicine.name as keyof ScreeningData] as boolean}
                    onChange={handleInputChange}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">{medicine.label}</span>
                </label>
                {formData[medicine.name as keyof ScreeningData] && (
                  <input
                    type="text"
                    name={`${medicine.name}Details`}
                    value={formData[`${medicine.name}Details` as keyof ScreeningData] as string}
                    onChange={handleInputChange}
                    className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-md"
                    placeholder="Experience details..."
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Handwriting Upload */}
      <div className={sectionStyles.files.container}>
        <h2 className={sectionStyles.files.heading}>Handwriting Upload</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Upload Handwriting Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            disabled={uploadingImage}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {uploadingImage && <p className="mt-2 text-sm text-gray-500">Compressing and uploading...</p>}
          {formData.handwritingImageUrl && (
            <div className="mt-4">
              <img
                src={formData.handwritingImageUrl}
                alt="Handwriting"
                className="max-w-md rounded-lg border border-gray-200"
              />
            </div>
          )}
        </div>
      </div>

      {/* Additional Notes */}
      <div className={sectionStyles.notes.container}>
        <h2 className={sectionStyles.notes.heading}>Additional Information</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Risk Notes</label>
            <textarea
              name="riskNotes"
              value={formData.riskNotes}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">General Notes</label>
            <textarea
              name="generalNotes"
              value={formData.generalNotes}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-md"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Desired Retreat</label>
              <input
                type="text"
                name="desiredRetreat"
                value={formData.desiredRetreat}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quoted Price</label>
              <textarea
                name="quotedPrice"
                value={formData.quotedPrice}
                onChange={handleInputChange}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-md"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex justify-end gap-3">
        <AppleButton variant="secondary" onClick={() => navigate(-1)}>
          Cancel
        </AppleButton>
        <AppleButton variant="primary" onClick={handleFloatingSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Screening'}
        </AppleButton>
      </div>

      {/* Floating Save Button */}
      <div style={{ position: 'fixed', bottom: '80px', right: '20px', zIndex: 9999 }}>
        <button
          onClick={handleFloatingSave}
          disabled={saving}
          style={{
            backgroundColor: saving ? '#9CA3AF' : '#2563EB',
            color: 'white',
            borderRadius: '50%',
            width: '60px',
            height: '60px',
            border: 'none',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            cursor: saving ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            if (!saving) {
              e.currentTarget.style.backgroundColor = '#1D4ED8';
              e.currentTarget.style.transform = 'scale(1.1)';
            }
          }}
          onMouseLeave={(e) => {
            if (!saving) {
              e.currentTarget.style.backgroundColor = '#2563EB';
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
          title="Save screening without leaving this page"
        >
          <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2" />
          </svg>
        </button>
        {saving && (
          <div style={{
            position: 'absolute',
            top: '-32px',
            right: '0',
            backgroundColor: '#1F2937',
            color: 'white',
            fontSize: '14px',
            padding: '4px 8px',
            borderRadius: '4px',
            whiteSpace: 'nowrap'
          }}>
            Saving...
          </div>
        )}
        {hasChanges && !saving && (
          <div style={{
            position: 'absolute',
            top: '0',
            right: '0',
            width: '12px',
            height: '12px',
            backgroundColor: '#EF4444',
            borderRadius: '50%',
            border: '2px solid white'
          }} />
        )}
      </div>

      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-3">
        {hasChanges && !saveMessage && (
          <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-700 px-3 py-2 text-sm shadow-lg animate-pulse">
            Auto-save pending...
          </div>
        )}
        {saveMessage && (
          <div className={`rounded-md border px-3 py-2 text-sm shadow-lg ${
            saveMessage.includes('Could not')
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-green-200 bg-green-50 text-green-700'
          }`}>
            {saveMessage}
          </div>
        )}
        <button
          type="button"
          onClick={handleFloatingSave}
          disabled={saving}
          className="inline-flex items-center px-6 py-3 rounded-full bg-blue-600 text-white font-medium shadow-lg hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all transform hover:scale-105"
          title="Save screening without leaving this page"
          aria-label="Save screening without leaving this page"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2" />
          </svg>
          {saving ? 'Saving...' : 'Save Progress'}
        </button>
      </div>
    </div>
  );
};

export default ClientScreening;
