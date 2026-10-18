import React from 'react';
import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { bookingDocumentsApi } from '../services/api';
import { useDocumentLibrary, DocumentLibraryControls, isInDocumentLibrary } from './useDocumentLibrary';
jest.mock('../services/api',()=>({bookingDocumentsApi:{getTypes:jest.fn()}}));
const types:any[]=[{key:'questionnaire',medicalArtifactType:'questionnaire',libraryPlacement:'documents'},{key:'medications_form',medicalArtifactType:'medications_form',libraryPlacement:'medical'},{key:'custom_doc',medicalArtifactType:'custom_artifact',libraryPlacement:'both'}];
it('uses configured placement for either record source, custom mappings, both, and unknown types',()=>{
 expect(isInDocumentLibrary('questionnaire','documents',types)).toBe(true);expect(isInDocumentLibrary('questionnaire','medical',types)).toBe(false);
 expect(isInDocumentLibrary('medications_form','documents',types)).toBe(false);expect(isInDocumentLibrary('medications_form','medical',types)).toBe(true);
 expect(isInDocumentLibrary('custom_artifact','documents',types)).toBe(true);expect(isInDocumentLibrary('custom_artifact','medical',types)).toBe(true);
 expect(isInDocumentLibrary('unregistered','medical',types)).toBe(true);
 expect(isInDocumentLibrary('questionnaire','medical',[{...types[0],libraryPlacement:'medical'}])).toBe(true);
});
function Harness(){const library=useDocumentLibrary('documents');return <><DocumentLibraryControls library={library}/>{library.visible('questionnaire')&&<span>Questionnaire record</span>}{library.visible('medications_form')&&<span>Medication record</span>}</>;}
it('loads the single catalog, filters existing records and allows explicit access to records in the other library',async()=>{
 (bookingDocumentsApi.getTypes as jest.Mock).mockResolvedValue({data:types});render(<MemoryRouter><Harness/></MemoryRouter>);
 await screen.findByText('Questionnaire record');expect(screen.queryByText('Medication record')).not.toBeInTheDocument();
 expect(bookingDocumentsApi.getTypes).toHaveBeenCalledWith(true);
 expect(screen.getByRole('link')).toHaveAttribute('href','/admin/booking-document-types');
 fireEvent.click(screen.getByRole('checkbox'));expect(screen.getByText('Medication record')).toBeInTheDocument();
});
it('shows failed settings load explicitly and retries without guessing placement',async()=>{
 (bookingDocumentsApi.getTypes as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({data:types});render(<MemoryRouter><Harness/></MemoryRouter>);
 expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');expect(screen.queryByText('Questionnaire record')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Retry library settings'}));await waitFor(()=>expect(screen.getByText('Questionnaire record')).toBeInTheDocument());
});
