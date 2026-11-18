import React from 'react';
import { render, screen } from '@testing-library/react';
import AppleInput from './AppleInput';

it('keeps required-field names stable for invoice entry and assistive technology', () => {
  render(<AppleInput label="Description" required value="Consultation" onChange={() => {}} />);
  const input = screen.getByRole('textbox', { name: 'Description', exact: true });
  expect(input).toBeRequired();
  expect(screen.getByLabelText('Description', { exact: true })).toBe(input);
});
