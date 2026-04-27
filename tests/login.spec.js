const { test, expect } = require("@playwright/test");

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:4173";

test("demo credentials open the dashboard", async ({ page }) => {
  await page.goto(baseUrl);
  await page.getByLabel("Email").fill("demo@example.com");
  await page.getByLabel("Password").fill("DemoPass123!");
  await page.locator("#auth-submit").click();

  await expect(page.locator("#user-email")).toContainText("demo@example.com");
  await expect(page.getByRole("heading", { name: /Overview/ })).toBeVisible();
  await expect(page.getByText("Net profit")).toBeVisible();

  await page.getByRole("button", { name: "Revenue" }).click();
  await expect(page.getByRole("heading", { name: "Revenue" })).toBeVisible();
  await expect(page.locator("#revenue-daily-grid").getByText("Mon")).toBeVisible();

  await page.getByRole("button", { name: "Expenses" }).click();
  await expect(page.getByRole("heading", { name: "Fixed Costs" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Variable Costs" })).toBeVisible();
  await expect(page.locator("#variable-daily-grid").getByText("Sun")).toBeVisible();

  await page.getByRole("button", { name: "Workload" }).click();
  await expect(page.getByRole("heading", { name: "Workload" })).toBeVisible();
  await expect(page.locator("#workload-daily-grid .daily-header").getByText("Online hrs")).toBeVisible();
});
