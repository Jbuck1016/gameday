import { expect, test } from "@playwright/test";
import fs from "node:fs";

const SHOTS = "e2e/__screens__";
fs.mkdirSync(SHOTS, { recursive: true });

test.describe("first visit to an exported card", () => {
  test("detects the area, builds a plan, shows the timeline and exports", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    // area is detected (demo data uses Los Angeles) and needs confirming
    await expect(page.getByText(/Listings for Los Angeles/)).toBeVisible();
    await page.getByRole("button", { name: "Looks right" }).click();

    const rows = page.getByTestId("game-row");
    await expect(rows.first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/browse-best.png`, fullPage: false });
    await page.getByRole("tab", { name: "All" }).click();
    await page.screenshot({ path: `${SHOTS}/browse-all.png`, fullPage: false });

    // tap once = want, twice = must
    const arsenal = page.locator('[data-testid="game-row"]', { hasText: "Arsenal" }).first();
    await arsenal.getByRole("button", { name: /^Add .* to plan$/ }).click();
    await arsenal.getByRole("button", { name: /want to watch\. Tap for must/ }).click();
    await expect(arsenal.locator('[data-priority="must"]')).toHaveCount(1);
    const cfb = page.locator('[data-testid="game-row"]', { hasText: "Michigan" }).first();
    await cfb.getByRole("button", { name: /^Add .* to plan$/ }).click();
    await cfb.getByRole("button", { name: /Tap for must/ }).click();
    const dortmund = page.locator('[data-testid="game-row"]', { hasText: "Dortmund" }).first();
    await dortmund.getByRole("button", { name: /^Add .* to plan$/ }).click();

    // tapping the game itself shows every way to watch
    await arsenal.getByRole("button", { name: /Arsenal.*Every way to watch/ }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("Likely, not announced").first()).toBeVisible();
    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toBeHidden();

    await page.getByRole("link", { name: /Your day · 3 games/ }).click();
    await expect(page.getByTestId("plan-game")).toHaveCount(3);
    await expect(page.getByRole("figure", { name: /Timeline/ })).toBeVisible();
    await expect(page.getByText(/clash/).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "YOU NEED" })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/plan.png`, fullPage: true });

    // share link creates a stored plan and the shared page renders it
    await page.getByRole("button", { name: "Share" }).click();
    await page.getByRole("button", { name: "Copy link" }).click();
    const status = page.getByRole("status");
    await expect(status).toContainText("/p/");
    const link = (await status.textContent())!.match(/\/p\/[A-Za-z0-9]+/)![0];

    // export uses the same stored plan
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export image" }).click()]);
    expect(download.suggestedFilename()).toMatch(/gameday-2026-10-24-daylight\.png/);

    // wide images for X: three looks, three things to show
    await page.getByLabel("Size").selectOption("wide");
    await page.getByLabel("Look").selectOption("card");
    await page.getByLabel("Show").selectOption("crunch");
    const [wide] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export image" }).click()]);
    expect(wide.suggestedFilename()).toBe("gameday-2026-10-24-crunch-card.png");
    const png = await (await import("node:fs/promises")).readFile((await wide.path())!);
    expect(png.subarray(1, 4).toString()).toBe("PNG");

    await page.goto(link);
    await expect(page.getByTestId("plan-game")).toHaveCount(3);
    await expect(page.getByRole("link", { name: "Make my plan" })).toBeVisible();
  });

  test("filters are in the URL and the site has one look", async ({ page }) => {
    await page.goto("/?show=mine");
    await expect(page.getByRole("tab", { name: "My teams", selected: true })).toBeVisible();
    await expect(page.getByTestId("game-row").first()).toContainText("Your team");
    await page.goto("/?theme=terminal");
    await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  });

  test("works at phone width with no sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByTestId("game-row").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOTS}/browse-phone.png` });
  });
});

