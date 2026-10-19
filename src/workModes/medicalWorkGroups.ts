export function groupMedicalHandoffs(items: any[]) {
  const groups = new Map<
    string,
    { key: string; label: string; actionable: number; blocked: number }
  >();
  for (const item of items.filter(
    (i) => i.step === "B" && i.state !== "resolved",
  )) {
    const key = item.advisorId || "unassigned";
    const group = groups.get(key) || {
      key,
      label:
        item.advisorLabel ||
        (item.advisorId ? `Advisor #${item.advisorId}` : "Unassigned advisor"),
      actionable: 0,
      blocked: 0,
    };
    if (item.state === "actionable") group.actionable++;
    if (item.state === "blocked") group.blocked++;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.label.localeCompare(b.label));
}
