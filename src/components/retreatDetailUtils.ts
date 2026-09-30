import { House, Retreat } from '../types';

export const getHouseIdValue = (houseId?: string | House) => {
  if (!houseId) return '';
  return typeof houseId === 'string' ? houseId : houseId._id || '';
};

export const getHouseTown = (house?: House | null) =>
  String(house?.generalTown || house?.general_town || house?.city || house?.name || '').trim();

// PPVC-703: retreatsApi.getOne returns houseId populated as a full House
// object (not just an id), so its bedrooms are already available on the
// retreat -- no separate house fetch needed for the room-allocation dropdown.
export const getRetreatHouseBedrooms = (retreat?: { houseId?: string | House } | null): Array<{ name: string; hasBathroom?: boolean; allowsSharing?: boolean }> => {
  const house = retreat?.houseId && typeof retreat.houseId === 'object' ? retreat.houseId as House : undefined;
  return Array.isArray(house?.bedrooms) ? house.bedrooms as Array<{ name: string; hasBathroom?: boolean; allowsSharing?: boolean }> : [];
};

export const getRetreatTown = (retreat?: Partial<Retreat> | null, houses: House[] = []) => {
  const explicitTown = String(retreat?.location_town || retreat?.locationTown || retreat?.location || '').trim();
  if (explicitTown && explicitTown !== 'Default Location') return explicitTown;

  const houseId = getHouseIdValue(retreat?.houseId as string | House | undefined);
  const house = houseId ? houses.find((item) => item._id === houseId) : null;
  return getHouseTown(house) || explicitTown;
};

export const staffRoleOptions = [
  { value: 'helper', label: 'Helper' },
  { value: 'second_helper', label: 'Helper 2' },
  { value: 'cook', label: 'Cook' },
];

export const formatStaffRole = (role?: string) => {
  const match = staffRoleOptions.find((option) => option.value === role);
  if (match) return match.label;
  return (role || 'Staff').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const formatDateForInput = (date?: Date | string) => {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().split('T')[0];
};
