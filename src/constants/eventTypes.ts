import { EventType, BookingType } from '../generated/contracts/shared/event-types';
import type { EventTypeConfig } from '../generated/contracts/shared/event-types';
export { EventType, BookingType };
export type { EventTypeConfig };

// UI-specific capability presentation; enum and contract identities come from the API.
export const EVENT_CONFIGS: Record<EventType, EventTypeConfig> = {
  [EventType.REGULAR]: {
    type: EventType.REGULAR,
    label: '7-Night Iboga Retreat',
    codePrefix: 'F',
    hasCeremonies: true,
    requiresMedicalScreening: true,
    hasDrugScreening: true,
    hasAccommodation: true,
    defaultCeremonyCount: 2,
    availableTabs: [],
  },
  [EventType.BOOSTER]: {
    type: EventType.BOOSTER,
    label: 'Booster',
    codePrefix: 'B',
    hasCeremonies: true,
    requiresMedicalScreening: false,
    hasDrugScreening: true,
    hasAccommodation: true,
    defaultCeremonyCount: 1,
    availableTabs: [],
  },
  [EventType.LEARNING_WEEKEND]: {
    type: EventType.LEARNING_WEEKEND,
    label: 'Bwiti Learning Weekend',
    codePrefix: 'W',
    hasCeremonies: false,
    requiresMedicalScreening: false,
    hasDrugScreening: false,
    hasAccommodation: true,
    defaultCeremonyCount: 0,
    availableTabs: [],
  },
  [EventType.WORKSHOP]: {
    type: EventType.WORKSHOP,
    label: 'Bwiti Workshop',
    codePrefix: 'W',
    hasCeremonies: false,
    requiresMedicalScreening: false,
    hasDrugScreening: false,
    hasAccommodation: true,
    defaultCeremonyCount: 0,
    availableTabs: [],
  },
};
