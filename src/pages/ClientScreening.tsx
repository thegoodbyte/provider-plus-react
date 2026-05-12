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
  age: number;
  screeningDate: string;
  riskLevel: number;
  heartCondition: string;
  liverCondition: string;
  asthmaCondition: string;
  medications: string;
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
    age: 0,
    screeningDate: new Date().toISOString().split('T')[0],
    riskLevel: 1,
    heartCondition: '',
    liverCondition: '',
    asthmaCondition: '',
    medications: '',
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

      // Pre-populate client info
      setFormData(prev => ({
        ...prev,
        firstName: clientData.firstName || '',
        lastName: clientData.lastName || '',
        displayId: clientData.display_id || 0,
        phoneNumber: clientData.phone || ''
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
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      // First save the screening to get an ID
      let screeningId = formData.clientId;

      // Upload image
      const response = await screeningApi.uploadHandwriting(screeningId, formDataUpload);
      setFormData(prev => ({ ...prev, handwritingImageUrl: response.data.imageUrl }));
      setUploadingImage(false);
    } catch (error) {
      console.error('Error uploading image:', error);
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await screeningApi.create(formData);
      navigate(-1);
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Blood Pressure</label>
            <input
              type="text"
              name="bloodPressure"
              value={formData.bloodPressure}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-md"
            />
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
          {uploadingImage && <p className="mt-2 text-sm text-gray-500">Uploading...</p>}
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