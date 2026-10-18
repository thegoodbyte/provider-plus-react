import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import BoosterOffersPage, { boosterWindowInput } from './BoosterOffersPage';
import { boosterOffersApi, retreatsApi, bookingsApi } from '../services/api';
jest.mock('../services/api', () => ({ boosterOffersApi: { getAll: jest.fn(), update: jest.fn() }, retreatsApi: { getAll: jest.fn() }, bookingsApi: { getAll: jest.fn() }, ceremoniesApi: { getByRetreat: jest.fn() } }));
const offer = { _id: 'o1', retreatId: { _id: 'r1', code: 'F1', capacity: 6 }, ceremonyId: { _id: 'c1', date: '2027-01-02' }, ceremonyNumber: 1, capacity: 3, price: 450, currency: 'EUR', published: false, remaining: 1, reserved: 1, arrivalAt: '2027-01-01T18:00', departureAt: '2027-01-04T18:00' };
beforeEach(() => { jest.clearAllMocks(); (boosterOffersApi.getAll as jest.Mock).mockResolvedValue({ data: [offer] }); (retreatsApi.getAll as jest.Mock).mockResolvedValue({ data: [] }); (bookingsApi.getAll as jest.Mock).mockResolvedValue({ data: [] }); (boosterOffersApi.update as jest.Mock).mockResolvedValue({ data: offer }); });
it('saves an explicit price/currency together without changing publication or booking capacity', async () => {
  render(<BoosterOffersPage />);
  const form = await screen.findByRole('form', { name: 'Price for ceremony 1' });
  fireEvent.change(within(form).getByRole('spinbutton'), { target: { value: '575.50' } });
  fireEvent.change(within(form).getByRole('combobox'), { target: { value: 'CZK' } });
  expect(boosterOffersApi.update).not.toHaveBeenCalled();
  fireEvent.submit(form);
  await waitFor(() => expect(boosterOffersApi.update).toHaveBeenCalledWith('o1', { price: 575.5, currency: 'CZK' }));
});
it('retains entered pricing and exposes a retryable server rejection', async () => {
  (boosterOffersApi.update as jest.Mock).mockRejectedValue({ response: { data: { message: 'Temporary save failure' } } });
  render(<BoosterOffersPage />);
  const form = await screen.findByRole('form', { name: 'Price for ceremony 1' });
  fireEvent.change(within(form).getByRole('spinbutton'), { target: { value: '575' } });
  fireEvent.submit(form);
  expect(await screen.findByRole('alert')).toHaveTextContent('Temporary save failure');
  expect(within(form).getByRole('spinbutton')).toHaveValue(575);
  expect(boosterOffersApi.getAll).toHaveBeenCalledTimes(1);
});
it('does not optimistically publish an offer when the server rejects the change', async () => {
  (boosterOffersApi.update as jest.Mock).mockRejectedValue(new Error('offline'));
  render(<BoosterOffersPage />);
  const published = await screen.findByRole('checkbox', { name: 'Published' });
  fireEvent.click(published);
  await screen.findByRole('alert');
  expect(published).not.toBeChecked();
});

it('displays stored window instants in Prague time in winter and summer', () => { expect(boosterWindowInput('2027-01-01T17:00:00Z')).toBe('2027-01-01T18:00'); expect(boosterWindowInput('2027-06-01T16:00:00Z')).toBe('2027-06-01T18:00'); });
