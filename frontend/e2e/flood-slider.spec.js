// End-to-end test (CCD-236): the flood map's sea-level slider on the Flooding page.
// It runs in a real Chrome against the example data (VITE_USE_MOCKS=true, set in playwright.config.js).
// The mock uses Cork's real flood layers: 25.4745 km² at 0 m, 33.8418 at 0.5 m, 35.0649 at 0.6 m, 52.3017 at 2 m.
import { expect, test } from '@playwright/test';

test.describe('flood map slider', () => {
  test.beforeEach(async ({ page }) => {
    // Open Cork's flooding page and wait for the flood map to load
    await page.goto('/sea-level?county=cork');
    await expect(page.getByRole('heading', { level: 2, name: 'Flood map' })).toBeVisible();
    await expect(page.getByRole('slider', { name: /Sea level rise/ })).toBeVisible();
  });

  test('starts at 0.5 m with the flood layer loaded on the map', async ({ page }) => {
    const slider = page.getByRole('slider', { name: /Sea level rise/ });
    await expect(slider).toHaveAttribute('aria-valuetext', '0.5 m');
    // 33.8418 - 25.4745 = 8.4 km² more than at 0 m
    await expect(page.getByText('8.4 km²')).toBeVisible();

    // Leaflet draws the flood picture as an <img class="leaflet-image-layer">.
    // naturalWidth is 0 if the picture failed to load, so this checks it really arrived.
    const layer = page.locator('img.leaflet-image-layer');
    await expect(layer).toHaveAttribute('src', /level_050\.png$/);
    await expect.poll(() => layer.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
  });

  test('moving the slider changes the flood layer and the km² counter', async ({ page }) => {
    const slider = page.getByRole('slider', { name: /Sea level rise/ });
    const layer = page.locator('img.leaflet-image-layer');

    // Drag to the top: fill() sets a range slider's value. 20 = the 21st level, 2 m.
    await slider.fill('20');
    await expect(page.getByText('Sea level rise: 2.0 m')).toBeVisible();
    await expect(layer).toHaveAttribute('src', /level_200\.png$/);
    // 52.3017 - 25.4745 = 26.8 km²
    await expect(page.getByText('26.8 km²')).toBeVisible();

    // Down to the bottom: 0 m, so nothing extra
    await slider.fill('0');
    await expect(layer).toHaveAttribute('src', /level_000\.png$/);
    await expect(page.getByText('0.0 km²')).toBeVisible();
  });

  test('the slider works with the keyboard', async ({ page }) => {
    const slider = page.getByRole('slider', { name: /Sea level rise/ });

    // From 0.5 m, one press of the right arrow goes up one step to 0.6 m
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveAttribute('aria-valuetext', '0.6 m');
    // 35.0649 - 25.4745 = 9.6 km²
    await expect(page.getByText('9.6 km²')).toBeVisible();
  });
});