import { Retreat, RetreatStaffAssignment } from '../types';

export const retreatStaffingStartTime = (retreat: Retreat) => new Date(retreat.startDate || retreat.dates?.startDate || 0).getTime();

export const retreatStaffingEndTime = (retreat: Retreat) => new Date(retreat.endDate || retreat.dates?.endDate || retreat.startDate || retreat.dates?.startDate || 0).getTime();

export const formatStaffingDate = (value?: string | Date) => {
  if (!value) return 'Date not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not set';
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
};

export const formatRetreatStaffingDates = (retreat: Retreat) => `${formatStaffingDate(retreat.startDate || retreat.dates?.startDate)} – ${formatStaffingDate(retreat.endDate || retreat.dates?.endDate)}`;

export const formatStaffAssignmentDates = (assignment: RetreatStaffAssignment, retreat: Retreat) => {
  const startDate = assignment.startDate || retreat.startDate || retreat.dates?.startDate;
  const endDate = assignment.endDate || retreat.endDate || retreat.dates?.endDate;
  const startTime = assignment.startTime || retreat.startTime || retreat.dates?.startTime;
  const endTime = assignment.endTime || retreat.endTime || retreat.dates?.endTime;
  return `${formatStaffingDate(startDate)}${startTime ? ` · ${startTime}` : ''} → ${formatStaffingDate(endDate)}${endTime ? ` · ${endTime}` : ''}`;
};

export const splitRetreatStaffingRetreats = (retreats: Retreat[], now = Date.now()) => {
  const sorted = [...retreats].sort((left, right) => retreatStaffingStartTime(left) - retreatStaffingStartTime(right));
  return {
    currentAndUpcoming: sorted.filter((retreat) => retreatStaffingEndTime(retreat) >= now),
    past: sorted.filter((retreat) => retreatStaffingEndTime(retreat) < now),
  };
};
