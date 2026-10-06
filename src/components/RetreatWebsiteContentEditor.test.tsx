import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RetreatPricingPage from './RetreatPricingPage';
import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RetreatWebsiteContentEditor from './RetreatWebsiteContentEditor';
import { retreatsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
jest.mock('../services/api', () => ({ retreatsApi: { getOne: jest.fn(), update: jest.fn(), getWebsiteContentDefaults: jest.fn(), updateWebsiteContentDefaults: jest.fn() } }));
jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
const Harness = ({ initial = {} }: { initial?: any }) => {
  const [content, setContent] = useState(initial);
  return <><RetreatWebsiteContentEditor value={content} onChange={setContent}/><output data-testid="content">{JSON.stringify(content)}</output></>;
};
describe('retreat website content editor', () => {
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({user:{role:'admin'}});
    (retreatsApi.getWebsiteContentDefaults as jest.Mock).mockResolvedValue({data:{includedItems:{en:['Meals'],cz:['Strava'],pl:['Posiłki']}}});
    (retreatsApi.updateWebsiteContentDefaults as jest.Mock).mockResolvedValue({});
  });
  it('saves localized content through the existing retreat pricing screen', async () => {
    (retreatsApi.getOne as jest.Mock).mockResolvedValue({data:{_id:'r1',name:'Retreat',websiteContent:{titles:{en:'Original'},offers:{keep:true}}}});
    (retreatsApi.update as jest.Mock).mockResolvedValue({data:null});
    render(<MemoryRouter initialEntries={['/admin/retreats/r1/pricing']}><Routes><Route path="/admin/retreats/:retreatId/pricing" element={<RetreatPricingPage/>}/></Routes></MemoryRouter>);
    await screen.findByRole('heading',{name:'Website content'});
    fireEvent.click(screen.getByRole('tab',{name:'Czech'}));
    fireEvent.change(screen.getByLabelText('Description'),{target:{value:'Český popis'}});
    fireEvent.change(screen.getByLabelText('This retreat'),{target:{value:'replace'}});
    fireEvent.change(screen.getByLabelText(/Replacement items/),{target:{value:'Ubytování\nStrava'}});
    fireEvent.click(screen.getByRole('button',{name:'Save pricing'}));
    await waitFor(() => expect(retreatsApi.update).toHaveBeenCalledWith('r1',expect.objectContaining({websiteContent:expect.objectContaining({titles:{en:'Original'},descriptions:{cz:'Český popis'},includedItems:{cz:['Ubytování','Strava']},includedItemsMode:{cz:'replace'},offers:{keep:true}})})));
  });

  it('switches languages and adds to shared content without losing translated fields', async () => {
    render(<Harness initial={{titles:{en:'English title'},offers:{keep:true}}}/>);
    await screen.findByText('Meals', {selector:'li'});
    fireEvent.click(screen.getByRole('tab',{name:'Polish'}));
    fireEvent.change(screen.getByLabelText('Title'),{target:{value:'Polski tytuł'}});
    fireEvent.change(screen.getByLabelText('This retreat'),{target:{value:'extend'}});
    fireEvent.change(screen.getByLabelText(/Additional items/),{target:{value:'Transfer\nExtra'}});
    expect(screen.getByText('Transfer')).toBeInTheDocument();
    expect(screen.getByText('Posiłki', {selector:'li'})).toBeInTheDocument();
    const content = JSON.parse(screen.getByTestId('content').textContent!);
    expect(content.titles).toEqual({en:'English title',pl:'Polski tytuł'});
    expect(content.includedItemsMode.pl).toBe('extend');
    expect(content.offers).toEqual({keep:true});
  });
  it('saves shared defaults with multiline input while preserving other languages', async () => {
    render(<Harness/>);
    await screen.findByText('Meals', {selector:'li'});
    const input = screen.getByLabelText(/Shared defaults/);
    fireEvent.change(input,{target:{value:'Meals\n'}});
    expect(input).toHaveValue('Meals\n');
    fireEvent.change(input,{target:{value:'Meals\nAccommodation'}});
    fireEvent.click(screen.getByRole('button',{name:'Save shared defaults for all retreats'}));
    await waitFor(() => expect(retreatsApi.updateWebsiteContentDefaults).toHaveBeenCalledWith({en:['Meals','Accommodation'],cz:['Strava'],pl:['Posiłki']}));
  });
  it('preserves legacy included arrays and allows an empty replacement', async () => {
    render(<Harness initial={{includedItems:['Legacy']}}/>);
    await screen.findByText('Legacy', {selector:'li'});
    expect(screen.getByLabelText('This retreat')).toHaveValue('replace');
    fireEvent.change(screen.getByLabelText(/Replacement items/),{target:{value:''}});
    expect(JSON.parse(screen.getByTestId('content').textContent!).includedItems).toEqual({en:[],cz:['Legacy'],pl:['Legacy']});
  });
});
