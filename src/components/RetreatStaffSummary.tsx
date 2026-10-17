import React from 'react';
import { Link } from 'react-router-dom';
import { RetreatStaffAssignment } from '../types';

import { getColumnStaff, getStaffColumns } from './retreatStaffSlots';
export default function RetreatStaffSummary({ assignments = [], retreatId, routePrefix }: {
  assignments?: RetreatStaffAssignment[]; retreatId: string; routePrefix: string;
}) {
  const roles = getStaffColumns([assignments]);
  return <div className="holistic-staff" aria-label="Retreat team">
    <dl>{roles.map(role => {
      const people = getColumnStaff(assignments, role.helperIndex);
      const names = people.map(person => person.name?.trim() || (typeof person.contactId === 'object' ? person.contactId?.name : '') || 'Assigned person — name unavailable');
      const roles = getStaffColumns([assignments]);
  return <div key={role.key}><dt>{role.label}</dt><dd className={people.length ? '' : 'holistic-staff-unassigned'}>{names.length ? names.join(', ') : 'Not assigned'}</dd></div>;
    })}</dl>
    <Link to={`/${routePrefix}/retreats/${retreatId}/helpers?add=helper`}>Add helper</Link>
    <Link to={`/${routePrefix}/retreats/${retreatId}/helpers`}>Manage retreat team</Link>
  </div>;
}
