import { expect, test } from '@playwright/test';

// Acceptance smoke test ST1 (docs/TESTING.md section 4): a content manager signs in and sees the seeded landmarks.
test('content manager signs in and sees the landmark list', async ({ page }) =>
{
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email === undefined || password === undefined)
  {
    throw new Error('Needs local Supabase and the seed: run npm run db:start, npm run env:local and npm run seed first.');
  }
  await page.goto('/cms/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/cms$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Landmarks' })).toBeVisible();
  await expect(page.locator('a[href^="/cms/landmarks/"]:not([href$="/new"])').first()).toBeVisible();
});
