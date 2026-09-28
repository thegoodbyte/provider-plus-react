import { api } from "./api";
export type AccommodationOption = {
  key: string;
  labels: { en: string; cs: string; pl: string };
  occupancy: "shared" | "private";
  bathroom: "any" | "private";
  active: boolean;
  legacyRoomType?: string;
  prices: Record<string, number>;
};
export const roomInventoryApi = {
  options: () => api.get<AccommodationOption[]>("/room-inventory/options"),
  saveOptions: (options: AccommodationOption[]) =>
    api.patch("/room-inventory/options", { options }),
  preference: (clientId: string) =>
    api.get("/room-inventory/preference/" + clientId),
  view: (retreatId: string) => api.get("/room-inventory/retreat/" + retreatId),
  configure: (retreatId: string, body: any) =>
    api.patch("/room-inventory/retreat/" + retreatId, body),
  quote: (bookingId: string, body: any) =>
    api.post("/room-inventory/quote/" + bookingId, body),
  assign: (bookingId: string, body: any) =>
    api.patch("/bookings/" + bookingId + "/accommodation", body),
};
