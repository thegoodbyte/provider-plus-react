import { Retreat, RetreatStaffAssignment } from '../types';

export type StaffingLanguage = 'en' | 'pl' | 'cs';

const staffingLocales: Record<StaffingLanguage, string> = {
  en: 'en-GB',
  pl: 'pl-PL',
  cs: 'cs-CZ',
};

export const retreatStaffingStartTime = (retreat: Retreat) => new Date(retreat.startDate || retreat.dates?.startDate || 0).getTime();

export const retreatStaffingEndTime = (retreat: Retreat) => new Date(retreat.endDate || retreat.dates?.endDate || retreat.startDate || retreat.dates?.startDate || 0).getTime();

export const formatStaffingDate = (value?: string | Date, language: StaffingLanguage = 'en') => {
  if (!value) return 'Date not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not set';
  const weekday = new Intl.DateTimeFormat(staffingLocales[language], { weekday: 'short', timeZone: 'UTC' }).format(date);
  const parts = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const formattedDate = language === 'en' ? `${values.month}/${values.day}/${values.year}` : `${values.day}/${values.month}/${values.year}`;
  return `${weekday}, ${formattedDate}`;
};

export const formatRetreatStaffingDates = (retreat: Retreat, language: StaffingLanguage = 'en') => `${formatStaffingDate(retreat.startDate || retreat.dates?.startDate, language)} – ${formatStaffingDate(retreat.endDate || retreat.dates?.endDate, language)}`;

export const formatStaffAssignmentDates = (assignment: RetreatStaffAssignment, retreat: Retreat, language: StaffingLanguage = 'en') => {
  const startDate = assignment.startDate || retreat.startDate || retreat.dates?.startDate;
  const endDate = assignment.endDate || retreat.endDate || retreat.dates?.endDate;
  const startTime = assignment.startTime || retreat.startTime || retreat.dates?.startTime;
  const endTime = assignment.endTime || retreat.endTime || retreat.dates?.endTime;
  return `${formatStaffingDate(startDate, language)}${startTime ? ` · ${startTime}` : ''} → ${formatStaffingDate(endDate, language)}${endTime ? ` · ${endTime}` : ''}`;
};

export const splitRetreatStaffingRetreats = (retreats: Retreat[], now = Date.now()) => {
  const sorted = [...retreats].sort((left, right) => retreatStaffingStartTime(left) - retreatStaffingStartTime(right));
  return {
    currentAndUpcoming: sorted.filter((retreat) => retreatStaffingEndTime(retreat) >= now),
    past: sorted.filter((retreat) => retreatStaffingEndTime(retreat) < now),
  };
};
