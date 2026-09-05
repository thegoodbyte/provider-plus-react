import React from 'react';
import { useClientProfilePictureUrl } from './useClientProfilePictureUrl';

type ClientAvatarSource = {
  _id?: string;
  profilePictureUrl?: string;
  profilePictureS3Key?: string;
  profilePictureFileUploadId?: string;
};

const SIZE_CLASSES = {
  sm: 'h-9 w-9',
  md: 'h-10 w-10',
} as const;

interface ClientAvatarProps {
  client: ClientAvatarSource | null | undefined;
  name: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

// The one place profile-picture resolution happens for every client-list
// surface in the app (grid, booking steps, retreat clients tab, payments,
// medical artifacts, medical reviews, ...). See PPVC-609 -- three separate
// copies of this same logic had independently drifted into the same bug
// (using the JWT-protected internal URL directly as an <img src>).
const ClientAvatar: React.FC<ClientAvatarProps> = ({ client, name, size = 'sm', className = '' }) => {
  const profilePictureUrl = useClientProfilePictureUrl(client as any);
  const sizeClass = SIZE_CLASSES[size];
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <span className={`inline-flex ${sizeClass} flex-none items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100 text-xs font-semibold text-gray-600 ${className}`}>
      {profilePictureUrl ? <img src={profilePictureUrl} alt="" className="h-full w-full object-cover" /> : <span>{initial}</span>}
    </span>
  );
};

export default ClientAvatar;