test.describe("api", () => {
  test("card renders in every theme and size", async ({ request }) => {
    for (const theme of ["daylight", "broadcast", "editorial", "terminal"]) {
      for (const size of ["portrait", "story", "square"]) {
        const res = await request.get(`/api/card?plan=demo&theme=${theme}&size=${size}`);
        expect(res.status()).toBe(200);
        expect(res.headers()["content-type"]).toBe("image/png");
        const body = await res.body();
        fs.writeFileSync(`${SHOTS}/card-${theme}-${size}.png`, body);
        expect(body.length).toBeGreaterThan(20_000);
      }
    }
  });

  test("calendar file lists the plan's games", async ({ request }) => {
    const res = await request.get("/api/ics?plan=demo");
    expect(res.status()).toBe(200);
    const txt = await res.text();
    expect(txt).toContain("BEGIN:VCALENDAR");
    expect(txt.match(/BEGIN:VEVENT/g)!.length).toBeGreaterThanOrEqual(3);
    expect(txt).toContain("Arsenal v Everton");
  });

  test("area lookup by zip suggests local teams", async ({ request }) => {
    const res = await request.get("/api/area?zip=02115");
    const j = await res.json();
    expect(j.teams.map((t: { team_name: string }) => t.team_name)).toEqual(expect.arrayContaining(["Boston Celtics", "Boston Bruins"]));
    const bad = await request.get("/api/area?zip=abc");
    expect(bad.status()).toBe(400);
  });

  test("teams view returns a team's games", async ({ request }) => {
    const res = await request.get("/api/team-games?teams=nhl:8&days=30");
    const j = await res.json();
    expect(j.games.length).toBeGreaterThan(0);
    expect(j.games.every((g: { name: string }) => /Kings/.test(g.name))).toBe(true);
  });

  test("rejects bad input", async ({ request }) => {
    expect((await request.get("/api/games?from=x&to=y")).status()).toBe(400);
    expect((await request.post("/api/plans", { data: { items: [] } })).status()).toBe(400);
  });
});

test.describe("v2: first visit, measurement, calendar feeds", () => {
  test("best games panel plans the day in one tap", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    const best = page.getByTestId("best-today");
    await expect(best).toBeVisible();
    const n = await best.getByTestId("game-row").count();
    expect(n).toBeGreaterThanOrEqual(4);
    await expect(best.getByText("Your team").first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/best-today.png` });
    await page.getByRole("button", { name: /Plan these/ }).click();
    await expect(page).toHaveURL(/\/plan\?day=2026-10-24/);
    await expect(page.getByTestId("plan-game")).toHaveCount(n);
    await page.screenshot({ path: `${SHOTS}/best-planned.png`, fullPage: true });
  });

  test("All shows every game with search and league filters", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("best-today")).toBeVisible();
    await page.getByRole("tab", { name: "All" }).click();
    await expect(page.getByTestId("best-today")).toHaveCount(0);
    await page.getByPlaceholder("Search a team or league…").fill("Arsenal");
    await expect(page.getByTestId("game-row")).toHaveCount(1);
  });

  test("a shared link opens straight onto the day", async ({ page }) => {
    await page.goto("/?day=2026-10-25");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Sunday");
    await expect(page.locator("main").getByText(/25 Oct/)).toBeVisible();
  });

  test("visits and picks are logged through the beacon", async ({ page }) => {
    const posts: string[] = [];
    await page.route("**/api/track", async (route) => {
      posts.push(route.request().postDataBuffer()?.toString("utf8") ?? "");
      await route.continue();
    });
    await page.goto("/");
    await page.locator('[data-testid="game-row"]').first().getByRole("button", { name: /^Add .* to plan$/ }).click();
    await page.waitForTimeout(1800);
    const all = posts.join("\n");
    expect(all).toContain('"n":"visit"');
    expect(all).toContain('"n":"plan_item_added"');
  });

  test("track endpoint accepts good events and rejects junk", async ({ request }) => {
    const ok = await request.post("/api/track", {
      data: { v: "abcdefgh12345678", s: "sessabcd12345678", events: [{ n: "visit", path: "/", p: { ref: null } }] },
    });
    expect(ok.status()).toBe(204);
    const badName = await request.post("/api/track", { data: { v: "abcdefgh12345678", s: "sessabcd12345678", events: [{ n: "DROP TABLE" }] } });
    expect(badName.status()).toBe(400);
    const badId = await request.post("/api/track", { data: { v: "x", s: "y", events: [{ n: "visit" }] } });
    expect(badId.status()).toBe(400);
  });

  test("teams page creates a subscribable calendar", async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/teams");
    await page.getByLabel("Add a team").fill("Kings");
    await page.getByRole("button", { name: /Los Angeles Kings/ }).first().click();
    const sub = page.getByTestId("calendar-subscribe");
    await sub.getByRole("button", { name: "Create calendar" }).click();
    const apple = sub.getByRole("link", { name: "Apple or Outlook" });
    await expect(apple).toHaveAttribute("href", /^webcal:\/\/.+\/cal\/[A-Za-z0-9]{20}\.ics\?tz=/);
    await expect(sub.getByRole("link", { name: "Google Calendar" })).toHaveAttribute("href", /calendar\.google\.com.*cid=webcal/);
    await page.screenshot({ path: `${SHOTS}/teams-calendar.png` });
    const href = (await apple.getAttribute("href"))!;
    const path = href.replace(/^webcal:\/\/[^/]+/, "");
    const res = await request.get(path);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
    const body = await res.text();
    expect(body).toContain("REFRESH-INTERVAL");
    expect(body).toContain("X-WR-CALNAME:Game Day: Los Angeles Kings");
  });

  test("unknown calendars are a clean 404", async ({ request }) => {
    expect((await request.get("/cal/AAAAAAAAAAAAAAAAAAAA.ics")).status()).toBe(404);
    expect((await request.get("/cal/nope.ics")).status()).toBe(404);
  });
});

test.describe("accounts", () => {
  test("signed out by default, with a way to sign in that never blocks planning", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByTestId("game-row").first()).toBeVisible();
    await page.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/signin\?next=%2F/);
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByText("You never need an account to plan.", { exact: false })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/signin.png` });
  });

  test("settings shows the account section when signed out", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
    await expect(page.getByText("Saved in this browser.", { exact: true })).toBeVisible();
  });

  test("account endpoints refuse anyone not signed in", async ({ request }) => {
    const me = await request.get("/api/me");
    expect(await me.json()).toEqual({ user: null, prefs: null });
    expect((await request.put("/api/me", { data: {} })).status()).toBe(401);
    expect((await request.delete("/api/me")).status()).toBe(401);
    expect((await request.post("/api/me/link", { data: { visitor: "abcdefgh12345678" } })).status()).toBe(401);
  });

  test("auth callback without a code goes back to sign-in, and won't redirect off-site", async ({ page }) => {
    await page.goto("/auth/callback?next=//evil.example");
    await expect(page).toHaveURL(/\/signin\?error=missing/);
    await expect(page.getByRole("alert").filter({ hasText: "didn't finish" })).toBeVisible();
  });

  test("header fits at phone width with the sign-in link", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${SHOTS}/header-phone.png` });
  });
});

test.describe("accessibility scan", () => {
  for (const path of ["/", "/privacy", "/signin", "/settings", "/teams"]) {
    test(`no serious axe violations on ${path}`, async ({ page }) => {
      const { default: AxeBuilder } = await import("@axe-core/playwright");
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target.join(" ")})`)).toEqual([]);
    });
  }
});

