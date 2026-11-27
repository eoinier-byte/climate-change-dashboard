// End-to-end test (CCD-235): the Compare section on the home page (Ronel's CompareExplorer, PR #70).
// It runs in a real Chrome against the example data (VITE_USE_MOCKS=true, set in playwright.config.js),
// which has Cork's projections for the baseline and every scenario at the end of the century.
import { expect, test } from '@playwright/test';

test.describe('the Compare section', () => {
  test('opens on Cork, compared with the baseline, with a chart point for each season', async ({ page }) => {
    await page.goto('/');

    // The Compare section is a region of the home page, named by its "Compare" heading
    const compare = page.getByRole('region', { name: 'Compare' });
    await expect(compare).toBeVisible();

    // The headline sentence compares Cork with the 1976-2005 baseline
    await expect(compare.getByText(/In Cork, .* warmer on average than Baseline 1976–2005/)).toBeVisible();
    // The highlight tiles are filled in
    await expect(compare.getByText('Warmest season')).toBeVisible();
    // Each season of each thing compared is a point on the scatterplot, named with its values
    await expect(compare.getByRole('button', { name: /^Summer, RCP8\.5, 2071–2100:/ })).toBeVisible();
  });

  test('unticking a scenario removes it from the charts and writes the choice to the address', async ({ page }) => {
    await page.goto('/');
    const compare = page.getByRole('region', { name: 'Compare' });
    await expect(compare.getByText('Warmest season')).toBeVisible();

        // Untick "RCP8.5 · end" (the high-emissions scenario at the end of the century).
    // The tick box only changes once the page has written the choice to the address, a moment
    // after the click, so click it and then wait for it to show as unticked.
    const rcp85End = compare.getByRole('checkbox', { name: 'RCP8.5 · end' });
    await rcp85End.click();
    await expect(rcp85End).not.toBeChecked();

    // Its points are gone, the others are still there
    await expect(compare.getByRole('button', { name: /^Summer, RCP8\.5, 2071–2100:/ })).toHaveCount(0);
    await expect(compare.getByRole('button', { name: /^Summer, RCP4\.5, 2071–2100:/ })).toBeVisible();
    // The choice is kept in the address (the Compare section's settings start with "cmp_"),
    // so a shared link opens the same comparison
    await expect(page).toHaveURL(/cmp_/);
  });

  test('shows every number in a table', async ({ page }) => {
    await page.goto('/');
    const compare = page.getByRole('region', { name: 'Compare' });
    await expect(compare.getByText('Warmest season')).toBeVisible();

    // The table is folded away under "Show the numbers in a table"
    await compare.getByText('Show the numbers in a table').click();

    const table = compare.getByRole('table', { name: /Temperature and rainfall by season/ });
    await expect(table).toBeVisible();
    await expect(table.getByRole('row', { name: /RCP8\.5, 2071–2100 Winter/ })).toBeVisible();
  });
});