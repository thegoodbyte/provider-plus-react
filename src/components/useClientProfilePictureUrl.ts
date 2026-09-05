import { useEffect, useState } from 'react';
import { clientsApi } from '../services/api';
import { Client } from '../types';

const isAbsoluteUrl = (value?: string | null) => Boolean(value && /^https?:\/\//i.test(value));

// PPVC-609: every current upload path stores profilePictureUrl as the
// internal, JWT-protected route (`/clients/:id/profile-picture`), never a
// genuinely public URL. A bare <img src> can't send the auth header, so
// using that value directly 401s and renders as a broken image. Only an
// absolute http(s) URL is safe to use as-is; anything else (including a
// bare S3 key or file-upload id with no URL at all) goes through the
// authenticated blob fetch, same as the client detail pages already do.
export const useClientProfilePictureUrl = (client: Client | null | undefined): string | null => {
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(
    isAbsoluteUrl(client?.profilePictureUrl) ? client!.profilePictureUrl! : null,
  );
  const hasProfilePicture = Boolean(client?.profilePictureUrl || client?.profilePictureS3Key || client?.profilePictureFileUploadId);

  useEffect(() => {
    if (isAbsoluteUrl(client?.profilePictureUrl)) {
      setProfilePictureUrl(client!.profilePictureUrl!);
      return;
    }
    if (!client?._id || !hasProfilePicture) {
      setProfilePictureUrl(null);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;
    clientsApi.getProfilePictureBlob(client._id)
      .then((response) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(response.data);
        setProfilePictureUrl(objectUrl);
      })
      .catch(() => {
        if (active) setProfilePictureUrl(null);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?._id, client?.profilePictureFileUploadId, client?.profilePictureS3Key, client?.profilePictureUrl, hasProfilePicture]);

  return profilePictureUrl;
};
