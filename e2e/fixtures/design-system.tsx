import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ConfigProvider, Select, DatePicker, InputNumber, Input } from "antd";
import "../../src/index.css";
import "../../src/styles/workspace.css";
import "../../src/design/tokens.css";
import "../../src/design/system.css";
import { appTheme } from "../../src/design/theme";
import AppleButton from "../../src/components/AppleButton";
import AppleInput from "../../src/components/AppleInput";
import {
  Card,
  CardHeader,
  Badge,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableHeaderCell,
  Modal,
} from "../../src/components/ui";
function Reference() {
  const [open, setOpen] = useState(false),
    [value, setValue] = useState("elena@example.test");
  return (
    <ConfigProvider theme={appTheme}>
      <main className="re-shell mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
        <h1 className="text-2xl font-bold">Retreat Engine design reference</h1>
        <Card>
          <CardHeader title="Shared controls" />
          <div className="flex flex-wrap gap-3">
            <AppleButton onClick={() => setOpen(true)}>
              Review booking
            </AppleButton>
            <AppleButton variant="secondary">Cancel</AppleButton>
            <AppleButton variant="ghost">View history</AppleButton>
            <AppleButton variant="danger">Cancel booking</AppleButton>
            <AppleButton disabled>Unavailable action</AppleButton>
          </div>
          <div className="mt-5 max-w-sm">
            <AppleInput
              label="Client email"
              type="email"
              value={value}
              onChange={setValue}
            />
            <AppleInput
              label="Invalid email"
              value="invalid"
              onChange={() => {}}
              error="Enter a valid email"
            />
            <AppleInput
              label="Disabled email"
              value="locked@example.test"
              onChange={() => {}}
              disabled
            />
            <label className="mt-3 block">
              Arrival date
              <DatePicker aria-label="Arrival date" className="mt-2 w-full" />
            </label>
            <label className="mt-3 block">
              Guests
              <InputNumber aria-label="Guests" className="mt-2 w-full" />
            </label>
            <label className="mt-3 block">
              Reference
              <Input aria-label="Reference" prefix="@" className="mt-2" />
            </label>
            <label className="mt-3 block">
              Retreat
              <Select
                aria-label="Retreat"
                className="mt-2 w-full"
                defaultValue="winter"
                options={[
                  { value: "winter", label: "Winter retreat" },
                  { value: "spring", label: "Spring retreat" },
                ]}
              />
            </label>
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Booking · Elena Petrova"
            subtitle="JNO-1206 · Dec6–13,2026"
          />
          <div className="flex flex-wrap gap-3">
            <Badge tone="warning" dot>
              Balance due €2,450
            </Badge>
            <Badge tone="warning" dot>
              Waiting on liver panel
            </Badge>
            <Badge tone="success" dot>
              Contract signed
            </Badge>
            <Badge tone="success" dot>
              Confirmation sent
            </Badge>
            <Badge tone="info" dot>
              Overpaid €150
            </Badge>
            <Badge tone="critical" dot>
              Overdue
            </Badge>
            <Badge>Draft</Badge>
          </div>
        </Card>
        <Card padding="none">
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Client</TableHeaderCell>
                <TableHeaderCell>Payment</TableHeaderCell>
                <TableHeaderCell>Medical</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>Elena Petrova</TableCell>
                <TableCell>
                  <Badge tone="warning">Balance due €2,450</Badge>
                </TableCell>
                <TableCell>
                  <Badge tone="warning">Pending liver panel</Badge>
                </TableCell>
                <TableCell>Conditional</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Review booking"
          footer={
            <AppleButton variant="secondary" onClick={() => setOpen(false)}>
              Close review
            </AppleButton>
          }
        >
          <p>Outstanding balance and medical evidence still need review.</p>
          <AppleInput label="Review note" value={value} onChange={setValue} />
        </Modal>
      </main>
    </ConfigProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Reference />);
