import React, { useState, useEffect, useCallback, useRef } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { housesApi } from '../services/api';
import { House } from '../types';
import AppleButton from './AppleButton';
import { FiPlus, FiEdit2, FiTrash2, FiHome, FiUsers, FiDollarSign } from 'react-icons/fi';

// Simple wrapper to fix TypeScript icon issues
const Icon: React.FC<{ icon: any; className?: string }> = ({ icon: IconComponent, className }) => {
  return <IconComponent className={className} />;
};

const cropImageToHeroBanner = (file: File, width = 1200, height = 250): Promise<File> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file.'));
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Image editor is not available in this browser.');

        const sourceRatio = image.naturalWidth / image.naturalHeight;
        const targetRatio = width / height;
        let sourceWidth = image.naturalWidth;
        let sourceHeight = image.naturalHeight;
        let sourceX = 0;
        let sourceY = 0;

        if (sourceRatio > targetRatio) {
          sourceWidth = image.naturalHeight * targetRatio;
          sourceX = (image.naturalWidth - sourceWidth) / 2;
        } else {
          sourceHeight = image.naturalWidth / targetRatio;
          sourceY = (image.naturalHeight - sourceHeight) / 2;
        }

        context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) {
            reject(new Error('Could not prepare house hero image.'));
            return;
          }
          const baseName = file.name.replace(/\.[^/.]+$/, '').trim() || 'house-hero';
          resolve(new File([blob], `${baseName}-hero.jpg`, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.9);
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read this image file.'));
    };

    image.src = objectUrl;
  });
};

