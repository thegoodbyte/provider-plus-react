import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import IntegrationLegacyGrant from "./IntegrationLegacyGrant";
import { api } from "../services/api";
jest.mock("../services/api", () => ({ api: { post: jest.fn() } }));
it("previews first and requires review evidence before explicitly granting the accepted offer", async () => {
  (api.post as jest.Mock)
    .mockResolvedValueOnce({
      data: {
        previewHash: "review-hash",
        accessStartsOn: "2026-10-12",
        expiresOn: "2026-12-11",
        homecomingDate: "2026-01-10",
        snapshot: {
          personal: {
            count: 2,
            durationMinutes: 30,
            cancellationPolicy: "restore",
            noShowPolicy: "restore",
            extensionPolicy: "staff_approval",
            maximumExtensionDays: 28,
          },
        },
      },
    })
    .mockResolvedValueOnce({ data: {} });
  const refreshed = jest.fn().mockResolvedValue(undefined);
  render(
    <IntegrationLegacyGrant
      clientId="own-client"
      disabled={false}
      onGranted={refreshed}
    />,
  );
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Preview separate legacy grant" }),
  );
  const grant = await screen.findByRole("button", {
    name: "Grant agreed legacy sessions",
  });
  expect(grant).toBeDisabled();
  expect(api.post).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText("Grant review evidence"), {
    target: { value: "Accepted offer and capacity verified" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(grant);
  await waitFor(() => expect(refreshed).toHaveBeenCalled());
  expect(api.post).toHaveBeenLastCalledWith(
    "/integration/reconnect/own-client/legacy-grant",
    expect.objectContaining({
      reviewed: true,
      previewHash: "review-hash",
      evidence: "Accepted offer and capacity verified",
    }),
  );
});
