import { test, expect } from "@playwright/test";
import fs from "node:fs";
const file=process.env.REQUEST_BOOKING_STATE_FIXTURE;
const f=file?JSON.parse(fs.readFileSync(file,"utf8")):{};
test.skip(!file,"Requires real request-booking-state API/Mongo fixture");
test.describe.configure({mode:"serial"});
for(const width of [1440,390]) test(`request marks waiting, paid needing booking and linked number at ${width}px`,async({page,request})=>{
  const reset=await request.post(f.url+"/fixture/booking-state-reset");expect(reset.ok()).toBe(true);const {ids}=await reset.json();
  const snapshot=async()=>(await request.get(f.url+"/fixture/edit-snapshot")).json();
  const before=await snapshot();
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript((token) => {
      localStorage.setItem("token", token);
      localStorage.setItem(
        "user",
        JSON.stringify({ role: "admin", email: "synthetic@example.invalid" }),
      );
    }, f.tokens.admin);
    const writes: string[] = [];
    await page.route("**/*", async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      if (!["xhr", "fetch"].includes(req.resourceType()))
        return route.continue();
      if (req.method() !== "GET")
        writes.push(req.method() + " " + url.pathname);
      if (
        url.pathname.startsWith("/payment-scratchpad") ||
        url.pathname.startsWith("/payment-requests") ||
        url.pathname === "/bookings" ||
        /^\/bookings\/[a-f\d]{24}$/.test(url.pathname) ||
        url.pathname === "/bookings/next-booking-number" ||
        url.pathname === "/bookings/booking-number-available" ||
        url.pathname === "/clients" ||
        url.pathname === "/clients/booking-options" ||
        /^\/clients\/[a-f\d]{24}$/.test(url.pathname) ||
        url.pathname === "/retreats" ||
        /^\/retreats\/[a-f\d]{24}$/.test(url.pathname)
      ) {
        const response = await route.fetch({
          url: f.url + url.pathname + url.search,
        });
        return route.fulfill({ response });
      }
      if (req.method() !== "GET") return route.abort();
      if (url.pathname === "/room-inventory/options")
        return route.fulfill({
          json: [
            {
              key: "shared",
              legacyRoomType: "shared",
              labels: { en: "Shared room" },
              occupancy: "shared",
              active: true,
            },
            {
              key: "private",
              legacyRoomType: "private",
              labels: { en: "Private room" },
              occupancy: "private",
              active: true,
            },
          ],
        });
      if (url.pathname === "/environment/status")
        return route.fulfill({
          json: { environment: "local", production: false, enabledJobs: [] },
        });
      if (
        url.pathname.includes("config-summary") ||
        url.pathname.includes("settings")
      )
        return route.fulfill({ json: {} });
      return route.fulfill({ json: [] });
    });

  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/admin/payment-requests");
  let row=page.getByRole("button",{name:"3100",exact:true}).locator("xpath=ancestor::tr");
  await expect(row.getByText("Booking after payment",{exact:true})).toBeVisible();
  await expect(row.getByRole("link",{name:"Create booking",exact:true})).toHaveCount(0);
  const headers={Authorization:"Bearer "+f.tokens.admin};
  const pay=async(amount:number)=>{const response=await request.post(f.url+"/payments",{headers,data:{clientId:ids.clients[0],retreatId:ids.retreat,paymentRequestId:ids.requests[0],amount,currency:"PLN",paymentDate:"2026-11-20",paymentMethod:"bank_transfer",paymentType:"regular_payment",status:"completed"}});expect(response.ok()).toBe(true);};
  await pay(400);await page.reload();await expect(row.getByText("Booking after payment",{exact:true})).toBeVisible();
  await pay(600);await page.reload();await expect(row.getByText("Booking needed",{exact:true})).toBeVisible();
  await row.screenshot({path:`${process.env.REQUEST_BOOKING_STATE_ARTIFACT_DIR||"test-results"}/booking-needed-${width}.png`});
  await row.getByRole("link",{name:"Create booking",exact:true}).click();
  await expect(page).toHaveURL(/bookings\/new\?/);expect(new URL(page.url()).searchParams.has("paymentPlanEnabled")).toBe(false);
  await expect(page.getByRole("button",{name:"Add Booking",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Add Booking",exact:true}).click();
  await expect.poll(async()=>(await snapshot()).bookings.length).toBe(before.bookings.length+1);
  await expect(page).toHaveURL(/bookings\/[a-f\d]{24}$/);
  await expect.poll(async()=>(await snapshot()).requests.filter((r:any)=>r.requestType==="balance").length).toBe(1);
  const saved=await snapshot(),booking=saved.bookings.find((b:any)=>b.clientId===ids.clients[0]),balance=saved.requests.find((r:any)=>r.requestType==="balance");
  expect(balance.bookingId).toBe(booking._id);expect(balance.requestedAmount).toBe(1500);expect(booking.amountPaid).toBe(1000);expect(saved.payments).toHaveLength(2);
  expect(saved.bookings.find((b:any)=>b._id===ids.bookings[1])).toEqual(before.bookings.find((b:any)=>b._id===ids.bookings[1]));
  await page.goto("/admin/payment-requests");
  row=page.getByRole("button",{name:"3100",exact:true}).locator("xpath=ancestor::tr");
  await expect(row.getByRole("link",{name:`Booking #${booking.bookingNumber}`,exact:true})).toBeVisible();
  await expect(row.getByRole("link",{name:"Create booking",exact:true})).toHaveCount(0);
  await page.reload();await expect(row.getByText("Booking needed",{exact:true})).toHaveCount(0);
  expect((await snapshot()).payments).toEqual(saved.payments);expect(errors).toEqual([]);
});
test.afterEach(async({page})=>{await page.unrouteAll({behavior:"wait"})});
