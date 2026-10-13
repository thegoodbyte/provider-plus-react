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
export type PaymentAccommodationInventory = {
  retreatId: string;
  house: { _id: string; name: string } | null;
  configured: boolean;
  houseChanged: boolean;
  unallocatedConfirmed: number;
  checkedAt: string;
  options: Array<
    AccommodationOption & {
      supported: boolean;
      availableUnits: number | null;
      unit: "rooms" | "beds";
    }
  >;
  rooms: Array<{
    roomId: string;
    name: string;
    floor: string;
    beds: number | null;
    hasBathroom: boolean;
    occupied: number;
    freeBeds: number | null;
    exclusiveUse: boolean;
    status: string;
  }>;
};
export const roomInventoryApi = {
  options: () => api.get<AccommodationOption[]>("/room-inventory/options"),
  saveOptions: (options: AccommodationOption[]) =>
    api.patch("/room-inventory/options", { options }),
  preference: (clientId: string) =>
    api.get("/room-inventory/preference/" + clientId),
  view: (retreatId: string) => api.get("/room-inventory/retreat/" + retreatId),
  paymentAccommodation: (retreatId: string) =>
    api.get<PaymentAccommodationInventory>(
      "/room-inventory/payment-accommodation/" + retreatId,
    ),
  configure: (retreatId: string, body: any) =>
    api.patch("/room-inventory/retreat/" + retreatId, body),
  quote: (bookingId: string, body: any) =>
    api.post("/room-inventory/quote/" + bookingId, body),
  assign: (bookingId: string, body: any) =>
    api.patch("/bookings/" + bookingId + "/accommodation", body),
};
