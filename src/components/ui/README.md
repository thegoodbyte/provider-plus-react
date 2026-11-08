# Shared UI kit (PPVC-1002)

Every page in the admin app should build its sections, lists, and status indicators from these
five components instead of hand-rolling its own — that inconsistency (1,611 one-off `<button>`
tags across 267 files, zero shared Card/Table/Badge/Modal/EmptyState before this) is why the app
reads as a different product page to page. `AppleButton` and `AppleInput` already existed and are
solid; this kit fills the rest.

## Components

- **`Card`** / **`CardHeader`** — the one surface for a page section. `CardHeader` gives you the
  title/subtitle-left, action-right shape almost every card needs.
- **`Badge`** — status pills. Use `tone` (`success` / `warning` / `critical` / `info` / `neutral`)
  for the common cases. For a richer status system (e.g. an 11-value workflow status with its own
  established color mapping), pass `colorClassName` instead of `tone` — it fully replaces the tone
  colors rather than fighting them, so you keep your existing palette but inherit Badge's shape.
- **`Table`, `TableHead`, `TableBody`, `TableRow`, `TableHeaderCell`, `TableCell`** — compositional
  table primitives. `Table` wraps itself in `overflow-x-auto` so a wide table never makes the page
  scroll sideways. `TableHeaderCell` takes an optional `onSort`/`sortDirection` pair for sortable
  columns.
- **`Modal`** — dialog chrome (overlay, panel, header with close button, scrollable body, optional
  footer). Uses the existing `useDialogFocus` hook for Escape-to-close and a focus trap, so it
  behaves identically to the hand-rolled dialogs it replaces.
- **`EmptyState`** — the "nothing here yet" block for an empty list, with an optional action.

## Using it

```tsx
import { Card, CardHeader, Badge, Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, EmptyState } from './ui';

<Card>
  <CardHeader title="Clients" action={<AppleButton variant="primary">Add client</AppleButton>} />
  {clients.length === 0 ? (
    <EmptyState title="No clients yet" description="Clients you add will show up here." />
  ) : (
    <Table>
      <TableHead>
        <tr>
          <TableHeaderCell onSort={sortByName} sortDirection={sortField === 'name' ? sortDirection : undefined}>Name</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {clients.map((client) => (
          <TableRow key={client._id} onClick={() => openClient(client)}>
            <TableCell>{client.name}</TableCell>
            <TableCell><Badge tone="success">Confirmed</Badge></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )}
</Card>
```

## The other rule: simplicity, not just consistency

A consistent screen can still be a cluttered one. Per the epic (PPVC-1001): don't show the same
fact twice on one screen, and default to showing only what's needed to act right now — put full
detail one click away rather than laying everything out at once. The shipped Booking Overview
(PPVC-965 — four status tiles and one contact line, nothing else) is the bar. If a screen built
with this kit has noticeably more moving pieces than that without a specific reason, it's not
simple enough yet.
