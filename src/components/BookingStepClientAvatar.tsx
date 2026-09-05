import React from 'react';
import { Client } from '../types';
import { useClientProfilePictureUrl } from './useClientProfilePictureUrl';

const BookingStepClientAvatar: React.FC<{ client: Client | null; name: string }> = ({ client, name }) => {
  const profilePictureUrl = useClientProfilePictureUrl(client);

  return (
    <span data-testid="booking-step-client-avatar" className="mr-2 inline-flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100 text-xs font-semibold text-gray-600">
      {profilePictureUrl ? <img src={profilePictureUrl} alt="" className="h-full w-full object-cover" /> : <span>{name.charAt(0).toUpperCase()}</span>}
    </span>
  );
};

export default BookingStepClientAvatar;
