import tokens from "./tokens.json";
const luminance = (hex: string) => {
  const channels = hex
    .replace("#", "")
    .match(/../g)!
    .map((x) => parseInt(x, 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (a: string, b: string) => {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
test.each(["success", "warning", "critical", "info"] as const)(
  "semantic %s status text meets normal-text contrast",
  (tone) => {
    expect(
      contrast(tokens.colors[tone], tokens.colors[`${tone}Soft`]),
    ).toBeGreaterThanOrEqual(4.5);
  },
);
test("primary action and secondary copy stay readable on approved surfaces", () => {
  expect(
    contrast(tokens.colors.primary, tokens.colors.surface),
  ).toBeGreaterThanOrEqual(4.5);
  expect(
    contrast(tokens.colors.muted, tokens.colors.canvas),
  ).toBeGreaterThanOrEqual(4.5);
});
