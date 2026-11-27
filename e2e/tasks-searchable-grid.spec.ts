import { test, expect } from "@playwright/test";
import fs from "node:fs";
const file = process.env.TASK_ASSIGNMENT_FIXTURE,
  f = file ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
test.skip(
  !file,
  "Requires real task-assignment API/Mongo fixture from the complete coverage runner.",
);
test.describe.configure({ mode: "serial" });
for (const width of [1440, 390])
  test(`searchable task grid, exact client ID, assignee and saved completion at ${width}px`, async ({
    page,
    request,
  }, info) => {
    test.setTimeout(90000);
    await request.post(f.url + "/fixture/assignment-reset");
    const headers = { Authorization: "Bearer " + f.tokens.admin };
    const created: any[] = [];
    for (let i = 0; i < 13; i++) {
      const date = new Date();
      date.setDate(date.getDate() + (i === 0 ? -3 : i === 1 ? -1 : i));
      date.setHours(12, 0, 0, 0);
      const response = await request.post(f.url + "/tasks", {
        headers,
        data: {
          name:
            i === 0
              ? "Upload EKG and liver results"
              : i === 1
                ? "Call guest about arrival"
                : `Synthetic task ${i}`,
          description: "Synthetic regression task",
          type: i < 8 ? "client" : "generic",
          ...(i < 8 ? { clientId: f.ids.client } : {}),
          ...(i === 0 ? { assignedToUserId: f.ids.users[1] } : {}),
          dueDate: date.toISOString(),
          urgency: i === 0 ? "high" : "medium",
          status: i > 10 ? "completed" : "pending",
          notifyClient: false,
          visibleToClient: false,
        },
      });
      expect(response.status()).toBe(201);
      created.push(await response.json());
    }
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(
      ({ token, id }) => {
        localStorage.setItem("token", token);
        localStorage.setItem(
          "user",
          JSON.stringify({ id, role: "admin", email: "owner@example.invalid" }),
        );
      },
      { token: f.tokens.admin, id: f.ids.users[0] },
    );
    await page.route("**/*", async (route) => {
      const q = route.request(),
        u = new URL(q.url());
      if (!["xhr", "fetch"].includes(q.resourceType())) return route.continue();
      if (
        u.pathname.startsWith("/tasks") ||
        ["/clients", "/retreats", "/bookings"].includes(u.pathname)
      )
        return route.fulfill({
          response: await route.fetch({ url: f.url + u.pathname + u.search }),
        });
      if (q.method() !== "GET") return route.abort();
      if (u.pathname === "/environment/status")
        return route.fulfill({
          json: { environment: "local", production: false, enabledJobs: [] },
        });
      return route.fulfill({ json: [] });
    });
    await page.goto("/admin/tasks");
    await expect(
      page.getByRole("columnheader", { name: /Client ID/ }),
    ).toBeAttached();
    await expect(
      page.getByRole("columnheader", { name: /Assignee/ }),
    ).toBeAttached();
    await expect(
      page.getByRole("tab", { name: "Open 11", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("tab", { name: "Overdue 2", exact: true }),
    ).toBeVisible();
    const row = page.locator(".task-row").filter({
      has: page.getByText("Upload EKG and liver results", { exact: true }),
    });
    await expect(
      row.getByText("Kasia Synthetic", { exact: true }),
    ).toBeAttached();
    await expect(
      row.getByRole("link", { name: "Client Ewa Synthetic #1333" }),
    ).toHaveAttribute("href", "/admin/clients/" + f.ids.client);
    await expect(row.locator(".task-reference")).toHaveText(
      "Task #" + created[0].taskNumber,
    );
    const geometry = await page.evaluate(() => ({
      width: innerWidth,
      body: document.documentElement.scrollWidth,
      ancestors: Array.from(
        document.querySelectorAll(
          ".task-list,.task-grid,[data-re-table],.task-table,#workspace-content",
        ),
      ).map((e) => ({
        cl: e.className,
        width: e.getBoundingClientRect().width,
        scroll: e.scrollWidth,
        overflow: getComputedStyle(e).overflow,
        position: getComputedStyle(e).position,
      })),
      outside: Array.from(document.querySelectorAll("body *"))
        .filter(
          (e) =>
            !e.closest("[data-re-table]") &&
            e.getBoundingClientRect().right > innerWidth,
        )
        .map((e) => ({
          tag: e.tagName,
          cl: e.className,
          right: e.getBoundingClientRect().right,
          width: e.getBoundingClientRect().width,
        }))
        .slice(0, 20),
    }));
    expect(geometry.body, JSON.stringify(geometry)).toBeLessThanOrEqual(
      geometry.width,
    );
    await page.screenshot({
      path: info.outputPath(`tasks-grid-${width}.png`),
      fullPage: true,
    });
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({path:info.outputPath(`tasks-rows-${width}.png`),fullPage:true});
    const search = page.getByRole("searchbox", {
      name: "Search tasks, clients, bookings or ID",
    });
    await search.fill("#1333");
    await expect(page.locator(".task-row")).toHaveCount(8);
    await search.fill("not present");
    await expect(page.locator(".task-row")).toHaveCount(0);
    await search.fill("");
    await page.getByRole("tab", { name: "Done 2", exact: true }).click();
    await expect(page.locator(".task-row")).toHaveCount(2);
    await page.getByRole("tab", { name: "Open 11", exact: true }).click();
    await row.getByRole("checkbox", { name: "Mark task as complete" }).click();
    await expect(
      page.getByText("Upload EKG and liver results", { exact: true }),
    ).toHaveCount(0);
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(
      page.getByRole("tab", { name: "Done 3", exact: true }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Done 3", exact: true }).click();
    await expect(
      page.getByText("Upload EKG and liver results", { exact: true }),
    ).toBeVisible();
    const saved = await (
      await request.get(f.url + "/fixture/assignment-snapshot")
    ).json();
    expect(
      saved.tasks.find((x: any) => x._id === (created[0]._id || created[0].id))
        .status,
    ).toBe("completed");
    for (const sibling of created.slice(1))
      expect(
        saved.tasks.find((x: any) => x._id === (sibling._id || sibling.id))
          .status,
      ).toBe(sibling.status);
    expect(saved.effects).toEqual([]);
    await page.waitForLoadState("networkidle");
  });
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "wait" });
  await page.close();
});
