import { api } from "./api";
export const integrationCalendarApi = {
  get: (params: { retreatId?: string; from?: string; to?: string }) =>
    api.get("/integration/calendar", { params }),
  save: (id: string | undefined, body: any) =>
    id
      ? api.patch("/integration/calls/" + id, body)
      : api.post("/integration/calls", body),
};
