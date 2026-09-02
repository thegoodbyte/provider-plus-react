export const isMedicalReviewPacketPath = (pathname: string) => (
  pathname.startsWith('/medical/review-groups/')
  || pathname.startsWith('/medical-review-group-access/')
);

export const getForbiddenErrorPresentation = (pathname: string, responseMessage?: string, debugEnabled = false) => {
  if (isMedicalReviewPacketPath(pathname)) {
    return {
      title: 'You are not authorized to view this content',
      message: 'This advisor packet cannot be opened in the current Retreat Engine session. Sign out of Retreat Engine in any other tabs or windows, then reopen the original advisor link.',
    };
  }

  return {
    title: 'Request could not be completed',
    message: debugEnabled ? responseMessage || 'Access denied' : 'You do not have permission to perform this action.',
  };
};
