import { expect, test } from "@playwright/test";

const apiUrl = process.env.BLACKSMITH_API_URL ?? "http://127.0.0.1:18202";

test("real browser, API, PostgreSQL migration and simulation-only preflight", async ({
  page,
  request,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  for (const probe of ["liveness", "readiness"]) {
    const health = await request.get(`${apiUrl}/actuator/health/${probe}`);
    expect(health.status()).toBe(200);
    expect(await health.json()).toEqual({ status: "UP" });
  }
  const system = await request.get(`${apiUrl}/api/system`);
  expect(system.status()).toBe(200);
  expect(await system.json()).toEqual({
    application: "Blacksmith",
    phase: 1,
    executionMode: "SIMULATED",
    schemaVersion: 1,
  });

  await page.goto("/");
  await expect(page).toHaveTitle("Blacksmith | CI scheduler skeleton");
  await expect(page.getByText("API and PostgreSQL ready")).toBeVisible();
  await page.getByRole("textbox", { name: "Workload name" }).fill("smoke-demo");
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/preflight") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Validate synthetic workload" }).click();
  const preflight = await responsePromise;
  expect(preflight.status()).toBe(200);
  expect(await preflight.json()).toEqual({
    workloadName: "smoke-demo",
    executionMode: "SIMULATED",
    persisted: false,
  });
  await expect(page.getByRole("status")).toHaveText(
    "Validated smoke-demo. Simulation only; no job was persisted or executed.",
  );
  await page.screenshot({ path: ".local/evidence/dashboard.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
  ).toBe(false);
  await page.screenshot({
    path: ".local/evidence/dashboard-mobile.png",
    fullPage: true,
  });
  expect(pageErrors).toEqual([]);

  for (const body of [
    { workloadName: "demo", simulation: false },
    { workloadName: 123, simulation: true },
    { workloadName: "demo", simulation: true, command: "never-run-this" },
    { workloadName: "x".repeat(65), simulation: true },
  ]) {
    const invalid = await request.post(`${apiUrl}/api/preflight`, { data: body });
    expect(invalid.status()).toBe(400);
    expect(invalid.headers()["content-type"]).toContain("application/problem+json");
    const problem: unknown = await invalid.json();
    expect(problem).toMatchObject({ status: 400 });
    expect(JSON.stringify(problem)).not.toContain("never-run-this");
  }

  const futureRoute = await request.get(`${apiUrl}/jobs`);
  expect(futureRoute.status()).toBe(404);
});

test("browser reports an unavailable API instead of a healthy fallback", async ({
  page,
}) => {
  await page.route("**/api/system", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      body: JSON.stringify({ status: 503 }),
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("HTTP 503");
  await expect(page.getByRole("button")).toBeDisabled();
  await expect(page.getByText("API and PostgreSQL ready")).toHaveCount(0);
});
