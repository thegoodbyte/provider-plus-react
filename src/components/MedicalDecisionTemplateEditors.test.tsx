import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MedicalDecisionTemplateEditors from './MedicalDecisionTemplateEditors';
import { MailSettings } from '../types';
function Harness({ initial = {} }: { initial?: MailSettings }) {
  const [settings, setSettings] = useState<MailSettings | null>(initial);
  return <><MedicalDecisionTemplateEditors settings={settings} onChange={setSettings}/><output data-testid="settings">{JSON.stringify(settings)}</output></>;
}
it('shows all six localized subject/body editors and explains the sending controls', () => {
  render(<Harness/>);
  for (const outcome of ['Needs more information', 'Declined']) for (const language of ['English', 'Czech', 'Polish']) {
    expect((screen.getByLabelText(`${outcome} ${language} subject`) as HTMLInputElement).value.length).toBeGreaterThan(0);
    expect((screen.getByLabelText(`${outcome} ${language} body`) as HTMLTextAreaElement).value).toContain('{{links.clientPortal}}');
  }
  expect(screen.getByText(/Saving templates does not send/)).toBeInTheDocument();
});
it('edits subject and body without losing another language, outcome, switches or custom Czech aliases', () => {
  render(<Harness initial={{clientMedicalDeclinedEmailsEnabled:false, medicalReviewNeedsInfoTemplates:{ cz:{subject:'Custom Czech',body:'Custom instructions'} },medicalReviewDeclinedTemplates:{pl:{subject:'Custom Polish',body:'Custom Polish body'}} }}/>);
  expect(screen.getByLabelText('Needs more information Czech subject')).toHaveValue('Custom Czech');
  fireEvent.change(screen.getByLabelText('Needs more information Czech subject'), {target:{value:'Updated Czech'}});
  fireEvent.change(screen.getByLabelText('Needs more information Czech body'), {target:{value:'Updated body\n\nNext step'}});
  const saved=JSON.parse(screen.getByTestId('settings').textContent!);
  expect(saved.medicalReviewNeedsInfoTemplates.cs).toEqual({subject:'Updated Czech',body:'Updated body\n\nNext step'});
  expect(saved.medicalReviewDeclinedTemplates.pl.body).toBe('Custom Polish body');
  expect(saved.clientMedicalDeclinedEmailsEnabled).toBe(false);
});
