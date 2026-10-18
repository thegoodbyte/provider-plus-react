# PPVC-889 — Integration Calls

Extends the deployed PPVC-586 calendar and PPVC-674 live-session notes rather than replacing them. Provider connections, credit accounting and invitation delivery remain controlled by their existing workflows.

## Staff workflow

1. Open Retreat Operations → Integration Calls. Switch between Calendar and List, choose a month, and filter by name, type or status.
2. Choose Schedule call for a future appointment, or Record a call now to save a direct support conversation and open its notes immediately.
3. Choose Individual or Group. Search and select clients. A direct support call needs no enrollment, credit or retreat booking. For an individual call, select an actual booking only when the conversation belongs to it.
4. For a group, select the participant roster, then use **Who will attend?** to check each confirmed attendee. Unchecked means unconfirmed. These choices are saved separately from actual attended/no-show/excused records, and unchecking does not remove a participant.
5. Set Prague date/time, duration, facilitator, optional meeting link and preparation notes. Saving sends no invitations. Resolve overlapping calls explicitly if warned.
6. Open Start notes. Optional conversation prompts cover what would be useful, current experience, challenges, support and an agreed next step. Record private staff notes, actual attendance and explicitly shared summaries in their separate fields. Wait for Saved before leaving. Follow-up actions require an owner, backup and due date.
7. Use Details / edit to change the schedule or confirmation checkboxes; cancel a call with Cancelled to retain its history.
8. Clients → client → Integration shows that client's calls. Bookings → booking → Integration shows only calls associated with that client and booking together.

For a support call with Ewa Franus, search and verify her real client record, choose Record a call now, select her, save and open notes. Do not invent a booking or fill observations before the conversation. Development verification uses Ewa Fixture, never real client notes.

## Implementation and validation

API supports optional retreat context, verified client and explicit booking selection, participant-level client/booking scope, and planned attendance boolean values. Existing authorization, stale-update, overlap and provider ownership checks remain in force. Manual support calls do not debit integration credits. Direct support follow-up actions are stored with their call; they are not represented as a booking-based care action when no booking exists.

Frontend reuses the existing live-session autosave/conflict recovery and private/shared-note separation. Administrator and facilitator navigation and profile tabs expose the workspace.

Focused regression suites, API/frontend builds, disposable real-Mongo service checks and opt-in Playwright desktop/mobile smoke tests are recorded in the workspace's ppvc-889-validation folder. The browser fixture uses synthetic staff authentication and actual business services; it does not validate the complete deployed authentication infrastructure. No production data or messages are created by these tests. Deployment is separate from implementation review.