test.describe("sharing on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("tapping Share puts the share options on screen", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Looks right" }).click();
    await page.getByRole("button", { name: /^Plan these/ }).click();
    await expect(page).toHaveURL(/\/plan/);
    await expect(page.getByTestId("plan-game").first()).toBeVisible();
    await page.getByRole("button", { name: "Share" }).tap();
    await expect(page.getByRole("button", { name: "Export image" })).toBeInViewport();
    await expect(page.getByRole("heading", { name: "Share this day" })).toBeFocused();
  });
});

test.describe("today's three views", () => {
  test("switching views keeps the games and the pick, and the choice lives in the URL", async ({ page }) => {
    await page.goto("/?show=all");
    await page.getByRole("button", { name: "Looks right" }).click();
    for (const view of ["Board", "Timeline", "Card"]) {
      await page.getByRole("group", { name: "View" }).getByRole("button", { name: view }).click();
      await expect(page.getByRole("button", { name: view, pressed: true })).toBeVisible();
      if (view === "Card") await expect(page).not.toHaveURL(/view=/);
      else await expect(page).toHaveURL(new RegExp(`view=${view.toLowerCase()}`));
      const row = page.getByTestId("game-row").first();
      await expect(row).toBeVisible();
      // the pick works in every view and stays in sync across them
      const pick = row.getByRole("button", { name: /to plan$|Tap for must|Tap to remove/ });
      const before = await pick.getAttribute("data-priority");
      await pick.click();
      await expect(row.locator("[data-priority]")).not.toHaveAttribute("data-priority", before!);
      // every way to watch, from the game itself
      await row.getByRole("button", { name: /Every way to watch/ }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
    }
  });

  test("the last view is remembered on the next visit", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("group", { name: "View" }).getByRole("button", { name: "Board" }).click();
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Board", pressed: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Kickoffs board" })).toBeVisible();
  });

  test("the timeline caps a busy day and points to the board", async ({ page }) => {
    await page.goto("/?show=all&view=timeline");
    await expect(page.getByText(/The 12 biggest of \d+/)).toBeVisible();
    await expect(page.getByTestId("game-row")).toHaveCount(12);
    await page.getByRole("button", { name: "See every game on the Board" }).click();
    await expect(page).toHaveURL(/view=board/);
  });

  for (const view of ["card", "timeline", "board"]) {
    test(`${view} view: no sideways scroll on a phone and no serious axe violations`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/?view=${view}`);
      await expect(page.getByTestId("game-row").first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `${SHOTS}/view-${view}-phone.png`, fullPage: true });
      const { default: AxeBuilder } = await import("@axe-core/playwright");
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.nodes.length} (${v.nodes[0]?.target.join(" ")})`)).toEqual([]);
    });
  }
});
