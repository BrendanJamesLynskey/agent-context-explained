/**
 * Brief 44, the learning layer: a self-check waits for a committed answer,
 * then reveals the engine's value and says whether the guess was right; a
 * choice and a slider work from the keyboard; with no JavaScript the answer
 * is still one click away (a native <details>); axe finds nothing serious
 * with every answer of a chapter revealed, at 390 px in dark mode.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { numericAnswer } from "@/lib/learn/answer";

async function check(page: Page, id: string) {
  const box = page.locator(`[data-self-check="${id}"]`);
  await expect(box).toBeVisible();
  return box;
}

test("the reveal waits for an answer, then shows the engine's", async ({
  page,
}) => {
  await page.goto("/learn/05-chunking");
  await expect(page.locator("[data-check-yourself-link]")).toHaveAttribute(
    "href",
    "#check-yourself",
  );
  const box = await check(page, "cx05-q1");
  const summary = box.locator("summary");
  const details = box.locator("details");
  // not committed yet: the click is refused and the reader is told why
  await summary.click();
  await expect(details).not.toHaveAttribute("open", "");
  await expect(box).toContainText("Commit to an answer first");
  // the intuitive guess is wrong
  const want = numericAnswer("truncated.fixed-512", undefined, "int");
  await box.getByRole("spinbutton").fill("10");
  await summary.click();
  await expect(details).toHaveAttribute("open", "");
  await expect(box.locator("[data-answer]")).toHaveText(
    `${want.display}${want.unit}`,
  );
  await expect(box.locator("[data-verdict]")).toHaveAttribute(
    "data-verdict",
    "wrong",
  );
  // the engine's number is right
  await box.getByRole("spinbutton").fill(want.display);
  await expect(box.locator("[data-verdict]")).toHaveAttribute(
    "data-verdict",
    "right",
  );
  // a choice, by keyboard
  const q = await check(page, "cx05-q2");
  await q.getByLabel("Recursive, 256 tokens").check();
  await q.locator("summary").press("Enter");
  await expect(q.locator("details")).toHaveAttribute("open", "");
  await expect(q.locator("[data-verdict]")).toHaveAttribute(
    "data-verdict",
    "right",
  );
});

test("a slider, by keyboard", async ({ page }) => {
  await page.goto("/learn/06-packing-the-window");
  const box = await check(page, "cx06-q2");
  const want = numericAnswer(
    "packing.eval.results.256.density.answered",
    undefined,
    "pct1",
  );
  const slider = box.getByRole("slider");
  await slider.focus();
  await page.keyboard.press("Home");
  const min = Number(await slider.getAttribute("min"));
  const step = Number(await slider.getAttribute("step"));
  for (let i = 0; i < Math.round((want.value - min) / step); i++)
    await page.keyboard.press("ArrowRight");
  await box.locator("summary").press("Enter");
  await expect(box.locator("[data-answer]")).toHaveText(
    `${want.display}${want.unit}`,
  );
  await expect(box.locator("[data-verdict]")).toHaveAttribute(
    "data-verdict",
    "right",
  );
});

test("axe: nothing serious with every answer revealed (390 px, dark)", async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    colorScheme: "dark",
    viewport: { width: 390, height: 900 },
  });
  const page = await ctx.newPage();
  await page.goto("/learn/09-long-context-or-retrieval");
  for (const id of ["cx09-q1", "cx09-q2", "cx09-q3"]) {
    const box = await check(page, id);
    const slider = box.getByRole("slider");
    if (await slider.count()) {
      await slider.focus();
      await page.keyboard.press("ArrowRight");
    } else if (await box.getByRole("spinbutton").count()) {
      await box.getByRole("spinbutton").fill("2");
    } else {
      await box.getByRole("radio").first().check();
    }
    await box.locator("summary").click();
    await expect(box.locator("details")).toHaveAttribute("open", "");
  }
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const results = await new AxeBuilder({ page })
    .include("#check-yourself")
    .include("[data-remember]")
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  await ctx.close();
});

test("with no JavaScript the question and the answer are in the page", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto("/learn/01-the-window-is-the-working-memory");
  const box = page.locator('[data-self-check="cx01-q2"]');
  await expect(box).toContainText("Which run spends the most input tokens?");
  await box.locator("summary").click();
  await expect(box.locator("[data-answer]")).toHaveText("Retrieve");
  await expect(page.locator("[data-remember]")).toContainText(
    "What to remember",
  );
  await ctx.close();
});
