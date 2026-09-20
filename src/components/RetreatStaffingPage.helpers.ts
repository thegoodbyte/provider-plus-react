import { Retreat } from '../types';

export const retreatStaffingStartTime = (retreat: Retreat) => new Date(retreat.startDate || retreat.dates?.startDate || 0).getTime();

export const retreatStaffingEndTime = (retreat: Retreat) => new Date(retreat.endDate || retreat.dates?.endDate || retreat.startDate || retreat.dates?.startDate || 0).getTime();

export const splitRetreatStaffingRetreats = (retreats: Retreat[], now = Date.now()) => {
  const sorted = [...retreats].sort((left, right) => retreatStaffingStartTime(left) - retreatStaffingStartTime(right));
  return {
    currentAndUpcoming: sorted.filter((retreat) => retreatStaffingEndTime(retreat) >= now),
    past: sorted.filter((retreat) => retreatStaffingEndTime(retreat) < now),
  };
};
