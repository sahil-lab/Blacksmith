import { expect, test } from "@playwright/test";

// Runs in the "no-webgl" project, where the browser refuses 3D contexts.
test("without WebGL the static illustration and every function still work", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console: ${message.text()}`);
    }
  });

  await page.goto("/");
  const app = page.locator(".app");
  await expect(app).toHaveAttribute("data-phase", "ready");
  await expect(app).toHaveAttribute("data-gl", "fallback");
  await expect(
    page.getByRole("img", { name: "Static illustration of an anvil" }),
  ).toBeVisible();
  await expect(page.locator(".hero-hud")).toContainText("static illustration");
  // Captions for formations that are not drawn here must not appear.
  await expect(page.getByText(/Fig\. 0[234]/)).toHaveCount(0);
  await expect(page.getByText("API and PostgreSQL ready")).toBeVisible();

  await page.getByRole("button", { name: "Strike the anvil" }).click();
  await expect(page.locator("[data-strikes]")).toHaveAttribute("data-strikes", "1");

  await page.getByRole("textbox", { name: "Workload name" }).fill("fallback-demo");
  await page.getByRole("button", { name: "Validate synthetic workload" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Validated fallback-demo. Simulation only; no job was persisted or executed.",
  );
  await expect(page.locator(".bench-panel")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: ".local/evidence/no-webgl-workbench.png" });
  expect(errors).toEqual([]);
});
