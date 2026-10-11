import { api } from "./api";

export interface ProgramConfig {
  timezone: string;
  owner: string;
  backup: string;
  bookingUrl: string;
  groupCalls: {
    key: string;
    title: string;
    targetDay: number;
    earliestDay: number;
    latestDay: number;
    durationMinutes: number;
  }[];
  personal: {
    count: number;
    durationMinutes: number;
    accessDays: number;
    cancellationPolicy: string;
    noShowPolicy: string;
    extensionPolicy: string;
    maximumExtensionDays: number;
  };
  emails: { key: string; title: string; day: number }[];
  channels: string[];
  dailyContactCap: number;
  quietStart: string;
  quietEnd: string;
  review: {
    contentReference: string;
    contentReviewed: boolean;
    capacityReviewed: boolean;
  };
}
export interface Program {
  _id: string;
  name: string;
  revision: number;
  archived: boolean;
  draft: ProgramConfig;
  versions: {
    number: number;
    name: string;
    config: ProgramConfig;
    publishedAt: string;
  }[];
}
export interface Enrollment {
  _id: string;
  bookingId: string;
  clientId: {
    firstName?: string;
    lastName?: string;
    fname?: string;
    lname?: string;
  };
  retreatId: string;
  programId: string;
  programVersion: number;
  revision: number;
  homecomingDate: string;
  status: string;
  snapshot: ProgramConfig;
}
export interface BookingOption {
  id: string;
  name: string;
  retreatName: string;
  suggestedHomecomingDate: string;
  defaultProgramId: string | null;
}
export interface EnrollmentInput {
  bookingId?: string;
  programId: string;
  programVersion: number;
  expectedRevision?: number;
  homecomingDate: string;
  status: string;
  config: ProgramConfig;
  previewHash?: string;
}
export interface Schedule {
  groupCalls: {
    key: string;
    title: string;
    targetDate: string;
    earliestDate: string;
    latestDate: string;
    pastWindow: boolean;
    planningState: string;
  }[];
  emails: { key: string; title: string; date: string; state: string }[];
  personalExpiresOn: string;
}
export interface ProgramPreview {
  previewHash: string;
  schedule: Schedule;
  beforeSchedule: Schedule | null;
  warnings: string[];
}
export const integrationProgramsApi = {
  list: () =>
    api.get<{
      programs: Program[];
      defaults: { _id: string; programId: string }[];
      starter: ProgramConfig;
    }>("/integration/programs"),
  save: (
    id: string | undefined,
    body: { name: string; config: ProgramConfig; expectedRevision?: number },
  ) =>
    id
      ? api.patch<Program>(`/integration/programs/${id}`, body)
      : api.post<Program>("/integration/programs", body),
  publish: (p: Program) =>
    api.post<Program>(`/integration/programs/${p._id}/publish`, {
      expectedRevision: p.revision,
    }),
  archive: (p: Program) =>
    api.post<Program>(`/integration/programs/${p._id}/archive`, {
      expectedRevision: p.revision,
      archived: !p.archived,
    }),
  setDefault: (type: string, programId: string) =>
    api.post(`/integration/program-defaults/${type}`, { programId }),
  enrollments: () =>
    api.get<{ enrollments: Enrollment[]; bookings: BookingOption[] }>(
      "/integration/enrollments",
    ),
  preview: (id: string | undefined, body: EnrollmentInput) =>
    api.post<ProgramPreview>(
      id
        ? `/integration/enrollments/${id}/preview`
        : "/integration/enrollments/preview",
      body,
    ),
  enroll: (id: string | undefined, body: EnrollmentInput) =>
    id
      ? api.patch(`/integration/enrollments/${id}`, body)
      : api.post("/integration/enrollments", body),
};
