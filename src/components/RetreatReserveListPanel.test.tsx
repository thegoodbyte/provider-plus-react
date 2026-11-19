import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import RetreatReserveListPanel from './RetreatReserveListPanel';
import { clientsApi, waitingListApi } from '../services/api';
jest.mock('../services/api', () => ({
  clientsApi: { searchClients: jest.fn() },
  waitingListApi: { getByRetreat: jest.fn(), addToWaitingList: jest.fn() },
}));
it('Add reservist focuses the existing client search without creating a reserve entry', async () => {
  (waitingListApi.getByRetreat as jest.Mock).mockResolvedValue({ data: [] });
  render(<RetreatReserveListPanel retreatId="retreat-1" retreatName="Synthetic retreat" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Add reservist' }));
  expect(screen.getByLabelText('Search client')).toHaveFocus();
  expect(waitingListApi.getByRetreat).toHaveBeenCalledWith('retreat-1');
  expect(waitingListApi.addToWaitingList).not.toHaveBeenCalled();
  expect(clientsApi.searchClients).not.toHaveBeenCalled();
});
