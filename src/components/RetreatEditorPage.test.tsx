import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RetreatEditorPage from './RetreatEditorPage';
import { housesApi, retreatsApi } from '../services/api';

jest.mock('../services/api', () => ({
  retreatsApi: { getOne: jest.fn(), update: jest.fn(), delete: jest.fn() },
  housesApi: { getAll: jest.fn() },
}));

const retreat = {
  _id: 'retreat-1', name: 'JNO-08-22-26', code: 'JNO-08-22-26', status: 'upcoming',
  startDate: '2026-08-22T12:00:00.000Z', endDate: '2026-08-29T12:00:00.000Z',
  startTime: '18:00', endTime: '09:00', location_town: 'Mistrovice', capacity: 6,
  currentOccupancy: 4, ceremonyCount: 2, type: 'regular', houseId: 'house-1',
  backgroundColor: '#2563eb', textColor: '#ffffff',
};
const renderPage = () => render(<MemoryRouter initialEntries={['/admin/retreats/retreat-1/edit']}><Routes><Route path="/admin/retreats/:retreatId/edit" element={<RetreatEditorPage />}/><Route path="*" element={<div>Destination</div>}/></Routes></MemoryRouter>);

describe('RetreatEditorPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (retreatsApi.getOne as jest.Mock).mockResolvedValue({ data: retreat });
    (housesApi.getAll as jest.Mock).mockResolvedValue({ data: [{ _id: 'house-1', name: 'Mistrovice House', address: 'Mistrovice 107', generalTown: 'Mistrovice' }] });
    (retreatsApi.update as jest.Mock).mockResolvedValue({ data: retreat });
    (retreatsApi.delete as jest.Mock).mockResolvedValue({});
  });

  it('matches the numbered editor layout and saves normalized values', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Edit retreat' })).toBeInTheDocument();
    expect(screen.getByText('Identity')).toBeInTheDocument();
    expect(screen.getByText('Schedule')).toBeInTheDocument();
    expect(screen.getByText('Place and capacity')).toBeInTheDocument();
    expect(screen.getByText('Colour code')).toBeInTheDocument();
    expect(screen.getByText('4 / 6 places')).toBeInTheDocument();
    expect(screen.getByTestId('retreat-editor-workspace')).toHaveClass('bg-[#eceff3]');
    fireEvent.change(screen.getByLabelText('Location town *'), { target: { value: 'Prague' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save changes' })[0]);
    await waitFor(() => expect(retreatsApi.update).toHaveBeenCalledWith('retreat-1', expect.objectContaining({ location_town: 'Prague', location: 'Prague', capacity: 6, ceremonyCount: 2 })));
  });

  it('updates the palette and requires confirmation before deletion', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await screen.findByRole('heading', { name: 'Edit retreat' });
    fireEvent.click(screen.getByRole('button', { name: 'Use colour #38a9df' }));
    expect(screen.getByLabelText('Colour hex')).toHaveValue('#38a9df');
    fireEvent.click(screen.getByRole('button', { name: 'Delete retreat' }));
    await waitFor(() => expect(retreatsApi.delete).toHaveBeenCalledWith('retreat-1'));
    expect(confirm).toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('exposes retreat-wide commission and blocks invalid capacity before saving', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Edit retreat' });
    expect(screen.getByText('Referral commission override (%)')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Capacity *'), { target: { value: '0' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save changes' })[0]);
    expect(await screen.findByText(/positive whole-number capacity/i)).toBeInTheDocument();
    expect(retreatsApi.update).not.toHaveBeenCalled();
  });
});
