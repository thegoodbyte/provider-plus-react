import { getForbiddenErrorPresentation, isMedicalReviewPacketPath } from './apiErrorPresentation';

describe('API error presentation', () => {
  it('explains the session conflict for medical advisor packet links', () => {
    expect(isMedicalReviewPacketPath('/medical/review-groups/group-1')).toBe(true);
    expect(getForbiddenErrorPresentation('/medical/review-groups/group-1')).toEqual({
      title: 'You are not authorized to view this content',
      message: 'This advisor packet cannot be opened in the current Retreat Engine session. Sign out of Retreat Engine in any other tabs or windows, then reopen the original advisor link.',
    });
  });

  it('keeps the standard permission message outside packet links', () => {
    expect(getForbiddenErrorPresentation('/admin/clients', 'Internal detail', false).message).toBe('You do not have permission to perform this action.');
  });
});
