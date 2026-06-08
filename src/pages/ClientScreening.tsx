import React, { useState, useEffect, ChangeEvent } from 'react';
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
  heartCondition: string;
  liverCondition: string;
  asthmaCondition: string;
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
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
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
    age: 0,
    screeningDate: new Date().toISOString().split('T')[0],
    riskLevel: 1,
    heartCondition: '',
    liverCondition: '',
    asthmaCondition: '',
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
        heartCondition: existingValue('heartCondition', 'heartConditions') ?? prev.heartCondition,
        liverCondition: existingValue('liverCondition', 'liverConditions') ?? prev.liverCondition,
        asthmaCondition: existingValue('asthmaCondition', 'asthmaConditions') ?? prev.asthmaCondition,
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

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setFormData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const bloodPressure = [
        formData.bloodPressureStatus,
        formData.bloodPressureValue,
      ].filter(Boolean).join(' - ');
      const response = await screeningApi.create({
        ...formData,
        bloodPressure: bloodPressure || formData.bloodPressure,
      });
      const rolePrefix = user?.role === 'admin' ? '/admin' : '';
      navigate(`${rolePrefix}/clients/${clientId}?tab=screening`, {
        replace: true,
        state: { refreshClient: true, client: response.data },
      });
    } catch (error) {
      console.error('Error saving screening:', error);
      setSaving(false);
    }
  };

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
          <AppleButton variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Screening'}
          </AppleButton>
        </div>
      </div>

      {/* Client Info Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Client Information</h2>
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
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Screening Information</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Main Intent</label>
            <textarea
              name="mainIntent"
              value={formData.mainIntent}
              onChange={handleInputChange}
              rows={3}
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
                value={formData.age}
                onChange={handleInputChange}
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
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Health Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Heart Condition</label>
            <textarea
              name="heartCondition"
              value={formData.heartCondition}
              onChange={handleInputChange}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Liver Condition</label>
            <textarea
              name="liverCondition"
              value={formData.liverCondition}
              onChange={handleInputChange}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Asthma</label>
            <textarea
              name="asthmaCondition"
              value={formData.asthmaCondition}
              onChange={handleInputChange}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-md"
            />
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
        </div>
      </div>

      {/* Vitamins and Supplements */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Vitamins & Supplements</h2>

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
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Substance History</h2>

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
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Plant Medicine Experience</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </div>

      {/* Handwriting Upload */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Handwriting Upload</h2>

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
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Additional Information</h2>

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
        <AppleButton variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Screening'}
        </AppleButton>
      </div>
    </div>
  );
};

export default ClientScreening;
