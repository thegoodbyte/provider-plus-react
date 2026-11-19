import { test, expect } from "@playwright/test";
import path from "node:path";
for (const width of [1440, 390])
  test(`client task request, privacy and captured status email at ${width}px`, async ({
    page,
    request,
  }, info) => {
    const root = path.resolve(process.env.TEST_API_CHECKOUT || "../api"),
      f = await require(
        path.join(root, "test/task-identity.fixture.cjs"),
      ).createFixture();
    try {
      await f.app.listen(0, "127.0.0.1");
      const api = await f.app.getUrl(),
        headers = { Authorization: "Bearer " + f.tokens.admin },
        clientHeaders = { Authorization: "Bearer " + f.tokens.client };
      const created = await request.post(api + "/tasks", {
        headers,
        data: {
          name: "Visible synthetic task",
          description: "Visible task",
          type: "client",
          urgency: "medium",
          clientId: f.ids.client,
          sourceType: "whatsapp",
        },
      });
      expect(created.ok(), await created.text()).toBeTruthy();
      const task = await created.json();
      expect(task).toMatchObject({ visibleToClient: true, notifyClient: true });
      await f.models.Task.create([
        {
          name: "Private staff task",
          description: "Secret",
          notes: "Private note",
          type: "client",
          clientId: f.ids.client,
          visibleToClient: false,
        },
        {
          name: "Other client task",
          description: "Other client secret",
          type: "client",
          clientId: f.ids.otherClient,
          visibleToClient: true,
        },
      ]);
      expect((await request.get(api + "/client-portal/tasks")).status()).toBe(
        401,
      );
      expect(
        (await request.get(api + "/client-portal/tasks", { headers })).status(),
      ).toBe(403);
      const mine = await (
        await request.get(
          api + "/client-portal/tasks?clientId=" + f.ids.otherClient,
          { headers: clientHeaders },
        )
      ).json();
      expect(mine).toHaveLength(1);
      expect(mine[0].notes).toBeUndefined();
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(
        ({ token, id }) => {
          localStorage.setItem("client_auth_token", token);
          localStorage.setItem(
            "auth-storage",
            JSON.stringify({
              state: {
                user: {
                  id,
                  email: "ewa@example.invalid",
                  language: "en",
                  name: "Ewa",
                },
                token,
                isAuthenticated: true,
              },
              version: 0,
            }),
          );
        },
        { token: f.tokens.client, id: f.ids.client },
      );
      await page.route("**/*", async (route) => {
        const q = route.request(),
          u = new URL(q.url()),
          p = u.pathname.replace(/^\/api(?=\/)/, "");
        if (!["xhr", "fetch"].includes(q.resourceType()))
          return route.continue();
        if (p.startsWith("/client-portal/tasks"))
          return route.fulfill({
            response: await route.fetch({
              url: api + p + u.search,
              headers: {
                ...q.headers(),
                authorization: "Bearer " + f.tokens.client,
              },
            }),
          });
        return route.fulfill({ json: [] });
      });
      await page.goto(
        (process.env.CLIENT_PORTAL_FIXTURE_BASE_URL ||
          "http://127.0.0.1:5097") + "/tasks",
      );
      await expect(
        page.getByRole("heading", { name: "My Tasks", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Visible synthetic task", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Private staff task", { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByText("Other client task", { exact: true }),
      ).toHaveCount(0);
      const update = await request.patch(api + "/tasks/" + task._id, {
        headers,
        data: { status: "in_progress" },
      });
      expect(update.ok(), await update.text()).toBeTruthy();
      await expect.poll(() => f.effects.length).toBe(1);
      expect(f.effects[0].bodyText).toContain("In progress");
      await page.reload();
      await expect(
        page.getByText("In progress", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Request a task", exact: true }),
      ).toHaveAttribute("href", "/support");
      // The current UI links to Support; keep the legacy task API's privacy/throttle contract covered too.
      const asked = await request.post(api + "/client-portal/tasks", {
        headers: clientHeaders,
        data: {
          name: "Synthetic client request",
          description: "Please help with this synthetic request.",
        },
      });
      expect(asked.status(), await asked.text()).toBe(201);
      const requested = await f.models.Task.findOne({
        name: "Synthetic client request",
      }).lean();
      expect(String(requested.clientId)).toBe(f.ids.client);
      expect(requested.sourceType).toBe("client_portal_request");
      expect(
        (
          await request.post(api + "/client-portal/tasks", {
            headers: clientHeaders,
            data: { name: "Second request", description: "Throttled" },
          })
        ).status(),
      ).toBe(429);
      expect(
        await f.models.Task.countDocuments({ clientId: f.ids.otherClient }),
      ).toBe(1);
      await page.screenshot({
        path: info.outputPath("client-tasks.png"),
        fullPage: true,
      });
    } finally {
      await f.close();
    }
  });
