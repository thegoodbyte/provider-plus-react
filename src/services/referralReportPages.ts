import type { ReferralReportRow } from "../types";
export interface ReferralReportPage {
  rows: ReferralReportRow[];
  nextCursor: string | null;
  asOf: string;
}
/** Return complete totals only. Any failed/malformed page rejects the entire read. */
export async function completeReferralReport(
  fetchPage: (params: {
    cursor?: string;
    asOf?: string;
  }) => Promise<{ data: ReferralReportPage }>,
) {
  const rows: ReferralReportRow[] = [];
  let cursor: string | undefined, asOf: string | undefined;
  const seen = new Set<string>();
  while (true) {
    const response = await fetchPage({ cursor, asOf }),
      page = response.data;
    if (
      !page ||
      !Array.isArray(page.rows) ||
      typeof page.asOf !== "string" ||
      (page.nextCursor !== null && typeof page.nextCursor !== "string") ||
      (asOf && page.asOf !== asOf)
    )
      throw new Error("Referral report page is invalid. Refresh to retry.");
    rows.push(...page.rows);
    asOf = page.asOf;
    if (!page.nextCursor) return { ...response, data: rows };
    if (seen.has(page.nextCursor))
      throw new Error(
        "Referral report cursor did not advance. Refresh to retry.",
      );
    seen.add(page.nextCursor);
    cursor = page.nextCursor;
  }
}
