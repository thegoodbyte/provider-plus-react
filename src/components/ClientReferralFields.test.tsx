import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ClientReferralFields from './ClientReferralFields';
import { clientsApi } from '../services/api';

jest.mock('../services/api', () => ({ clientsApi: { search: jest.fn() } }));

const referrals = [{ _id: 'friend', name: 'Friend', isActive: true }, { _id: 'partner', name: 'Robert', isActive: true }];

describe('ClientReferralFields', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the friend attribution choices and validates search after two characters', async () => {
    const onChange = jest.fn();
    (clientsApi.search as jest.Mock).mockResolvedValue({ data: [{ _id: 'c1', firstName: 'Anna', lastName: 'Nowak', display_id: 1200 }] });
    const { rerender } = render(<ClientReferralFields value={{ referralId: 'friend' }} referrals={referrals} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Existing client'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ referralPersonType: 'existing_client' }));

    rerender(<ClientReferralFields value={{ referralId: 'friend', referralPersonType: 'existing_client' }} referrals={referrals} onChange={onChange} />);
    const search = screen.getByPlaceholderText('Type at least 2 characters to search clients');
    fireEvent.change(search, { target: { value: 'A' } });
    expect(screen.getByText('Enter one more character to search.')).toBeInTheDocument();
    expect(clientsApi.search).not.toHaveBeenCalled();
    fireEvent.change(search, { target: { value: 'An' } });
    await waitFor(() => expect(clientsApi.search).toHaveBeenCalledWith('An'));
    expect(await screen.findByText(/Anna Nowak/)).toBeInTheDocument();
  });

  it('shows free text for someone else', () => {
    render(<ClientReferralFields value={{ referralId: 'friend', referralPersonType: 'someone_else', referralPersonName: 'A' }} referrals={referrals} onChange={jest.fn()} />);
    expect(screen.getByPlaceholderText('Enter their name')).toBeInTheDocument();
    expect(screen.getByText('Name must contain at least 2 characters.')).toBeInTheDocument();
  });
});
