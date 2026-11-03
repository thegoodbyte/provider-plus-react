import React from 'react';
import {Link} from 'react-router-dom';
import {NAVIGATION,canShowNavigation,useNavigationPreferences} from '../navigation/navigation';
import {useAuth} from '../context/AuthContext';
export const bookingSettingItems=['retreat-flow','retreat-flow-library','booking-document-types','requirements','announcements'];
export default function BookingSettingsHome(){const {user}=useAuth(),prefs=useNavigationPreferences();return <main className="staff-focus-home"><h1>Booking settings</h1><p>Set up reusable booking steps, documents and client messages.</p><div className="staff-focus-grid">{bookingSettingItems.filter(id=>canShowNavigation(id,user?.role,prefs)).map(id=><Link key={id} className="rounded-lg border bg-white p-5" to={'/admin/'+id}><strong>{NAVIGATION[id].label}</strong><p>{NAVIGATION[id].description}</p></Link>)}</div></main>;}
