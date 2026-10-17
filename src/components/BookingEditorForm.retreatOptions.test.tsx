import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BookingEditorForm, { retreatsForBookingType } from './BookingEditorForm';
import { BookingType, EventType } from '../constants/eventTypes';
import { authService } from '../services/authService';
import { clientsApi, bookingsApi, ceremoniesApi, paymentRequestsApi } from '../services/api';
import { roomInventoryApi } from '../services/roomInventoryApi';

// PPVC-845: adding a booking offered every retreat regardless of booking
// type, so a Bwiti Learning Weekend booking showed 7-day retreats (and vice
// versa). The retreat/event picker must be scoped to the selected booking
// type.
jest.mock('../services/authService', () => ({ authService: { getUser: jest.fn() } }));
jest.mock('../services/api', () => ({
  referralsApi: { getAll: jest.fn() },
  bookingsApi: { getNextBookingNumber: jest.fn(), isBookingNumberAvailable: jest.fn(), getOne: jest.fn() },
  ceremoniesApi: { getByRetreat: jest.fn() },
  clientsApi: { getBookingOptions: jest.fn() },
  paymentRequestsApi: { getOne: jest.fn(), getAllFresh: jest.fn() },
  retreatsApi: { getAll: jest.fn() },
}));
jest.mock('../services/roomInventoryApi', () => ({ roomInventoryApi: { view: jest.fn(), options: jest.fn() } }));

describe('retreatsForBookingType', () => {
  const retreats = [
    { _id: 'r1', name: 'September retreat', location: 'Mýto', type: EventType.REGULAR },
    { _id: 'r2', name: 'Legacy retreat with no type set' },
    { _id: 'b1', name: 'October booster', location: 'Mýto', type: EventType.BOOSTER },
    { _id: 'w1', name: 'Bwiti Learning Weekend — November', location: 'Mýto', type: EventType.LEARNING_WEEKEND },
    { _id: 'ws1', name: 'Breathwork workshop', location: 'Mýto', type: EventType.WORKSHOP },
  ] as any[];

  it('offers only 7-day retreats (plus untyped legacy records) for a full retreat booking', () => {
    expect(retreatsForBookingType(retreats, BookingType.FULL_RETREAT).map((r) => r._id)).toEqual(['r1', 'r2']);
  });

  it('offers full retreats and booster events for a booster booking', () => {
    expect(retreatsForBookingType(retreats, BookingType.BOOSTER).map((r) => r._id)).toEqual(['r1', 'r2', 'b1']);
  });

  it('offers only Bwiti Learning Weekend events for a learning weekend booking', () => {
    expect(retreatsForBookingType(retreats, BookingType.LEARNING_WEEKEND).map((r) => r._id)).toEqual(['w1']);
  });

  it('offers only workshop events for a workshop booking', () => {
    expect(retreatsForBookingType(retreats, BookingType.WORKSHOP).map((r) => r._id)).toEqual(['ws1']);
  });
});

describe('BookingEditorForm retreat picker', () => {
  const initialRetreats = [
    { _id: 'r1', name: 'September retreat', location: 'Mýto', type: EventType.REGULAR },
    { _id: 'w1', name: 'November learning weekend', location: 'Mýto', type: EventType.LEARNING_WEEKEND },
  ] as any[];

  beforeEach(() => {
    jest.clearAllMocks();
    (authService.getUser as jest.Mock).mockReturnValue({ role: 'staff' });
    (clientsApi.getBookingOptions as jest.Mock).mockResolvedValue({ data: [] });
    (bookingsApi.getNextBookingNumber as jest.Mock).mockResolvedValue({ data: 1042 });
    (roomInventoryApi.view as jest.Mock).mockResolvedValue({ data: null });
    (roomInventoryApi.options as jest.Mock).mockResolvedValue({ data: [] });
    (ceremoniesApi.getByRetreat as jest.Mock).mockResolvedValue({ data: [] });
    (paymentRequestsApi.getAllFresh as jest.Mock).mockResolvedValue({ data: [] });
  });

  const renderForm = () => render(
    <BookingEditorForm
      mode="create"
      initialRetreats={initialRetreats}
      onCancel={jest.fn()}
      onSaved={jest.fn()}
    />,
  );

  it('only shows the learning weekend event once that booking type is selected', async () => {
    renderForm();
    await screen.findByPlaceholderText('Search and select a retreat...');
    fireEvent.change(screen.getByDisplayValue('Full 7-day retreat'), { target: { value: BookingType.LEARNING_WEEKEND } });
    const retreatInput = await screen.findByPlaceholderText('Search and select a bwiti learning weekend...');
    fireEvent.click(retreatInput);
    expect(screen.getByText('November learning weekend')).toBeInTheDocument();
    expect(screen.queryByText('September retreat')).not.toBeInTheDocument();
  });

  it('clears a retreat selection that no longer matches the chosen booking type', async () => {
    renderForm();
    await screen.findByPlaceholderText('Search and select a retreat...');
    const retreatInput = screen.getByPlaceholderText('Search and select a retreat...');
    fireEvent.click(retreatInput);
    fireEvent.click(screen.getByText('September retreat'));
    await waitFor(() => expect((screen.getByPlaceholderText('Search and select a retreat...') as HTMLInputElement).value).toBe('September retreat - Mýto'));
    fireEvent.change(screen.getByDisplayValue('Full 7-day retreat'), { target: { value: BookingType.LEARNING_WEEKEND } });
    const learningWeekendInput = await screen.findByPlaceholderText('Search and select a bwiti learning weekend...');
    expect((learningWeekendInput as HTMLInputElement).value).toBe('');
  });
});
