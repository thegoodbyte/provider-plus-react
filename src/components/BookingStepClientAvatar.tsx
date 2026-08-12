import React, { useEffect, useState } from 'react';
import { clientsApi } from '../services/api';
import { Client } from '../types';

const BookingStepClientAvatar: React.FC<{ client: Client | null; name: string }> = ({ client, name }) => {
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(client?.profilePictureUrl || null);
  const hasProfilePicture = Boolean(client?.profilePictureUrl || client?.profilePictureS3Key || client?.profilePictureFileUploadId);

  useEffect(() => {
    if (!client?._id || client.profilePictureUrl || !hasProfilePicture) {
      setProfilePictureUrl(client?.profilePictureUrl || null);
      return;
    }

    let objectUrl: string | null = null;
    let active = true;
    clientsApi.getProfilePictureBlob(client._id).then((response) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(response.data);
      setProfilePictureUrl(objectUrl);
    }).catch(() => {
      if (active) setProfilePictureUrl(null);
    });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [client?._id, client?.profilePictureFileUploadId, client?.profilePictureS3Key, client?.profilePictureUrl, hasProfilePicture]);

  return (
    <span data-testid="booking-step-client-avatar" className="mr-2 inline-flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100 text-xs font-semibold text-gray-600">
      {profilePictureUrl ? <img src={profilePictureUrl} alt="" className="h-full w-full object-cover" /> : <span>{name.charAt(0).toUpperCase()}</span>}
    </span>
  );
};

export default BookingStepClientAvatar;
