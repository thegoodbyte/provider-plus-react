import React from "react";
import { render, screen } from "@testing-library/react";
import ScratchpadReceiptEmailStatus from "./ScratchpadReceiptEmailStatus";
test.each([
  ["sent", "Receipt email sent"],
  ["not_sent", "No receipt email recorded"],
  ["pending", "Receipt email queued"],
  ["failed", "Receipt email failed"],
  ["unavailable", "Receipt email status unavailable"],
])("shows an accessible envelope for %s", (status, label) => {
  render(<ScratchpadReceiptEmailStatus summary={{ status }} />);
  const icon = screen.getByRole("img", { name: new RegExp(label) });
  expect(icon).toHaveAttribute("title", expect.stringContaining(label));
  expect(screen.queryByRole("button")).toBeNull();
});
test("missing metadata never claims sent", () => {
  render(<ScratchpadReceiptEmailStatus />);
  expect(screen.getByRole("img")).toHaveAccessibleName(
    "Receipt email status unavailable",
  );
});
