import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { BookingStepsEditActions } from './ClientBookingWorkflowTab';

describe('BookingStepsEditActions', () => {
  it('always exposes the edit entry point outside the clipped bottom toolbar', () => {
    const onEdit = jest.fn(); render(<BookingStepsEditActions isEditing={false} saving={false} onEdit={onEdit} onCancel={jest.fn()} onSave={jest.fn()} compact />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i })); expect(onEdit).toHaveBeenCalled();
  });
  it('exposes save and cancel while editing and prevents duplicate saves', () => {
    const onSave = jest.fn(); const onCancel = jest.fn(); const { rerender } = render(<BookingStepsEditActions isEditing saving={false} onEdit={jest.fn()} onCancel={onCancel} onSave={onSave} compact />);
    fireEvent.click(screen.getByRole('button', { name: /save changes/i })); fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onSave).toHaveBeenCalled(); expect(onCancel).toHaveBeenCalled();
    rerender(<BookingStepsEditActions isEditing saving onEdit={jest.fn()} onCancel={onCancel} onSave={onSave} compact />);
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled(); expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });
});
