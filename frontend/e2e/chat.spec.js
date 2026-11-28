// End-to-end test (CCD-387): asking Boreas a question and following a link from the answer.
// It runs in a real Chrome against the example data (VITE_USE_MOCKS=true, set in playwright.config.js),
// so the answer is the mock one from src/mocks/chat.js.
import { expect, test } from '@playwright/test';

test.describe('the chat panel', () => {
  test('an answer links to the right section of the county page', async ({ page }) => {
    // 1. Open Cork's page and wait for it to load
    await page.goto('/county/cork');
    await expect(page.getByRole('heading', { level: 1, name: 'Cork' })).toBeVisible();

    // 2. Open the chat and ask about rain
    await page.getByRole('button', { name: 'Ask Boreas' }).click();
    await page.getByLabel('Your question').fill('Will it rain more here?');
    await page.keyboard.press('Enter');

    // 3. The answer arrives formatted, with what it is about and the links
    const chat = page.getByRole('complementary', { name: 'Chat panel' });
    await expect(chat.getByText('This is an example answer')).toBeVisible();
    await expect(chat.getByText('Rainfall · RCP4.5 · 2021–2050')).toBeVisible();

    // 4. Following the link opens Cork's page on that scenario and period, at the Rainfall section
    await chat.getByRole('link', { name: "See it on Cork's page" }).click();
    await expect(page).toHaveURL(/\/county\/cork\?rcp=45&period=2021-2050#rainfall-heading$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Rainfall' })).toBeInViewport();
  });

  test('a sea-level answer links to the flood map', async ({ page }) => {
    await page.goto('/county/cork');
    await expect(page.getByRole('heading', { level: 1, name: 'Cork' })).toBeVisible();

    await page.getByRole('button', { name: 'Ask Boreas' }).click();
    await page.getByLabel('Your question').fill('Will the sea flood the coast?');
    await page.keyboard.press('Enter');

    const chat = page.getByRole('complementary', { name: 'Chat panel' });
    await chat.getByRole('link', { name: 'Open the flood map for Cork' }).click();
    await expect(page).toHaveURL(/\/sea-level\?county=cork$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Flood map' })).toBeVisible();
  });
});