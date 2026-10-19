import { groupMedicalHandoffs } from "./medicalWorkGroups";
it("groups pending handoffs by advisor and keeps missing assignment blocked", () => {
  expect(
    groupMedicalHandoffs([
      { step: "A", state: "actionable" },
      {
        step: "B",
        state: "actionable",
        advisorId: "a",
        advisorLabel: "Advisor A",
      },
      {
        step: "B",
        state: "actionable",
        advisorId: "a",
        advisorLabel: "Advisor A",
      },
      { step: "B", state: "blocked" },
      { step: "B", state: "resolved", advisorId: "a" },
    ]),
  ).toEqual([
    { key: "a", label: "Advisor A", actionable: 2, blocked: 0 },
    {
      key: "unassigned",
      label: "Unassigned advisor",
      actionable: 0,
      blocked: 1,
    },
  ]);
});
