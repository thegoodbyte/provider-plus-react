import { api } from "./api";
export const integrationCalendarApi = {
  supportRequests: (retreatId?: string) => api.get("/integration/support-requests", { params: { retreatId } }),
  updateSupportRequest: (id: string, status: string) => api.patch("/integration/support-requests/" + id, { status }),
  get: (params: { retreatId?: string; from?: string; to?: string }) =>
    api.get("/integration/calendar", { params }),
  save: (id: string | undefined, body: any) =>
    id
      ? api.patch("/integration/calls/" + id, body)
      : api.post("/integration/calls", body),
};
