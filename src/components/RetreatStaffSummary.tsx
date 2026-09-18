import React from 'react';
import { Link } from 'react-router-dom';
import { RetreatStaffAssignment } from '../types';

const roles = [{ key: 'cook', label: 'Cook' }, { key: 'helper', label: 'Helper 1' }, { key: 'second_helper', label: 'Helper 2' }];
export default function RetreatStaffSummary({ assignments = [], retreatId, routePrefix }: {
  assignments?: RetreatStaffAssignment[]; retreatId: string; routePrefix: string;
}) {
  return <div className="holistic-staff" aria-label="Retreat team">
    <dl>{roles.map(role => {
      const people = assignments.filter(person => (person.role || 'helper') === role.key);
      const names = people.map(person => person.name?.trim() || (typeof person.contactId === 'object' ? person.contactId?.name : '') || 'Assigned person — name unavailable');
      return <div key={role.key}><dt>{role.label}</dt><dd className={people.length ? '' : 'holistic-staff-unassigned'}>{names.length ? names.join(', ') : 'Not assigned'}</dd></div>;
    })}</dl>
    <Link to={`/${routePrefix}/retreats/${retreatId}?panel=helpers`}>Manage retreat team</Link>
  </div>;
}
