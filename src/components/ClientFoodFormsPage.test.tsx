import React from 'react';
import jsPDF from 'jspdf';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import ClientFoodFormsPage from './ClientFoodFormsPage';
import { clientFoodFormsApi } from '../services/clientFoodFormsApi';
import { highlightFoodAnswer } from './clientFormsControls';

jest.mock('../services/clientFoodFormsApi', () => ({ clientFoodFormsApi: { getAll: jest.fn() } }));
jest.mock('jspdf', () => jest.fn());

beforeEach(() => {
  (clientFoodFormsApi.getAll as jest.Mock).mockResolvedValue({ data: [
    { _id: 'a', display_id: 10, signature_name: 'Zoe', email: 'z@example.com', language: 'en', status: 'submitted', retreat_id: { code: 'JNO-10' }, answers: { dietType: 'Vegan', foodsDisliked: 'Mushrooms', foodsAvoided: 'None', allergies: 'Nuts' } },
    { _id: 'b', display_id: 2, signature_name: 'Amy', email: 'a@example.com', language: 'en', status: 'reviewed', retreat_id: { code: 'JNO-11' }, answers: { dietType: 'Vegetarian' } },
  ] });
});

test('sorts references numerically in both directions and filters by a searched retreat', async () => {
  render(<ClientFoodFormsPage />);
  await screen.findByText('Zoe');
  fireEvent.click(screen.getByRole('button', { name: 'Ref' }));
  expect(within(screen.getAllByRole('row')[1]).getByText('#2')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Ref' }));
  expect(within(screen.getAllByRole('row')[1]).getByText('#10')).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox', { name: 'Retreat' }), { target: { value: 'JNO-11' } });
  fireEvent.click(await screen.findByRole('option', { name: 'JNO-11' }));
  expect(screen.queryByText('Zoe')).toBeNull();
  expect(screen.getByText('Amy')).toBeTruthy();
  fireEvent.focus(screen.getByRole('combobox', { name: 'Retreat' }));
  fireEvent.mouseDown(screen.getByRole('img', { name: 'close-circle' }));
  expect(screen.getByText('Zoe')).toBeTruthy();
});

test('opens the questionnaire from the food icon and highlights only restrictions', async () => {
  render(<ClientFoodFormsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'View food questionnaire for Zoe' }));
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByText('Mushrooms').className).toContain('text-red-800');
  expect(dialog.getByText('Nuts').className).toContain('text-red-800');
  expect(dialog.getByText('None').className).not.toContain('text-red-800');
});

test.each([undefined, null, '', ' ', 'None', 'none.', 'N/A', [], ['None'], 'No allergies'])('does not highlight empty or negative answer %p', value => {
  expect(highlightFoodAnswer('allergies', value)).toBe(false);
});

test.each(['foodsDisliked', 'foodsAvoided', 'allergies', 'foodIntolerances'])('highlights a restriction in %s', key => {
  expect(highlightFoodAnswer(key, ['None', 'Peanuts'])).toBe(true);
});


const matrixPdf = () => ({
  internal:{pageSize:{getWidth:()=>842,getHeight:()=>595}},
  setFont:jest.fn(),setFontSize:jest.fn(),text:jest.fn(),setFillColor:jest.fn(),rect:jest.fn(),addPage:jest.fn(),setDrawColor:jest.fn(),line:jest.fn(),save:jest.fn(),
});
const openMatrix = async()=>{
  render(<ClientFoodFormsPage/>);await screen.findByText('Zoe');
  fireEvent.change(screen.getByRole('combobox',{name:'Retreat'}),{target:{value:'JNO-10'}});
  fireEvent.click(await screen.findByRole('option',{name:'JNO-10'}));
  fireEvent.click(screen.getByRole('button',{name:'Food matrix',exact:true}));
};
test('loads PDF generation only on export and still saves the selected matrix',async()=>{
  const pdf=matrixPdf();(jsPDF as unknown as jest.Mock).mockImplementation(()=>pdf);
  await openMatrix();expect(jsPDF).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Download PDF',exact:true}));
  await waitFor(()=>expect(pdf.save).toHaveBeenCalledWith('food-matrix-JNO-10.pdf'));
  expect(jsPDF).toHaveBeenCalledTimes(1);expect(screen.queryByRole('alert')).toBeNull();
});
test('surfaces export failure and allows a subsequent export without losing the matrix',async()=>{
  const pdf=matrixPdf();(jsPDF as unknown as jest.Mock).mockImplementationOnce(()=>{throw new Error('Synthetic PDF failure');}).mockImplementation(()=>pdf);
  await openMatrix();fireEvent.click(screen.getByRole('button',{name:'Download PDF',exact:true}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the PDF');
  expect(screen.getByRole('dialog',{name:'Food matrix'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Download PDF',exact:true}));
  await waitFor(()=>expect(pdf.save).toHaveBeenCalled());expect(screen.queryByRole('alert')).toBeNull();
});
