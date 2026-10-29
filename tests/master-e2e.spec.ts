import { test, expect } from '@playwright/test';

test('Full E2E Flow', async ({ page }) => {
  // Dashboard
  await page.goto('http://localhost:5173');
  await expect(page.getByRole('heading', { name: /غرفة العمليات المركزية/i })).toBeVisible();

  // Sales
  await page.goto('http://localhost:5173/sales');
  await page.getByRole('button', { name: /إرسال الطلب للمخازن/i }).click();
  await page.fill('input[name="customer"]', 'Test Customer');
  await page.fill('input[name="date"]', '2023-12-31');
  await page.getByRole('button', { name: /Create/i }).click();
  await expect(page.getByText(/Shipment created/i)).toBeVisible();

  // Accounting
  await page.goto('http://localhost:5173/accounting');
  await expect(page.getByText(/Invoice #\\d+/i)).toBeVisible();

  // Warehouse
  await page.goto('http://localhost:5173/warehouse');
  await page.getByRole('button', { name: /View Notifications/i }).click();
  await page.getByRole('button', { name: /Approve Request/i }).click();
  await expect(page.getByText(/Stock updated/i)).toBeVisible();

  // Production
  await page.goto('http://localhost:5173/production');
  await page.getByRole('button', { name: /New Production Order/i }).click();
  await page.fill('input[name="material"]', 'Material X');
  await page.getByRole('button', { name: /Start Production/i }).click();
  await expect(page.getByText(/Production started/i)).toBeVisible();

  // QC
  await page.goto('http://localhost:5173/qc');
  await page.getByRole('button', { name: /Receive Batch/i }).click();
  await page.getByRole('button', { name: /Open QC Form/i }).click();
  await page.getByRole('button', { name: /Accept/i }).click();
  await expect(page.getByText(/QC Passed/i)).toBeVisible();

  console.log('تقرير: جميع المراحل تم إكمالها بنجاح');
});