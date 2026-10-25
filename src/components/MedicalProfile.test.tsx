import { render, screen, within, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import MedicalProfile from './MedicalProfile';
import { medicalArtifactsApi, medicalReviewRequestsApi } from '../services/api';
jest.mock('../services/api', () => ({ medicalArtifactsApi: { getAll: jest.fn() }, medicalReviewRequestsApi: { getAll: jest.fn() } }));
const clientId = '000000000000000000001220';
const ekg: any = { _id: 'ekg-source', clientId, documentType: 'EKG', artifactType: 'ekg', status: 'stored', files: [{ fileName: 'EKG.jpg', s3Key: 'private/ekg.jpg' }], receivedAt: '2026-10-24' };
const liver: any = { _id: 'liver-source', clientId, documentType: 'Liver', artifactType: 'liver_panel', status: 'stored', files: [{ fileName: 'Liver.png', s3Key: 'private/liver.png' }], receivedAt: '2026-10-24' };
const response = (data: any, status = 200) => ({ ok: status < 400, status, json: async () => data });
beforeEach(() => {
  localStorage.setItem('user', JSON.stringify({ role: 'admin' }));
  global.fetch = jest.fn(async (url: any) => response(String(url).includes('/client-medical/') ? [] : { _id: clientId, display_id: 1220, firstName: 'Synthetic', lastName: 'Client' })) as any;
  (medicalArtifactsApi.getAll as jest.Mock).mockResolvedValue({ data: [ekg, liver] });
  (medicalReviewRequestsApi.getAll as jest.Mock).mockResolvedValue({ data: [
    { _id: 'review-liver', display_id: 1437, clientId, artifactIds: [liver._id], status: 'approved', reviewDecision: 'OK' },
    { _id: 'review-ekg', display_id: 1438, clientId, artifactIds: [ekg._id], status: 'awaiting_whatsapp', whatsappStatus: 'awaiting_response' },
  ] });
});
function open() { return render(<MemoryRouter initialEntries={['/admin/medical/' + clientId]}><Routes><Route path="/admin/medical/:clientId" element={<MedicalProfile/>}/></Routes></MemoryRouter>); }
it('shows source documents and their distinct MRR states with an empty legacy list', async () => {
  open(); expect(await screen.findByText('EKG.jpg')).toBeInTheDocument();
  const liverCard = screen.getByRole('region', { name: 'Liver Panel' });
  expect(within(liverCard).getByText('Approved')).toBeInTheDocument();
  expect(within(liverCard).getByRole('link', { name: 'MRR #1437' })).toHaveAttribute('href', '/admin/medical-review-requests/review-liver');
  const ekgCard = screen.getByRole('region', { name: 'EKG Report' });
  expect(within(ekgCard).getByText('Awaiting WhatsApp response')).toBeInTheDocument();
  expect(within(ekgCard).getByRole('link', { name: 'View Document' })).toHaveAttribute('href', '/admin/medical-artifacts/ekg-source/files/0');
  expect(screen.queryByText(/No EKG uploaded/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Submit EKG Review' })).not.toBeInTheDocument();
  expect(medicalArtifactsApi.getAll).toHaveBeenCalledWith({ clientId }, expect.objectContaining({ suppressGlobalError: true }));
});
it('does not require a timestamp to acknowledge an existing document', async () => {
  (medicalArtifactsApi.getAll as jest.Mock).mockResolvedValue({ data: [{ ...ekg, receivedAt: undefined }] });
  open(); expect(await screen.findByText('EKG.jpg')).toBeInTheDocument();
  expect(screen.getByText('Received date not recorded')).toBeInTheDocument();
});
it('does not turn failed source reads into a missing-document claim', async () => {
  (medicalArtifactsApi.getAll as jest.Mock).mockRejectedValue(new Error('unavailable'));
  open(); await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Medical documents could not be loaded'));
  expect(screen.queryByText(/No EKG uploaded/)).not.toBeInTheDocument();
  expect(screen.getAllByText('Document availability could not be confirmed.')).toHaveLength(2);
});
it('preserves a legacy document when the modern source is empty', async () => {
  (global.fetch as jest.Mock).mockImplementation(async (url: any) => response(String(url).includes('/client-medical/') ? [{ _id: 'legacy', clientId, ekgStatus: 'approved', ekgFileName: 'Legacy.pdf', ekgFilePath: '/uploads/legacy.pdf', ekgReceivedDate: '2026-10-20' }] : { _id: clientId, firstName: 'Synthetic' }));
  (medicalArtifactsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });open();
  expect(await screen.findByText('Legacy.pdf')).toBeInTheDocument();expect(within(screen.getByRole('region', { name: 'EKG Report' })).getByText('Approved')).toBeInTheDocument();
});

it('keeps documents visible when legacy lookup fails and warns about missing review access', async () => {
  (global.fetch as jest.Mock).mockImplementation(async (url: any) => response(String(url).includes('/client-medical/') ? {} : { _id: clientId, firstName: 'Synthetic' }, String(url).includes('/client-medical/') ? 500 : 200));
  (medicalReviewRequestsApi.getAll as jest.Mock).mockRejectedValue(new Error('denied'));
  open(); expect(await screen.findByText('EKG.jpg')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Medical review status could not be loaded');
  expect(screen.getByRole('alert')).toHaveTextContent('Legacy medical records could not be loaded');
});
it('does not enable legacy clearance writes just because both modern MRRs are approved', async () => {
  (medicalReviewRequestsApi.getAll as jest.Mock).mockResolvedValue({ data: [ekg, liver].map((item, i) => ({ _id:'review-'+i, clientId, artifactIds:[item._id], status:'approved', reviewDecision:'OK' })) });
  open(); await screen.findByText('EKG.jpg');
  expect(screen.queryByRole('heading', {name:'Final Medical Clearance'})).not.toBeInTheDocument();
});
it('ignores a delayed response from the previous client', async () => {
  const second='000000000000000000001221'; let resolveFirst: any;
  (medicalArtifactsApi.getAll as jest.Mock).mockImplementation(({clientId:id}: any) => id === clientId ? new Promise(resolve => { resolveFirst=resolve; }) : Promise.resolve({data:[]}));
  (medicalReviewRequestsApi.getAll as jest.Mock).mockResolvedValue({data:[]});
  (global.fetch as jest.Mock).mockImplementation(async (url:any) => response(String(url).includes('/client-medical/') ? [] : {_id:String(url).endsWith(second)?second:clientId,firstName:String(url).endsWith(second)?'Second':'First'}));
  function Switch() {const navigate=useNavigate();return <button onClick={()=>navigate('/admin/medical/'+second)}>Next client</button>;}
  render(<MemoryRouter initialEntries={['/admin/medical/'+clientId]}><Switch/><Routes><Route path="/admin/medical/:clientId" element={<MedicalProfile/>}/></Routes></MemoryRouter>);
  await waitFor(()=>expect(resolveFirst).toBeDefined());fireEvent.click(screen.getByRole('button',{name:'Next client'}));
  await screen.findByRole('heading',{name:'Second'});
  await act(async()=>{resolveFirst({data:[ekg,liver]});});
  expect(screen.getByRole('heading',{name:'Second'})).toBeInTheDocument();expect(screen.queryByText('EKG.jpg')).not.toBeInTheDocument();
});