const HousesGrid: React.FC = () => {
  const [houses, setHouses] = useState<House[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHouse, setEditingHouse] = useState<House | null>(null);
  const [formData, setFormData] = useState<Partial<House>>({});
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [heroImageUploading, setHeroImageUploading] = useState(false);
  const heroImageInputRef = useRef<HTMLInputElement | null>(null);

  const fetchHouses = useCallback(async () => {
    try {
      console.log('Fetching houses...');
      setIsLoading(true);
      setApiError(false);
      const response = await housesApi.getAll();
      console.log('Houses data:', response.data);
      setHouses(response.data || []);
    } catch (error: any) {
      console.error('Error fetching houses:', error);
      setHouses([]);
      setApiError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHouses();
  }, [fetchHouses]);

  const handleAdd = () => {
    setEditingHouse(null);
    setHeroImageUrl(null);
    setFormData({
      status: 'available',
      amenities: []
    });
    setIsModalOpen(true);
  };

  const handleEdit = (house: House) => {
    setEditingHouse(house);
    setHeroImageUrl(null);
    // Convert legacy format to new format for editing
    const formattedHouse = {
      ...house,
      name: house.name || house.city || '',
      capacity: house.capacity || house.guestCapacity || 0,
      numberOfRooms: house.numberOfRooms || house.bedrooms || 0,
      amenities: house.amenities || []
    };
    setFormData(formattedHouse);
    setIsModalOpen(true);
    if (house._id && house.heroImageS3Key) {
      housesApi.getHeroImageUrl(house._id)
        .then((response) => setHeroImageUrl(response.data.heroImageUrl || null))
        .catch((error) => console.error('Error loading house hero image:', error));
    }
  };

  const updateHouseInList = (house: House) => {
    setHouses((current) => current.map((item) => item._id === house._id ? house : item));
    setEditingHouse(house);
    setFormData((current) => ({ ...current, ...house }));
  };

  const handleHeroImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!editingHouse?._id || !file) return;

    try {
      setHeroImageUploading(true);
      const croppedFile = await cropImageToHeroBanner(file);
      const response = await housesApi.uploadHeroImage(editingHouse._id, croppedFile);
      updateHouseInList(response.data.house);
      setHeroImageUrl(response.data.heroImageUrl);
    } catch (error: any) {
      console.error('Error uploading house hero image:', error);
      alert(error?.response?.data?.message || error?.message || 'Failed to upload house hero image.');
    } finally {
      setHeroImageUploading(false);
    }
  };

  const handleClearHeroImage = async () => {
    if (!editingHouse?._id) return;
    if (!window.confirm('Remove the default hero image from this house?')) return;

    try {
      const response = await housesApi.clearHeroImage(editingHouse._id);
      updateHouseInList(response.data.house);
      setHeroImageUrl(null);
    } catch (error: any) {
      console.error('Error removing house hero image:', error);
      alert(error?.response?.data?.message || error?.message || 'Failed to remove house hero image.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this house?')) {
      try {
        await housesApi.delete(id);
        fetchHouses();
      } catch (error: any) {
        console.error('Error deleting house:', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log('Submitting house with data:', formData);

      // Clean and prepare data for submission
      const cleanData: any = {};

      if (formData.name?.trim()) cleanData.name = formData.name.trim();
      if (formData.address?.trim()) cleanData.address = formData.address.trim();
      if (formData.generalTown?.trim()) cleanData.generalTown = formData.generalTown.trim();
      if (formData.googleMapLink?.trim()) cleanData.googleMapLink = formData.googleMapLink.trim();
      if (editingHouse || formData.onlineProfileLink?.trim()) cleanData.onlineProfileLink = formData.onlineProfileLink?.trim() || '';
      if (formData.capacity && formData.capacity > 0) cleanData.capacity = Number(formData.capacity);
      if (formData.numberOfRooms && formData.numberOfRooms > 0) cleanData.numberOfRooms = Number(formData.numberOfRooms);
      if (formData.numberOfBathrooms && formData.numberOfBathrooms > 0) cleanData.numberOfBathrooms = Number(formData.numberOfBathrooms);
      if (formData.amenities) cleanData.amenities = formData.amenities;
      if (formData.description?.trim()) cleanData.description = formData.description.trim();
      if (formData.status) cleanData.status = formData.status;
      if (formData.pricePerNight && formData.pricePerNight > 0) cleanData.pricePerNight = Number(formData.pricePerNight);

      console.log('Cleaned house data:', cleanData);

      if (editingHouse) {
        await housesApi.update(editingHouse._id!, cleanData);
      } else {
        await housesApi.create(cleanData);
      }
      setIsModalOpen(false);
      setFormData({});
      setEditingHouse(null);
      fetchHouses();
    } catch (error: any) {
      console.error('Error saving house:', error);
      console.error('Error response:', error.response?.data);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'amenities') {
      // Handle amenities as comma-separated values
      setFormData(prev => ({
        ...prev,
        [name]: value.split(',').map(item => item.trim()).filter(item => item)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: ['capacity', 'numberOfRooms', 'numberOfBathrooms', 'pricePerNight'].includes(name) ? parseInt(value) : value
      }));
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading houses..." />;
  }

  return (
    <div className="p-6 h-full">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Houses Management</h1>
        <AppleButton onClick={handleAdd} className="apple-button-primary">
          <Icon icon={FiPlus} className="w-4 h-4 mr-2" />
          Add New House
        </AppleButton>
      </div>

      {apiError && (
        <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-md">
          API Error: Unable to load houses data
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  House Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  General Town
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Online Profile
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Capacity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rooms
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price/Week
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hero
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {houses.map((house) => (
                <tr key={house._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Icon icon={FiHome} className="w-5 h-5 mr-3 text-gray-400" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {house.name || house.city || 'Unnamed House'}
                        </div>
                        <div className="text-sm text-gray-500">{house.city}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {house.address || 'No address'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {house.generalTown || house.city || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {house.onlineProfileLink ? (
                      <a
                        href={house.onlineProfileLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-blue-600 hover:text-blue-800"
                      >
                        Open
                      </a>
                    ) : (
                      <span className="text-gray-400">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Icon icon={FiUsers} className="w-4 h-4 mr-1 text-gray-400" />
                      {house.capacity || house.guestCapacity || 0} guests
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {house.numberOfRooms || house.bedrooms || 0} rooms
                    {house.numberOfBathrooms && ` / ${house.numberOfBathrooms} baths`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Icon icon={FiDollarSign} className="w-4 h-4 mr-1 text-gray-400" />
                      {house.pricePerNight ? `$${house.pricePerNight}` : 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {house.bookingSource || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {house.heroImageS3Key ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Default
                      </span>
                    ) : (
                      <span className="text-gray-400">None</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(house)}
                        className="icon-action-btn icon-action-btn-edit"
                        title="Edit"
                      >
                        <Icon icon={FiEdit2} />
                      </button>
                      <button
                        onClick={() => handleDelete(house._id!)}
                        className="icon-action-btn icon-action-btn-danger"
                        title="Delete"
                      >
                        <Icon icon={FiTrash2} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {houses.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No houses found
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-700">
        Showing {houses.length} house{houses.length !== 1 ? 's' : ''}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingHouse ? 'Edit House' : 'Add New House'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  House Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                  Address
                </label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address || ''}
                  onChange={handleInputChange}
                  required
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="generalTown" className="block text-sm font-medium text-gray-700">
                  General Town
                </label>
                <input
                  type="text"
                  id="generalTown"
                  name="generalTown"
                  value={formData.generalTown || ''}
                  onChange={handleInputChange}
                  placeholder="Jablonne nad Orlici"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="googleMapLink" className="block text-sm font-medium text-gray-700">
                  Google map link
                </label>
                <input
                  type="url"
                  id="googleMapLink"
                  name="googleMapLink"
                  value={formData.googleMapLink || ''}
                  onChange={handleInputChange}
                  placeholder="https://maps.app.goo.gl/..."
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="onlineProfileLink" className="block text-sm font-medium text-gray-700">
                  Online profile link
                </label>
                <input
                  type="url"
                  id="onlineProfileLink"
                  name="onlineProfileLink"
                  value={formData.onlineProfileLink || ''}
                  onChange={handleInputChange}
                  placeholder="https://..."
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>

              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900">Default house hero image</div>
                    <div className="text-xs text-gray-500">Used by retreats assigned to this house unless the retreat has its own hero.</div>
                  </div>
                  {editingHouse?._id && (
                    <div className="flex shrink-0 items-center gap-2">
                      <input
                        ref={heroImageInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleHeroImageSelect}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => heroImageInputRef.current?.click()}
                        disabled={heroImageUploading}
                        className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                      >
                        {heroImageUploading ? 'Uploading...' : 'Upload'}
                      </button>
                      {formData.heroImageS3Key && (
                        <button
                          type="button"
                          onClick={handleClearHeroImage}
                          className="rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {editingHouse?._id ? (
                  heroImageUrl ? (
                    <div
                      className="h-24 rounded-md border border-gray-200 bg-cover bg-center"
                      style={{ backgroundImage: `url(${heroImageUrl})` }}
                    />
                  ) : (
                    <div className="rounded-md border border-dashed border-gray-300 bg-white px-3 py-6 text-center text-xs text-gray-500">
                      No default hero image uploaded.
                    </div>
                  )
                ) : (
                  <div className="rounded-md border border-dashed border-gray-300 bg-white px-3 py-6 text-center text-xs text-gray-500">
                    Save the house first, then upload its default hero image.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="capacity" className="block text-sm font-medium text-gray-700">
                    Guest Capacity
                  </label>
                  <input
                    type="number"
                    id="capacity"
                    name="capacity"
                    value={formData.capacity || ''}
                    onChange={handleInputChange}
                    min="1"
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="numberOfRooms" className="block text-sm font-medium text-gray-700">
                    Rooms
                  </label>
                  <input
                    type="number"
                    id="numberOfRooms"
                    name="numberOfRooms"
                    value={formData.numberOfRooms || ''}
                    onChange={handleInputChange}
                    min="1"
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="numberOfBathrooms" className="block text-sm font-medium text-gray-700">
                    Bathrooms
                  </label>
                  <input
                    type="number"
                    id="numberOfBathrooms"
                    name="numberOfBathrooms"
                    value={formData.numberOfBathrooms || ''}
                    onChange={handleInputChange}
                    min="1"
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="pricePerNight" className="block text-sm font-medium text-gray-700">
                    Price/Week ($)
                  </label>
                  <input
                    type="number"
                    id="pricePerNight"
                    name="pricePerNight"
                    value={formData.pricePerNight || ''}
                    onChange={handleInputChange}
                    min="0"
                    step="0.01"
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="bookingSource" className="block text-sm font-medium text-gray-700">
                  Booking Source
                </label>
                <select
                  id="bookingSource"
                  name="bookingSource"
                  value={formData.bookingSource || 'Airbnb'}
                  onChange={handleInputChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="Airbnb">Airbnb</option>
                  <option value="Owner">Owner</option>
                </select>
              </div>

              <div className="flex items-center space-x-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="allInclusive"
                    checked={formData.allInclusive || false}
                    onChange={(e) => setFormData(prev => ({ ...prev, allInclusive: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-900">All Inclusive</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="payingForElectricity"
                    checked={formData.payingForElectricity || false}
                    onChange={(e) => setFormData(prev => ({ ...prev, payingForElectricity: e.target.checked }))}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-900">Paying for Electricity</span>
                </label>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description || ''}
                  onChange={handleInputChange}
                  rows={3}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HousesGrid;
