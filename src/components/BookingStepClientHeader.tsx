import React from 'react';
import { Link } from 'react-router-dom';
import { getBookingStepClient, getBookingStepClientDisplayId, getBookingStepClientEmail, getBookingStepClientId, getBookingStepClientName, getBookingStepClientPhone, getBookingStepNumber, getBookingStepObjectId } from './bookingStepIdentity';
import BookingStepClientAvatar from './BookingStepClientAvatar';

export const getBookingStepRoutePrefix = (pathname: string) => {
  const firstSegment = pathname.split('/').filter(Boolean)[0];
  return ['admin', 'medical', 'staff', 'user', 'helper'].includes(firstSegment) ? firstSegment : 'admin';
};

const BookingStepClientHeader: React.FC<{ booking: any; viewMode: 'detail' | 'simple'; routePrefix: string }> = ({ booking, viewMode, routePrefix }) => {
  const bookingId = getBookingStepObjectId(booking);
  const clientId = getBookingStepClientId(booking);
  const name = getBookingStepClientName(booking);
  const number = getBookingStepNumber(booking);
  const displayId = getBookingStepClientDisplayId(booking);
  const email = getBookingStepClientEmail(booking);
  const phone = getBookingStepClientPhone(booking);
  const detail = viewMode === 'detail';
  const nameClass = `${viewMode === 'simple' ? 'max-w-[130px] text-xs' : 'max-w-[210px] text-sm'} block truncate font-bold uppercase text-gray-900`;
  return (
    <th className={`sticky top-0 z-20 border-b border-r border-gray-300 bg-gray-100 px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600 ${viewMode === 'simple' ? 'min-w-[150px]' : 'min-w-[260px]'}`}>
      <div className="flex items-start gap-2">
        {detail && <BookingStepClientAvatar client={getBookingStepClient(booking)} name={name} />}
        <div className="min-w-0 space-y-1 normal-case">
          {clientId ? <Link to={`/${routePrefix}/clients/${clientId}`} className={`${nameClass} hover:text-blue-700 hover:underline`} title="View client profile">{name}</Link> : <div className={nameClass}>{name}</div>}
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] font-semibold text-blue-700">
            {bookingId ? <Link to={`/admin/bookings/${bookingId}`} className="hover:text-blue-900 hover:underline">Booking #{number}</Link> : <span>Booking #{number}</span>}
            {detail && displayId && (clientId ? <Link to={`/${routePrefix}/clients/${clientId}`} className="hover:text-blue-900 hover:underline">Client #{displayId}</Link> : <span>Client #{displayId}</span>)}
          </div>
          {detail && email && <div className="max-w-[220px] truncate text-[11px] font-medium text-gray-600" title={email}>{email}</div>}
          {detail && phone && <div className="max-w-[220px] truncate text-[11px] font-medium text-gray-600" title={phone}>{phone}</div>}
        </div>
      </div>
    </th>
  );
};
export default BookingStepClientHeader;
