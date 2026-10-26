import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FoodMatrixGrid from './FoodMatrixGrid';
import { foodMatrixApi, languagesApi } from '../services/api';

jest.mock('../services/api', () => ({
  foodMatrixApi: { setPreviousForm: jest.fn(), get: jest.fn(), getPdf: jest.fn(), emailCook: jest.fn() },
  languagesApi: { getActive: jest.fn() },
}));

describe('FoodMatrixGrid', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (languagesApi.getActive as jest.Mock).mockResolvedValue({ data: [
      { _id: '1', code: 'en', name: 'English', active: true, sortOrder: 10 },
      { _id: '2', code: 'cz', name: 'Czech', active: true, sortOrder: 20 },
      { _id: '3', code: 'pl', name: 'Polish', active: true, sortOrder: 30 },
    ] });
    (foodMatrixApi.get as jest.Mock).mockResolvedValue({
      data: {
        retreatLabel: 'JNO-09-12-26',
        cook: { name: 'Kasia', email: 'cook@example.com', language: 'pl' },
        questions: [{ key: 'dietType', label: 'Usual diet' }, { key: 'allergies', label: 'Medical food allergies and severity' }],
        columns: [
          { clientId: 'client-1', label: 'Marcin G.', submitted: true, language: 'pl', answers: { dietType: 'Vegetarian', allergies: 'Peanuts' } },
          { clientId: 'client-2', label: 'Anna N.', submitted: false, answers: {} },
        ],
      },
    });
  });

  it('renders a column per client and a row per question, flagging clients who have not submitted', async () => {
    render(<FoodMatrixGrid retreatId="retreat-1" />);

    expect(await screen.findByText('Food Matrix')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Marcin G\./ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Anna N\..*not submitted/i })).toBeInTheDocument();
    expect(screen.getByText('Usual diet')).toBeInTheDocument();
    expect(screen.getByText('Vegetarian')).toBeInTheDocument();
  });

  it('downloads a PDF using the selected language', async () => {
    const blob = new Blob(['pdf-bytes'], { type: 'application/pdf' });
    (foodMatrixApi.getPdf as jest.Mock).mockResolvedValue({ data: blob });
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn(() => 'blob:food-matrix');
    URL.revokeObjectURL = jest.fn();

    render(<FoodMatrixGrid retreatId="retreat-1" />);
    await screen.findByText('Food Matrix');

    fireEvent.change(screen.getByLabelText('PDF language'), { target: { value: 'en' } });
    fireEvent.click(screen.getByRole('button', { name: /Download PDF/i }));

    await waitFor(() => expect(foodMatrixApi.getPdf).toHaveBeenCalledWith('retreat-1', 'en'));
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);

    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('shows an error message when the PDF export fails', async () => {
    (foodMatrixApi.getPdf as jest.Mock).mockRejectedValue({ response: { data: { message: 'OpenAI translation failed' } } });

    render(<FoodMatrixGrid retreatId="retreat-1" />);
    await screen.findByText('Food Matrix');
    fireEvent.click(screen.getByRole('button', { name: /Download PDF/i }));

    expect(await screen.findByText('OpenAI translation failed')).toBeInTheDocument();
  });

  it('emails the PDF to the assigned cook', async () => {
    (foodMatrixApi.emailCook as jest.Mock).mockResolvedValue({ data: { sent: true, cookName: 'Kasia', to: 'cook@example.com' } });
    render(<FoodMatrixGrid retreatId="retreat-1" />);
    await screen.findByText('Food Matrix');
    fireEvent.click(screen.getByRole('button', { name: /Email cook/i }));
    expect(await screen.findByText(/emailed to Kasia/i)).toBeInTheDocument();
    expect(foodMatrixApi.emailCook).toHaveBeenCalledWith('retreat-1');
  });
  it('saves explicit reuse, shows historical answers without claiming a new submission, and supports clearing', async () => {
    const column = { clientId: 'returning', bookingId: 'booking-9', label: 'Returning G.', submitted: false, selectionVersion: 0,
      previousForm: { id: 'form-old', retreatLabel: 'OLD-RETREAT', selected: false }, answers: {} };
    const matrix = { questions: [{ key: 'dietType', label: 'Usual diet' }], columns: [column] };
    (foodMatrixApi.get as jest.Mock).mockResolvedValue({ data: matrix });
    (foodMatrixApi.setPreviousForm as jest.Mock).mockResolvedValueOnce({ data: { ...matrix, columns: [{ ...column, selectionVersion: 1, usingPreviousForm: true, previousForm: { ...column.previousForm, selected: true }, answers: { dietType: 'Historical vegetarian' } }] } });
    render(<FoodMatrixGrid retreatId="retreat-1" />);
    const checkbox = await screen.findByRole('checkbox', { name: 'Use the previous food form for Returning G.' });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(await screen.findByText('Historical vegetarian')).toBeInTheDocument();
    expect(foodMatrixApi.setPreviousForm).toHaveBeenCalledWith('retreat-1', 'booking-9', 'form-old', 0);
    expect(screen.getByRole('checkbox')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Cards' }));
    expect(screen.getByText('Historical vegetarian')).toBeInTheDocument();
    expect(screen.getByText('Using previous food form')).toBeInTheDocument();
    (foodMatrixApi.setPreviousForm as jest.Mock).mockResolvedValueOnce({ data: matrix });
    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(screen.queryByText('Historical vegetarian')).not.toBeInTheDocument());
    expect(foodMatrixApi.setPreviousForm).toHaveBeenLastCalledWith('retreat-1', 'booking-9', null, 1);
  });

});
