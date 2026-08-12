import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import BookingConfirmationEmailDialogs from './BookingConfirmationEmailDialogs';

jest.mock('./EmailComposeModal', () => ({ __esModule: true, default: ({ title, extraContent, onClose, onSent }: any) => <section><h1>{title}</h1>{extraContent}<button onClick={onClose}>Close review</button><button onClick={() => onSent({ _id: 'email' })}>Complete review</button></section> }));

const callbacks = () => ({ onReasonChange: jest.fn(), onCloseDraft: jest.fn(), onReviewedSent: jest.fn(), onCloseQuickSend: jest.fn(), onQuickSend: jest.fn() });
const props = (overrides: any = {}) => ({ booking: { clientId: { fullName: 'Ada Client', email: 'ada@test.com' } }, language: 'en' as const, draft: null, quickSendOpen: false, sending: false, reason: 'Original', ...callbacks(), ...overrides });

describe('BookingConfirmationEmailDialogs', () => {
  it('renders nothing when both dialogs are closed', () => { const { container } = render(<BookingConfirmationEmailDialogs {...props()} />); expect(container).toBeEmptyDOMElement(); });

  it('renders the review composer and wires reason, close and sent actions', () => {
    const values = props({ draft: { to: 'ada@test.com', subject: 'Welcome', bodyText: 'Hello' } });
    render(<BookingConfirmationEmailDialogs {...values} />);
    expect(screen.getByText('Booking Confirmation Email')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Original booking/), { target: { value: 'Date changed' } });
    fireEvent.click(screen.getByText('Close review'));
    fireEvent.click(screen.getByText('Complete review'));
    expect(values.onReasonChange).toHaveBeenCalledWith('Date changed');
    expect(values.onCloseDraft).toHaveBeenCalled();
    expect(values.onReviewedSent).toHaveBeenCalledWith({ _id: 'email' });
  });

  it('renders quick-send client data and supports edit, cancel and send', () => {
    const values = props({ quickSendOpen: true, language: 'cz' });
    render(<BookingConfirmationEmailDialogs {...values} />);
    expect(screen.getByRole('dialog')).toHaveTextContent('Ada Client');
    expect(screen.getByRole('dialog')).toHaveTextContent('ada@test.com');
    expect(screen.getByRole('dialog')).toHaveTextContent('Czech');
    fireEvent.change(screen.getByLabelText('Confirmation history reason'), { target: { value: 'New payment' } });
    fireEvent.click(screen.getByText('Cancel'));
    fireEvent.click(screen.getByText('Send'));
    expect(values.onReasonChange).toHaveBeenCalledWith('New payment');
    expect(values.onCloseQuickSend).toHaveBeenCalled();
    expect(values.onQuickSend).toHaveBeenCalled();
  });

  it('shows fallback client identity and disables controls while sending', () => {
    render(<BookingConfirmationEmailDialogs {...props({ booking: { clientDetails: {} }, quickSendOpen: true, sending: true, language: 'pl' })} />);
    expect(screen.getByRole('dialog')).toHaveTextContent('this client');
    expect(screen.getByRole('dialog')).toHaveTextContent('Polish');
    expect(screen.getByText('Cancel')).toBeDisabled();
    expect(screen.getByText('Sending...')).toBeDisabled();
  });

  it('builds a client name from legacy first and last fields', () => {
    render(<BookingConfirmationEmailDialogs {...props({ booking: { clientId: { fname: 'Legacy', lname: 'Person', email: 'legacy@test.com' } }, quickSendOpen: true })} />);
    expect(screen.getByRole('dialog')).toHaveTextContent('Legacy Person');
  });
});
