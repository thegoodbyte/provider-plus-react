# PPVC-904 / PPVC-905 — scratchpad matching and date correction

Implemented locally; not pushed or deployed. No production records changed.

## PPVC-904: exact request matching with approval

1. Record the actual received money, including its request number and phone when known. Save the receipt.
2. Choose Match receipt. An exact invoice/request number prefills its client and booking. If there is one compatible existing payment for that request, linking is preselected. Otherwise staff select the appropriate existing payment or conversion.
3. Review the selected relationships and actual bank transaction. A phone mismatch is displayed as a warning. Multiple requests or payments remain an explicit choice; an unknown request number no longer produces a broad list of same-value guesses.
4. Check the review checkbox (and original-transaction confirmation when linking). Press Confirm link or Confirm conversion. Nothing is assigned or converted before this approval.

Exact invoice numbers have priority over numeric display-number collisions. Leading zeros and an optional # are supported. Matching is read-only, scopes payments to the exact request, and retains existing full amount/currency/provider/account/provenance checks. Cancelled or wrong-currency requests are identified but not prefilled as valid targets. Choosing a client with No payment request is an explicit manual override; the number/phone never authorizes a financial write.

## PPVC-905: correcting a linked/converted received date

1. Open a converted/linked row and choose Edit received date, or use its enabled pencil action in the list.
2. Enter the correct received date and a reason from the bank statement. The form exposes only date and reason; financial fields remain locked.
3. Save date correction. The scratchpad date, existing payment date and receipt date are updated. Request paid-date metadata is refreshed when applicable. Existing amounts, currencies, IDs, allocation links, account provenance, frozen FX and balances remain intact; no payment is created and no paid notification is emitted.
4. Reload to verify the date and inspect Receipt history for the actor, before/after dates and reason.
5. If interrupted, the original date/reason are retained as a durable pending correction. Retry date correction completes that same operation. A different date cannot replace an unfinished intent.

A revision check rejects stale corrections. Missing/foreign linked payments and split receipts are blocked for this action. Unassigned rows retain their existing full capture-edit workflow. Issued standalone-service allocations remain immutable through ordinary payment editing; the guarded audited correction changes their date only.

## Validation

Evidence: ../ppvc-904-905-validation/validation.json. API/admin unit suites, both builds, generated contract integrity, real standalone Mongo/Nest/JWT integration and desktop/mobile browser flows cover both tickets. Integration includes explicit approval, exact/ambiguous/missing requests, phone checks, duplicate capture/conversion safety, role/date/reason/revision validation, original financial IDs and amounts, linked/converted dates, immutable issued services, pending failure and retry, audit history and zero outgoing messages.

Tests use disposable synthetic data and disabled external delivery. No historical production migration or deployment was performed. Both tickets share the dedicated fix/PPVC-904-905-scratchpad-links branch because they modify the same scratchpad screens and reconciliation service.
