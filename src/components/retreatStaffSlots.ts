import { RetreatStaffAssignment } from '../types';

export const helperRoles = ['helper', 'second_helper', 'third_helper'];

// Reserve explicit roles first, then place repeated legacy helper roles into free columns.
// This keeps every person visible without rewriting stored assignments.
export function getHelperSlots(assignments: RetreatStaffAssignment[] = []) {
  const slots: Array<RetreatStaffAssignment | undefined> = [];
  const overflow: RetreatStaffAssignment[] = [];
  assignments.forEach(person => {
    const index = helperRoles.indexOf(person.role || 'helper');
    if (index < 0) return;
    if (slots[index]) overflow.push(person);
    else slots[index] = person;
  });
  overflow.forEach(person => {
    let index = 0;
    while (slots[index]) index++;
    slots[index] = person;
  });
  return slots;
}

export const nextHelperRole = (assignments: RetreatStaffAssignment[]) => {
  const slots = getHelperSlots(assignments);
  const index = helperRoles.findIndex((_, index) => !slots[index]);
  return helperRoles[index < 0 ? 0 : index];
};

export function getStaffColumns(assignmentGroups: RetreatStaffAssignment[][]) {
  const count = Math.max(2, ...assignmentGroups.map(assignments => getHelperSlots(assignments).length));
  return [{ key: 'cook', label: 'Cook', helperIndex: -1 }, ...Array.from({ length: count }, (_, index) => ({
    key: `helper-${index + 1}`, label: `Helper ${index + 1}`, helperIndex: index,
  }))];
}

export function getColumnStaff(assignments: RetreatStaffAssignment[], helperIndex: number) {
  if (helperIndex < 0) return assignments.filter(person => person.role === 'cook');
  const person = getHelperSlots(assignments)[helperIndex];
  return person ? [person] : [];
}
