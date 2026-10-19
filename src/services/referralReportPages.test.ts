import { completeReferralReport } from "./referralReportPages";
it("loads all pages including empty attribution pages before returning totals", async () => {
  const fetch = jest
    .fn()
    .mockResolvedValueOnce({
      data: {
        rows: [{ bookingId: "old-unpaid" }],
        nextCursor: "a",
        asOf: "boundary",
      },
    })
    .mockResolvedValueOnce({
      data: { rows: [], nextCursor: "b", asOf: "boundary" },
    })
    .mockResolvedValueOnce({
      data: {
        rows: [{ bookingId: "new-paid" }],
        nextCursor: null,
        asOf: "boundary",
      },
    });
  expect((await completeReferralReport(fetch)).data).toEqual([
    { bookingId: "old-unpaid" },
    { bookingId: "new-paid" },
  ]);
  expect(fetch.mock.calls).toEqual([
    [{ cursor: undefined, asOf: undefined }],
    [{ cursor: "a", asOf: "boundary" }],
    [{ cursor: "b", asOf: "boundary" }],
  ]);
});
it("rejects the whole report if a later page fails rather than reporting partial balances", async () => {
  const fetch = jest
    .fn()
    .mockResolvedValueOnce({
      data: {
        rows: [{ bookingId: "first" }],
        nextCursor: "a",
        asOf: "boundary",
      },
    })
    .mockRejectedValueOnce(new Error("unavailable"));
  await expect(completeReferralReport(fetch)).rejects.toThrow("unavailable");
});
it.each([{}, { rows: [], nextCursor: null, asOf: 3 }])(
  "rejects malformed page %p",
  async (data) => {
    await expect(
      completeReferralReport(jest.fn().mockResolvedValue({ data })),
    ).rejects.toThrow("invalid");
  },
);
it("rejects cursor cycles and changing boundaries", async () => {
  const page = { rows: [], nextCursor: "a", asOf: "boundary" };
  await expect(
    completeReferralReport(jest.fn().mockResolvedValue({ data: page })),
  ).rejects.toThrow("advance");
  const fetch = jest
    .fn()
    .mockResolvedValueOnce({ data: page })
    .mockResolvedValueOnce({ data: { ...page, asOf: "changed" } });
  await expect(completeReferralReport(fetch)).rejects.toThrow("invalid");
});
