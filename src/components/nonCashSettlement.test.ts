import {
  nonCashValue,
  nonCashSubmissionKey,
  clearNonCashSubmissionKey,
} from "./nonCashSettlement";
test("agreed painting and fractional service values use bounded currency precision", () => {
  expect(nonCashValue("1", "800")).toBe(800);
  expect(nonCashValue("10", "800")).toBe(8000);
  expect(nonCashValue("1.125", "10")).toBe(11.25);
  for (const [q, v] of [
    ["", "800"],
    ["-1", "800"],
    ["1", "0"],
    ["1", "800.001"],
    ["0.0001", "800"],
    ["1000000", "1000000000"],
  ])
    expect(nonCashValue(q, v)).toBeUndefined();
});
test("ambiguous retries reuse identity until confirmed or deliberately reset", () => {
  const original = crypto.randomUUID;
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: jest.fn(),
  });
  const uuid = jest
    .spyOn(crypto, "randomUUID")
    .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
    .mockReturnValueOnce("22222222-2222-4222-8222-222222222222");
  clearNonCashSubmissionKey();
  const first = nonCashSubmissionKey();
  expect(nonCashSubmissionKey()).toBe(first);
  clearNonCashSubmissionKey();
  expect(nonCashSubmissionKey()).not.toBe(first);
  uuid.mockRestore();
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: original,
  });
  clearNonCashSubmissionKey();
});
