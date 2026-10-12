import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReferralPortalAccountEditor } from './ReferralPortalAccountEditor';
import { api } from '../services/api';
jest.mock('../services/api', () => ({ api: { get: jest.fn(), post: jest.fn(), put: jest.fn() } }));
beforeEach(() => { jest.clearAllMocks(); (api.get as jest.Mock).mockResolvedValue({ data: { email: 'partner@example.com', active: true } }); });
it('opens a separate read-only support tab without changing PIN or admin login', async () => {
  const tab: any = { opener: window, location: { replace: jest.fn() }, close: jest.fn() };
  jest.spyOn(window, 'open').mockReturnValue(tab);
  (api.post as jest.Mock).mockResolvedValue({ data: { url: 'https://referrals.ibogaspirit.cz/admin-access#token=test' } });
  render(<ReferralPortalAccountEditor referralId="partner1" defaultEmail="" />);
  await waitFor(() => expect(screen.getByText('View referral portal (read-only)')).toBeEnabled());
  fireEvent.click(screen.getByText('View referral portal (read-only)'));
  await waitFor(() => expect(tab.location.replace).toHaveBeenCalledWith('https://referrals.ibogaspirit.cz/admin-access#token=test'));
  expect(api.post).toHaveBeenCalledWith('/referrals/partner1/portal-account/support-link', {});
  expect(tab.opener).toBeNull(); expect(api.put).not.toHaveBeenCalled();
});
it('closes the new tab and shows the server error when support cannot start', async () => {
  const tab: any = { location: { replace: jest.fn() }, close: jest.fn() };
  jest.spyOn(window, 'open').mockReturnValue(tab);
  (api.post as jest.Mock).mockRejectedValue({ response: { data: { message: 'An active referral is required.' } } });
  render(<ReferralPortalAccountEditor referralId="partner1" defaultEmail="" />);
  await waitFor(() => expect(screen.getByText('View referral portal (read-only)')).toBeEnabled());
  fireEvent.click(screen.getByText('View referral portal (read-only)'));
  await screen.findByText('An active referral is required.'); expect(tab.close).toHaveBeenCalled();
});
