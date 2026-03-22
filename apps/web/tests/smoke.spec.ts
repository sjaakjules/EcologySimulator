import { expect, test } from '@playwright/test';

test('loads the local-first simulator shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Simulation controls' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'World generation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Selection inspector' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ecology info' })).toBeVisible();

  await page
    .getByRole('button', { name: 'Simulation controls' })
    .evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByText('Renderer:')).toBeVisible();

  await page
    .getByRole('button', { name: 'World generation' })
    .evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByRole('heading', { name: 'World generation' })).toBeVisible();
});
