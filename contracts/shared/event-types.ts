// Generated from the API-owned shared contract. Do not edit this snapshot.
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
    availableTabs: [
      'clients',
      'reserveList',
      'holisticView',
      'tracking',
      'foodMatrix',
      'aiSummary',
      'drugScreening',
      'expenses',
      'payments',
      'ceremonies',
      'analytics',
      'tasks',
      'announcements',
      'rooms',
      'closeout',
      'integration',
    ],
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
    availableTabs: [
      'clients',
      'reserveList',
      'holisticView',
      'tracking',
      'foodMatrix',
      'expenses',
      'payments',
      'ceremonies',
      'analytics',
      'tasks',
      'announcements',
      'rooms',
      'closeout',
      'integration',
    ],
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
    availableTabs: [
      'clients',
      'reserveList',
      'tracking',
      'foodMatrix',
      'expenses',
      'payments',
      'analytics',
      'tasks',
      'announcements',
      'rooms',
      'closeout',
    ],
  },
  [EventType.WORKSHOP]: {
    type: EventType.WORKSHOP,
    label: 'Workshop',
    codePrefix: 'W',
    hasCeremonies: false,
    requiresMedicalScreening: false,
    hasDrugScreening: false,
    hasAccommodation: true,
    defaultCeremonyCount: 0,
    availableTabs: [
      'clients',
      'reserveList',
      'tracking',
      'foodMatrix',
      'expenses',
      'payments',
      'analytics',
      'tasks',
      'announcements',
      'rooms',
      'closeout',
    ],
  },
};

export const VALID_EVENT_TYPES: EventType[] = Object.values(EventType);

export const VALID_BOOKING_TYPES: BookingType[] = Object.values(BookingType);

export function getEventCapabilities(type?: string | null): EventTypeConfig {
  if (type && type in EVENT_CONFIGS) {
    return EVENT_CONFIGS[type as EventType];
  }
  return EVENT_CONFIGS[EventType.REGULAR];
}
