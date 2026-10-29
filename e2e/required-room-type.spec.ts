import { test, expect } from "@playwright/test";
import fs from "node:fs";
const source = process.env.REQUIRED_ROOM_FIXTURE,
  irBase = process.env.REQUIRED_ROOM_IR_URL;
test.skip(
  !source || !irBase,
  "Requires actual API/Mongo fixture and IR server",
);
for (const width of [1440, 390])
  test(`required room choice persists through screening, booking and IR at ${width}px`, async ({
    page,
    request,
    browser,
  }) => {
    const f = JSON.parse(fs.readFileSync(source!, "utf8"));
    expect((await request.post(f.url + "/fixture/reset")).ok()).toBe(true);
    const before = await (await request.get(f.url + "/fixture/state")).json();
    await page.setViewportSize({ width, height: 980 });
    await page.addInitScript((t) => {
      localStorage.setItem("token", t);
      localStorage.setItem(
        "user",
        JSON.stringify({ role: "admin", email: "synthetic@example.invalid" }),
      );
    }, f.tokens.admin);
    async function routePage(p: any, role: "admin" | "client") {
      await p.route("**/*", async (route: any) => {
        const q = route.request();
        if (!["xhr", "fetch"].includes(q.resourceType()))
          return route.continue();
        const u = new URL(q.url()),
          path = u.pathname
            .replace(/^\/api(?=\/)/, "")
            .replace(/^\/client(?=\/)/, "/client-portal");
        if (role === "client" && path === "/client-portal/account")
          return route.fulfill({
            json: {
              profile: { firstName: "Synthetic", language: "en" },
              portalExperience: {
                audience: "potential",
                workflowStatus: "entered",
                modules: ["account", "screening_questionnaire"],
                requirements: { ekg: false, liverPanel: false },
                media: [],
                accessGate: {
                  enabled: true,
                  required: true,
                  satisfied: true,
                  preContractModules: [],
                },
              },
            },
          });
        if (
          path.startsWith("/initial-questionnaires") ||
          path === "/client-portal/screening-questionnaire" ||
          path.startsWith("/clients") ||
          path.startsWith("/bookings") ||
          path.startsWith("/room-inventory") ||
          path === "/retreats"
        )
          return route.fulfill({
            response: await route.fetch({
              url: f.url + path + u.search,
              headers: {
                ...q.headers(),
                Authorization: "Bearer " + f.tokens[role],
              },
            }),
          });
        if (path === "/environment/status")
          return route.fulfill({
            json: { environment: "local", production: false, enabledJobs: [] },
          });
        if (
          path.includes("config-summary") ||
          path === "/users/navigation-permissions"
        )
          return route.fulfill({ json: {} });
        return route.fulfill({ json: [] });
      });
    }
    await routePage(page, "admin");
    await page.goto("/admin/clients/" + f.ids.clients[0] + "/screening");
    const screenRoom = page.getByRole("combobox", {
      name: /Desired accommodation/,
    });
    await expect(screenRoom).toHaveJSProperty("required", true);
    await expect(screenRoom).toHaveValue("");
    await page
      .getByRole("button", {
        name: "Save screening without leaving this page",
        exact: true,
      })
      .last()
      .click();
    await expect(
      page.getByText("Choose a Shared or Private room type before saving.", {
        exact: true,
      }),
    ).toBeVisible();
    expect(
      (await (await request.get(f.url + "/fixture/state")).json()).clients,
    ).toEqual(before.clients);
    await screenRoom.selectOption("shared");
    const saveScreen = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname.endsWith("/screening") &&
        r.request().method() === "PUT",
    );
    await page
      .getByRole("button", {
        name: "Save screening without leaving this page",
        exact: true,
      })
      .last()
      .click();
    expect((await saveScreen).status()).toBe(200);
    await page.reload();
    await expect(screenRoom).toHaveValue("shared");
    await screenRoom.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${process.env.REQUIRED_ROOM_ARTIFACT_DIR || "test-results"}/screen-${width}.png`,
    });
    await page.goto(
      "/admin/bookings/new?clientId=" +
        f.ids.clients[0] +
        "&retreatId=" +
        f.ids.retreat +
        "&totalAmount=9500&currency=PLN&paymentPlanEnabled=false",
    );
    const bookingRoom = page.getByRole("combobox", { name: /^Accommodation/ });
    await expect(bookingRoom).toHaveJSProperty("required", true);
    await expect(bookingRoom).toHaveValue("shared");
    await bookingRoom.selectOption("");
    expect(
      await bookingRoom.evaluate((el: HTMLSelectElement) => el.checkValidity()),
    ).toBe(false);
    await page
      .getByRole("button", { name: "Add Booking", exact: true })
      .click();
    expect(
      (await (await request.get(f.url + "/fixture/state")).json()).bookings,
    ).toHaveLength(before.bookings.length);
    await bookingRoom.selectOption("private_ensuite");
    const created = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/bookings" &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Add Booking", exact: true })
      .click();
    const response = await created;
    expect(response.status()).toBe(201);
    const booking = await response.json();
    await page.goto("/admin/bookings/" + booking._id + "/edit");
    await expect(bookingRoom).toHaveValue("private_ensuite");
    await bookingRoom.selectOption("shared");
    const edited = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === "/bookings/" + booking._id &&
        r.request().method() === "PATCH",
    );
    await page
      .getByRole("button", { name: "Update Booking", exact: true })
      .click();
    expect((await edited).status()).toBe(200);
    await page.goto("/admin/bookings/" + booking._id + "/edit");
    await expect(bookingRoom).toHaveValue("shared");
    await bookingRoom.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${process.env.REQUIRED_ROOM_ARTIFACT_DIR || "test-results"}/booking-${width}.png`,
    });
    const context = await browser.newContext({
      viewport: { width, height: 980 },
    });
    const ir = await context.newPage();
    ir.on("pageerror", (e) => console.log("IR page error:", e.message));
    await ir.addInitScript(
      ({ token, id }) => {
        localStorage.setItem("client_auth_token", token);
        localStorage.setItem(
          "auth-storage",
          JSON.stringify({
            state: {
              user: {
                id,
                name: "Synthetic Guest",
                role: "client",
                language: "en",
                email: "synthetic@example.invalid",
              },
              token,
              isAuthenticated: true,
            },
            version: 0,
          }),
        );
        sessionStorage.setItem("profile-photo-prompt-dismissed", "1");
      },
      { token: f.tokens.client, id: f.ids.clients[0] },
    );
    await routePage(ir, "client");
    await ir.goto(irBase + "/questionnaire?token=" + f.invite);
    const preference = ir.getByRole("combobox", {
      name: /Desired accommodation/,
    });
    await expect(preference).toHaveJSProperty("required", true);
    await expect(preference).toHaveValue("");
    await expect(ir.getByRole("textbox", { name: /First name/ })).toHaveValue(
      "Anna",
    );
    await ir
      .getByRole("textbox", { name: /What brings you/ })
      .fill("Synthetic healing goal");
    await ir
      .getByRole("textbox", { name: /Electronic signature/ })
      .fill("Synthetic Guest");
    await ir.getByRole("checkbox", { name: /I confirm/ }).check();
    await expect(
      ir.getByRole("button", { name: "Submit questionnaire", exact: true }),
    ).toBeDisabled();
    await preference.selectOption("private");
    await preference.scrollIntoViewIfNeeded();
    await ir.screenshot({
      path: `${process.env.REQUIRED_ROOM_ARTIFACT_DIR || "test-results"}/ir-room-${width}.png`,
    });
    const submitted = ir.waitForResponse(
      (r) =>
        r.url().includes("initial-questionnaires/public") &&
        r.request().method() === "POST",
    );
    await ir
      .getByRole("button", { name: "Submit questionnaire", exact: true })
      .click();
    expect((await submitted).status()).toBe(201);
    await expect(ir.getByRole("status")).toContainText("securely received");
    await ir.screenshot({
      path: `${process.env.REQUIRED_ROOM_ARTIFACT_DIR || "test-results"}/ir-${width}.png`,
    });
    await context.close();
    await page.goto("/admin/clients/" + f.ids.clients[0] + "/screening");
    await expect(screenRoom).toHaveValue("private");

    const after = await (await request.get(f.url + "/fixture/state")).json();
    expect(after.clients[0].screeningData.desiredAccommodationKey).toBe(
      "private",
    );
    expect(
      after.bookings.find((b: any) => b._id === booking._id).roomType,
    ).toBe("shared");
    expect(after.clients.slice(1)).toEqual(before.clients.slice(1));
    expect(after.payments).toEqual(before.payments);
    expect(after.emails).toEqual([]);
  });
