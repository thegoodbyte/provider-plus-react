// Mirrors provider-plus-nestjs's src/retreat/event-types.ts. Kept manually in
// sync -- the two repos have no shared package, so this is the frontend's own
// copy of the same enum values and capability table (PPVC-760).

export enum EventType {
  REGULAR = 'regular',
  BOOSTER = 'booster',
  LEARNING_WEEKEND = 'learning_weekend',
  WORKSHOP = 'workshop',
}

export enum BookingType {
  FULL_RETREAT = 'full_retreat',
  BOOSTER = 'booster',
  LEARNING_WEEKEND = 'learning_weekend',
  WORKSHOP = 'workshop',
}

export interface EventTypeConfig {
  type: EventType;
  label: string;
  codePrefix: string;
  hasCeremonies: boolean;
  requiresMedicalScreening: boolean;
  hasDrugScreening: boolean;
  hasAccommodation: boolean;
  defaultCeremonyCount: number;
  availableTabs: string[];
}

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
