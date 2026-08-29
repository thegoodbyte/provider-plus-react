import { api } from './api';
import { clientFoodFormsApi } from './clientFoodFormsApi';
import { clientMedicationsApi } from './clientMedicationsApi';

jest.mock('./api', () => ({ api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() } }));
const mockedApi = api as any;

describe('client form APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const method of ['get', 'post', 'patch', 'delete']) mockedApi[method].mockResolvedValue({ data: method });
  });

  it('supports every food-form operation and PDF URL', async () => {
    const update = { status: 'reviewed' } as any;
    await clientFoodFormsApi.getAll(); await clientFoodFormsApi.getOne('f1');
    await clientFoodFormsApi.update('f1', update); await clientFoodFormsApi.delete('f1');
    expect(mockedApi.get.mock.calls).toEqual([['/client-food-forms'], ['/client-food-forms/f1']]);
    expect(mockedApi.patch).toHaveBeenCalledWith('/client-food-forms/f1', update);
    expect(mockedApi.delete).toHaveBeenCalledWith('/client-food-forms/f1');
    expect(clientFoodFormsApi.pdfUrl('f1')).toContain('/client-food-forms/f1/pdf');
  });

  it('supports medication CRUD, client lookup, and download URL', async () => {
    const create: any = { client_id: 'c1', date_collected: new Date() };
    const update: any = { admin_notes: 'review' };
    await clientMedicationsApi.getAll(); await clientMedicationsApi.getByClient('c1'); await clientMedicationsApi.getOne('m1');
    await clientMedicationsApi.create(create); await clientMedicationsApi.update('m1', update); await clientMedicationsApi.delete('m1');
    expect(mockedApi.get.mock.calls).toEqual([['/client-medications'], ['/client-medications/client/c1'], ['/client-medications/m1']]);
    expect(mockedApi.post).toHaveBeenCalledWith('/client-medications', create);
    expect(mockedApi.patch).toHaveBeenCalledWith('/client-medications/m1', update);
    expect(mockedApi.delete).toHaveBeenCalledWith('/client-medications/m1');
    expect(clientMedicationsApi.downloadPdfUrl('m1')).toBe('/client-medications/m1/download-pdf');
  });

  it('uploads medication PDFs as multipart form data', async () => {
    const file = new File(['pdf'], 'medications.pdf', { type: 'application/pdf' });
    await clientMedicationsApi.uploadPdf('m1', file);
    const [url, body, config] = mockedApi.post.mock.calls[0];
    expect(url).toBe('/client-medications/m1/upload-pdf');
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('pdf')).toBe(file);
    expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });
  });
});
