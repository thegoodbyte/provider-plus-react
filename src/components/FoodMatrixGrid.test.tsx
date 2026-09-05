import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FoodMatrixGrid from './FoodMatrixGrid';
import { foodMatrixApi } from '../services/api';

jest.mock('../services/api', () => ({
  foodMatrixApi: { get: jest.fn(), getPdf: jest.fn(), emailCook: jest.fn() },
}));

describe('FoodMatrixGrid', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
