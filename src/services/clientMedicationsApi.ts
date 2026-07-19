import { api } from './api';

export interface ClientMedication {
  _id: string;
  display_id: number;
  client_id: string;
  pdf_file?: string;
  date_collected: Date;
  admin_notes: string;
  medstaff_review_notes: string;
  createdAt: Date;
  updatedAt: Date;
  language?: 'en' | 'cs' | 'pl';
  status?: 'draft' | 'submitted' | 'reviewed';
  lookback_days?: number;
  submitted_at?: Date;
  entries?: Array<{ name: string; category?: string; dose?: string; frequency?: string; reason?: string; last_taken_date?: Date; notes?: string; images?: any[] }>;
}

export interface CreateClientMedicationDto {
  display_id?: number;
  client_id: string;
  pdf_file?: string;
  date_collected: Date;
  admin_notes?: string;
  medstaff_review_notes?: string;
}

export interface UpdateClientMedicationDto {
  display_id?: number;
  client_id?: string;
  pdf_file?: string;
  date_collected?: Date;
  admin_notes?: string;
  medstaff_review_notes?: string;
}

export const clientMedicationsApi = {
  // Get all client medications
  getAll: () =>
    api.get<ClientMedication[]>('/client-medications'),

  // Get client medications for specific client
  getByClient: (clientId: string) =>
    api.get<ClientMedication[]>(`/client-medications/client/${clientId}`),

  // Get single client medication
  getOne: (id: string) =>
    api.get<ClientMedication>(`/client-medications/${id}`),

  // Create new client medication
  create: (data: CreateClientMedicationDto) =>
    api.post<ClientMedication>('/client-medications', data),

  // Update client medication
  update: (id: string, data: UpdateClientMedicationDto) =>
    api.patch<ClientMedication>(`/client-medications/${id}`, data),

  // Delete client medication
  delete: (id: string) =>
    api.delete(`/client-medications/${id}`),

  // Upload PDF file
  uploadPdf: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('pdf', file);

    return api.post(`/client-medications/${id}/upload-pdf`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  downloadPdfUrl: (id: string) => `/client-medications/${id}/download-pdf`,
};
