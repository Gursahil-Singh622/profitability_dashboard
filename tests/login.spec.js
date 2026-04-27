const { test, expect } = require("@playwright/test");

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:4173";

test("demo credentials open the dashboard", async ({ page }) => {
  await page.goto(baseUrl);
  await page.getByLabel("Email").fill("demo@example.com");
  await page.getByLabel("Password").fill("DemoPass123!");
  await page.locator("#auth-submit").click();

  await expect(page.locator("#user-email")).toContainText("demo@example.com");
  await expect(page.getByRole("heading", { name: "Revenue" })).toBeVisible();
  await expect(page.getByText("Net profit")).toBeVisible();
});
