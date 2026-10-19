import { api } from "./api";
import type { EkgRequirementProjection } from "../types/ekgRequirement";
export const ekgRequirementApi = {
  get: (bookingId: string) =>
    api.get<EkgRequirementProjection>(
      `/booking-flow/bookings/${bookingId}/requirement-projection/ekg`,
      { suppressGlobalError: true } as any,
    ),
};
