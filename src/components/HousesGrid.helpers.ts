import { House } from '../types';

// PPVC-702: bedrooms moved from a legacy plain count to an array of
// { name, hasBathroom, allowsSharing } objects. The old `typeof house.bedrooms
// === 'number'` fallback silently resolved to 0 for any house with the new
// array format, which zeroed out the required numberOfRooms field and made
// the browser block form submission entirely -- with no error shown.
export const resolveNumberOfRooms = (house: Pick<House, 'numberOfRooms' | 'bedrooms'>): number => {
  if (house.numberOfRooms) return house.numberOfRooms;
  if (typeof house.bedrooms === 'number') return house.bedrooms;
  return house.bedrooms?.length ?? 0;
};
