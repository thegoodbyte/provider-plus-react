import React from "react";
import { render, screen } from "@testing-library/react";
import ScratchpadReceiptEmailStatus from "./ScratchpadReceiptEmailStatus";
test.each([
  ["sent", "Receipt email sent"],
  ["not_sent", "No receipt email recorded"],
  ["pending", "Receipt email queued"],
  ["failed", "Receipt email failed"],
  ["unavailable", "Receipt email status unavailable"],
])("shows an accessible receipt email status for %s", (status, label) => {
  render(<ScratchpadReceiptEmailStatus summary={{ status }} />);
  const icon = screen.getByRole("img", { name: new RegExp(label) });
  expect(icon).toHaveAttribute("title", expect.stringContaining(label));
  expect(screen.queryByRole("button")).toBeNull();
  if (status === 'sent') {
    expect(icon.querySelector('.lucide-mail-check')).not.toBeNull();
    expect(icon.querySelector('.lucide-circle')).toBeNull();
  } else {
    expect(icon.querySelector('.lucide-mail, .lucide-mail-check, .lucide-mail-warning')).toBeNull();
    expect(icon.querySelector('.lucide-circle')).not.toBeNull();
  }
});
test("missing metadata never claims sent", () => {
  const { container } = render(<ScratchpadReceiptEmailStatus />);
  expect(screen.getByRole("img")).toHaveAccessibleName(
    "Receipt email status unavailable",
  );
  expect(container.querySelector('.lucide-mail, .lucide-mail-check, .lucide-mail-warning')).toBeNull();
});
