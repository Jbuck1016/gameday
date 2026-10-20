import { expect, test } from "@playwright/test";
import fs from "node:fs";

const SHOTS = "e2e/__screens__";
fs.mkdirSync(SHOTS, { recursive: true });

test.describe("first visit to an exported card", () => {
  test("detects the area, builds a plan, shows the timeline and exports", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    // area is detected (demo data uses Los Angeles) and needs confirming
    await expect(page.getByText(/Showing listings for Los Angeles/)).toBeVisible();
    await page.getByRole("button", { name: "Looks right" }).click();

    const rows = page.getByTestId("game-row");
    await expect(rows.first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/browse-broadcast.png`, fullPage: false });

    const arsenal = page.locator('[data-testid="game-row"]', { hasText: "Arsenal" }).first();
    await arsenal.getByRole("button", { name: /Must watch/ }).click();
    const cfb = page.locator('[data-testid="game-row"]', { hasText: "Michigan" }).first();
    await cfb.getByRole("button", { name: /Must watch/ }).click();
    const dortmund = page.locator('[data-testid="game-row"]', { hasText: "Dortmund" }).first();
    await dortmund.getByRole("button", { name: /Want to watch/ }).click();

    await arsenal.getByRole("button", { name: "Where" }).click();
    await expect(arsenal.getByText("Likely, not announced").first()).toBeVisible();

    await page.getByRole("link", { name: "View plan" }).click();
    await expect(page.getByTestId("plan-game")).toHaveCount(3);
    await expect(page.getByRole("figure", { name: /Timeline/ })).toBeVisible();
    await expect(page.getByText(/Overlap/).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Services needed" })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/plan-broadcast.png`, fullPage: true });

    // share link creates a stored plan and the shared page renders it
    await page.getByRole("button", { name: "Copy link" }).click();
    const status = page.getByRole("status");
    await expect(status).toContainText("/p/");
    const link = (await status.textContent())!.match(/\/p\/[A-Za-z0-9]+/)![0];

    // export uses the same stored plan
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export image" }).click()]);
    expect(download.suggestedFilename()).toMatch(/gameday-2026-10-24-broadcast\.png/);

    await page.goto(link);
    await expect(page.getByTestId("plan-game")).toHaveCount(3);
    await expect(page.getByRole("link", { name: "Make my plan" })).toBeVisible();
  });

  test("themes switch the whole app", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const t of ["editorial", "terminal"]) {
      await page.goto(`/?theme=${t}`);
      await expect(page.locator("html")).toHaveAttribute("data-theme", t);
      await expect(page.getByTestId("game-row").first()).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/browse-${t}.png` });
    }
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
    for (const theme of ["broadcast", "editorial", "terminal"]) {
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
