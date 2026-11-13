import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const apiUrl = process.env.BLACKSMITH_API_URL ?? "http://127.0.0.1:18202";

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console: ${message.text()}`);
    }
  });
  return errors;
}

async function open(page: Page) {
  await page.goto("/");
  await expect(page.locator(".app")).toHaveAttribute("data-phase", "ready");
}

async function scrollToSection(page: Page, selector: string, offset = 0) {
  await page.evaluate(
    ({ target, extra }) => {
      const node = document.querySelector(target);
      if (!node) {
        throw new Error(`Missing section ${target}`);
      }
      window.scrollTo({
        top: node.getBoundingClientRect().top + window.scrollY + extra,
        behavior: "instant",
      });
    },
    { target: selector, extra: offset },
  );
}

test("real browser, API, PostgreSQL migration and simulation-only preflight", async ({
  page,
  request,
}) => {
  const errors = collectErrors(page);

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

  await open(page);
  await expect(page).toHaveTitle("Blacksmith | The build lab");
  const app = page.locator(".app");
  // Hardware decides: a GPU gets the ember scene, anything else the static art.
  await expect(app).toHaveAttribute("data-gl", /^(webgl2|fallback)$/);
  await expect(page.getByText("API and PostgreSQL ready")).toBeVisible();
  await expect(app).toHaveAttribute("data-heat", "ready");
  await expect(
    page.getByRole("heading", { level: 1, name: "Forge the next build." }),
  ).toBeVisible();

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
  await expect(page.getByLabel("Response JSON")).toContainText('"persisted": false');
  await expect(page.locator("[data-strikes]")).toHaveAttribute("data-strikes", "1");
  expect(errors).toEqual([]);

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

test("an unavailable API turns the page cold instead of faking health", async ({
  page,
}) => {
  await page.route("**/api/system", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      body: JSON.stringify({ status: 503 }),
    }),
  );
  await open(page);
  await expect(page.getByRole("alert")).toContainText("HTTP 503");
  await expect(page.locator(".app")).toHaveAttribute("data-heat", "cold");
  await expect(page.getByText("Stack offline")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Validate synthetic workload" }),
  ).toBeDisabled();
  await expect(page.getByText("API and PostgreSQL ready")).toHaveCount(0);
});

test("the workbench stays usable across viewport sizes with maximum-length input", async ({
  page,
}) => {
  await open(page);
  await expect(page.getByText("API and PostgreSQL ready")).toBeVisible();
  await page.getByRole("link", { name: "Enter the workbench" }).click();
  await expect(page).toHaveURL(/#workbench$/);
  await page.getByRole("textbox", { name: "Workload name" }).fill("a".repeat(64));
  await expect(page.getByLabel("Request JSON")).toContainText("a".repeat(64));

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const selector of [".hero", "#method", "#workbench", ".site-footer"]) {
      await scrollToSection(page, selector);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        ),
        `Horizontal overflow at ${width}px near ${selector}`,
      ).toBe(false);
    }
    await expect(
      page.getByRole("button", { name: "Validate synthetic workload" }),
    ).toBeVisible();
  }
});

test("the opening screen fits a short laptop viewport", async ({ page }) => {
  // A 1920 x 1200 panel at 150 % scaling leaves a browser about 1280 x 650.
  await page.setViewportSize({ width: 1280, height: 650 });
  await open(page);
  // Polled because the intro slides the last line into place.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const line = document.querySelector(".hero-hud");
        return line ? line.getBoundingClientRect().bottom - window.innerHeight : 1;
      }),
    )
    .toBeLessThanOrEqual(0);
});

test("striking, motion, and sound are real controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await open(page);
  const meter = page.locator("[data-strikes]");
  await expect(meter).toHaveAttribute("data-strikes", "0");

  await page.getByRole("button", { name: "Strike the anvil" }).click();
  await expect(meter).toHaveAttribute("data-strikes", "1");
  // Clicking open space in the hero strikes too; controls and links do not.
  await page.mouse.click(640, 150);
  await expect(meter).toHaveAttribute("data-strikes", "2");

  const marquee = page.locator(".marquee-track");
  await expect
    .poll(() => marquee.evaluate((node) => getComputedStyle(node).transform))
    .not.toBe("none");
  await page.getByRole("button", { name: "Pause motion" }).click();
  await expect(page.locator(".app")).toHaveAttribute("data-motion", "off");
  await expect
    .poll(() => marquee.evaluate((node) => getComputedStyle(node).transform))
    .toBe("none");
  await page.getByRole("button", { name: "Play motion" }).click();
  await expect(page.locator(".app")).toHaveAttribute("data-motion", "on");

  await page.getByRole("button", { name: "Enable sound" }).click();
  await expect(page.getByRole("button", { name: "Mute sound" })).toBeVisible();
  await page.getByRole("button", { name: "Mute sound" }).click();
  await expect(page.getByRole("button", { name: "Enable sound" })).toBeVisible();
});

test("a strike spreads the title without pushing it off a phone screen", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const measure = () =>
    page.evaluate(() => {
      const title = document.querySelector<HTMLElement>(".hero-title");
      const lines = Array.from(
        document.querySelectorAll<HTMLElement>(".hero-title .line-inner"),
      );
      const glyphs = Array.from(
        document.querySelectorAll<HTMLElement>(".hero-title [data-char]"),
      );
      return {
        right: Math.max(...lines.map((line) => line.getBoundingClientRect().right)),
        widest: Math.max(
          ...glyphs.map((glyph) =>
            Number(
              /"wdth" ([\d.]+)/.exec(glyph.style.fontVariationSettings)?.[1] ?? 62,
            ),
          ),
        ),
        limit: title ? title.getBoundingClientRect().right : 0,
      };
    });

  await page.getByRole("button", { name: "Strike the anvil" }).click();
  let widest = 62;
  let overshoot = 0;
  for (let sample = 0; sample < 24; sample += 1) {
    const state = await measure();
    widest = Math.max(widest, state.widest);
    overshoot = Math.max(overshoot, state.right - state.limit);
    await page.waitForTimeout(25);
  }
  // The glyphs really widen, and the line is squeezed to stay inside its column.
  expect(widest).toBeGreaterThan(64);
  expect(overshoot).toBeLessThanOrEqual(1);
});

test("reduced motion removes the theatre but keeps every function", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".preloader")).toHaveCount(0);
  await expect(page.locator(".app")).toHaveAttribute("data-phase", "ready");
  await expect(
    page.getByRole("button", { name: "System reduced motion enabled" }),
  ).toBeDisabled();
  await expect(page.locator("#method")).toHaveAttribute("data-pinned", "false");
  expect(
    await page
      .locator(".grain")
      .evaluate((node) => getComputedStyle(node).animationName),
  ).toBe("none");
  await expect(page.locator(".cursor")).toHaveCount(0);
  await expect(page.getByText("API and PostgreSQL ready")).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to workbench" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#workbench$/);
});

test("the ember scene draws on a software renderer and places its formations", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = collectErrors(page);
  // Small on purpose: without a GPU every pixel is shaded on the CPU.
  await page.setViewportSize({ width: 480, height: 320 });
  await page.goto("/?forge=software");
  await expect(page.locator(".app")).toHaveAttribute("data-gl", "webgl2", {
    timeout: 120_000,
  });
  // The count on the page is what is drawn; a CPU renderer steps it down.
  const hud = page.locator(".hero-hud");
  await expect(hud).toContainText(/[\d,]+ embers · illustration, not telemetry/);
  const shown = Number(
    /([\d,]+) embers/.exec((await hud.textContent()) ?? "")?.[1].replaceAll(",", ""),
  );
  expect(shown).toBeGreaterThan(0);
  expect(shown).toBeLessThanOrEqual(26_000);
  await expect(page.getByText("Fig. 02 — a cold queue · illustration")).toHaveCount(1);
  await expect(
    page.getByText("Fig. 03 — a runner pool, warm and cold · illustration"),
  ).toHaveCSS("opacity", "1");
  await expect(page.getByText("Fig. 04 — the hammer · illustration")).toHaveCount(1);

  // Read the frame the engine just drew: bright embers on a dark ground, not a
  // blank or blown-out canvas, and note where the warm ember shape sits.
  type Frame = {
    brightest: number;
    lit: number;
    dark: number;
    total: number;
    warm: number;
    warmX: number;
    warmY: number;
  };
  const sampleFrame = () =>
    page.evaluate(
      () =>
        new Promise<Frame>((resolve) => {
          requestAnimationFrame(() => {
            const empty = {
              brightest: -1,
              lit: -1,
              dark: -1,
              total: 0,
              warm: 0,
              warmX: -1,
              warmY: -1,
            };
            const source =
              document.querySelector<HTMLCanvasElement>("canvas.forge-canvas");
            const probe = document.createElement("canvas");
            const context = probe.getContext("2d");
            if (!source || !context || source.width === 0) {
              resolve(empty);
              return;
            }
            // Copy one to one so single bright embers are not averaged away.
            probe.width = source.width;
            probe.height = source.height;
            context.drawImage(source, 0, 0);
            const pixels = context.getImageData(0, 0, probe.width, probe.height).data;
            const columns = new Array<number>(probe.width).fill(0);
            const rows = new Array<number>(probe.height).fill(0);
            let brightest = 0;
            let lit = 0;
            let dark = 0;
            let warm = 0;
            for (let y = 0; y < probe.height; y += 1) {
              for (let x = 0; x < probe.width; x += 1) {
                const index = (y * probe.width + x) * 4;
                const red = pixels[index];
                const blue = pixels[index + 2];
                const value = Math.max(red, pixels[index + 1], blue);
                brightest = Math.max(brightest, value);
                if (value > 90) {
                  lit += 1;
                } else if (value < 45) {
                  dark += 1;
                }
                if (red > 110 && red > blue * 1.5) {
                  columns[x] += 1;
                  rows[y] += 1;
                  warm += 1;
                }
              }
            }
            const median = (counts: number[]) => {
              let sum = 0;
              for (let k = 0; k < counts.length; k += 1) {
                sum += counts[k];
                if (sum >= warm / 2) {
                  return (k + 0.5) / counts.length;
                }
              }
              return -1;
            };
            resolve({
              brightest,
              lit,
              dark,
              total: pixels.length / 4,
              warm,
              warmX: warm > 0 ? median(columns) : -1,
              warmY: warm > 0 ? median(rows) : -1,
            });
          });
        }),
    );
  // Two matching samples in a row mean the embers have stopped travelling.
  const settledFrame = async () => {
    let previous = await sampleFrame();
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await page.waitForTimeout(800);
      const current = await sampleFrame();
      if (
        current.warm > 40 &&
        Math.abs(current.warmX - previous.warmX) < 0.015 &&
        Math.abs(current.warmY - previous.warmY) < 0.015
      ) {
        return current;
      }
      previous = current;
    }
    throw new Error("The ember scene never settled.");
  };

  await expect
    .poll(async () => (await sampleFrame()).brightest, { timeout: 60_000 })
    .toBeGreaterThan(150);
  const anvil = await settledFrame();
  expect(anvil.lit).toBeGreaterThan(anvil.total * 0.002);
  expect(anvil.dark).toBeGreaterThan(anvil.total * 0.3);

  // Each formation must be drawn with its own placement. On a wide screen the
  // anvil and the closing hammer both sit right of centre; a renderer that picks
  // the wrong matrix leaves the hammer dead centre, where the ember field belongs.
  expect(anvil.warmX).toBeGreaterThan(0.58);
  await page.evaluate(() =>
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "instant",
    }),
  );
  await page.waitForTimeout(1500);
  const hammer = await settledFrame();
  expect(hammer.warmX).toBeGreaterThan(0.62);
  expect(errors).toEqual([]);
});

test("scroll choreography pins the method and captures evidence", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  const method = page.locator("#method");
  await expect(method).toHaveAttribute("data-pinned", "true");
  const track = page.locator(".method-track");
  const offsetAt = async () =>
    track.evaluate(
      (node) => new DOMMatrixReadOnly(getComputedStyle(node).transform).m41,
    );

  await scrollToSection(page, "#method");
  await expect.poll(offsetAt).toBeCloseTo(0, 0);
  await scrollToSection(page, "#method", 900);
  await expect.poll(offsetAt).toBeLessThan(-600);
  // Vertical scroll must translate sideways without scrolling the page sideways.
  expect(await page.evaluate(() => window.scrollX)).toBe(0);

  await scrollToSection(page, "#manifesto", 200);
  await expect(page.locator('[data-word][data-lit="true"]').first()).toBeVisible();

  // File names carry the renderer the page reports, so a capture cannot be
  // mistaken for the other mode. This container has no GPU: expect "fallback".
  const mode = (await page.locator(".app").getAttribute("data-gl")) ?? "unknown";
  const shots: [string, string, number][] = [
    ["01-hero", ".hero", 0],
    ["02-manifesto", "#manifesto", 120],
    ["03-method", "#method", 500],
    ["04-signal", "#system", 60],
    ["05-workbench", "#workbench", 180],
    ["06-ledger", ".ledger", 120],
    ["07-footer", ".site-footer", 80],
  ];
  for (const [name, selector, offset] of shots) {
    await scrollToSection(page, selector, offset);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `.local/evidence/${mode}-${name}.png` });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  for (const [name, selector, offset] of [
    ["08-mobile-hero", ".hero", 0],
    ["09-mobile-workbench", "#workbench", 320],
  ] as const) {
    await scrollToSection(page, selector, offset);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `.local/evidence/${mode}-${name}.png` });
  }
  expect(errors).toEqual([]);
});
