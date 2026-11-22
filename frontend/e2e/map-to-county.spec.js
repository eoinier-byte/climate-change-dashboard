// End-to-end test (CCD-234): a user starts on the home page map and ends up on a county page.
// It runs in a real Chrome against the example data (VITE_USE_MOCKS=true, set in playwright.config.js).
import { expect, test } from '@playwright/test';

test.describe('from the map to a county page', () => {
  test('open Cork from the map and see its dashboard', async ({ page }) => {
    // 1. Open the home page
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: "Explore Ireland's climate projections" })).toBeVisible();

    // 2. Wait for the map to load its values. Each county on each map is a link named like
    //    "Cork, RCP8.5: 12.5 °C, open county page". Before the values arrive it has no ":",
    //    so waiting for the ":" means the map has loaded its data.
    const cork = page.getByRole('region', { name: 'County maps' }).getByRole('link', { name: /^Cork, RCP8.5: .*open county page$/ }).first();
    await expect(cork).toBeVisible();

    // 3. Open Cork. Using the keyboard (Tab to it, then Enter) is how the map is built to work, and it is
    //    more reliable in a test than clicking a shape that touches its neighbours.
    await cork.focus();
    await page.keyboard.press('Enter');

    // 4. We are on Cork's page: the address, the title and the charts are there
    await expect(page).toHaveURL(/\/county\/cork$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Cork' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Temperature' })).toBeVisible();
    // Chart.js draws each chart on a <canvas>, so at least one should be on the page
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('find Kerry with the search box', async ({ page }) => {
    await page.goto('/');

    // Type a county and press Go, like a user who doesn't use the map
    await page.getByLabel('Find a county').fill('Kerry');
    await page.getByRole('button', { name: 'Go' }).click();

    await expect(page).toHaveURL(/\/county\/kerry$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Kerry' })).toBeVisible();
  });
});