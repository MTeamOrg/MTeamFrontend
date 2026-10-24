import { expect, test } from '@playwright/test'

const ADMIN = {
  id: 'layout-admin-fixture',
  firstName: 'Layout',
  lastName: 'Fixture',
  email: 'layout.admin@example.test',
  role: 'ADMIN',
  status: 'ACTIVE',
  isPasswordChangeRequired: false,
}

const LONG_MEMBER = {
  id: 'long-member-fixture',
  firstName: 'Extremely long fixture first name',
  lastName: 'Compound surname used only for layout tests',
  documentNumber: 'TEST-DOCUMENT-000000',
  email: 'long.member@example.test',
}

const LONG_PAYMENT = {
  id: 'long-payment-fixture',
  amount: '987654321',
  method: 'Transferencia electrónica internacional para pruebas de longitud',
  receiptNumber: 'COMPROBANTE-DE-PRUEBA-LARGO-000000000000',
  status: 'ACCREDITED',
  accreditedAt: '2026-10-20T14:00:00-03:00',
  expiresAt: '2026-11-19T14:00:00-03:00',
  voidedAt: null,
  voidReason: null,
  member: LONG_MEMBER,
}

test('keeps long payment values inside their cells on desktop and mobile', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

    if (request.method() === 'POST' && path.endsWith('/auth/login')) return json({ accessToken: 'layout-token', tokenType: 'Bearer', expiresIn: 3600, user: ADMIN })
    if (path.endsWith('/payments/summary')) return json({ from: '', to: '', paymentCount: 1, totalAmount: LONG_PAYMENT.amount, days: [] })
    if (path.endsWith('/membership-prices/current')) return json({ id: 'layout-price', amount: '32000', effectiveFrom: '2026-09-01T00:00:00-03:00', createdAt: '', createdById: ADMIN.id })
    if (path.endsWith('/membership-prices')) return json({ items: [{ id: 'layout-price', amount: '32000', effectiveFrom: '2026-09-01T00:00:00-03:00', createdAt: '', createdById: ADMIN.id }], page: 1, limit: 5, total: 1 })
    if (path.endsWith('/admin/dashboard/metrics')) return json({ activeMembers: 1, inactiveMembers: 0, currentMemberships: 1, expiringMemberships: 0, expiredMemberships: 0, pendingMedicalCertificates: 0, rejectedMedicalCertificates: 0, initialPeriodMembers: 0 })
    if (path.endsWith('/payments')) return json({ items: [LONG_PAYMENT], page: 1, limit: 20, total: 1 })
    return route.abort()
  })

  await page.goto('/iniciar-sesion')
  await page.locator('input[type="email"]').fill(ADMIN.email)
  await page.locator('input[type="password"]').fill('TestPassword123!')
  await page.locator('button[type="submit"]').click()
  await page.goto('/admin/pagos')
  await expect(page.getByRole('heading', { name: 'Pagos y cuota' })).toBeVisible()

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 900, height: 1000 }]) {
    await page.setViewportSize(viewport)
    const metrics = await page.locator('.payment-table-wrap').evaluate((wrap) => {
      const table = wrap.querySelector('table')
      const headerCells = [...wrap.querySelectorAll('thead th')]
      const rowCells = [...wrap.querySelectorAll('tbody tr:first-child td')]
      const textSpans = [...wrap.querySelectorAll('.payment-cell-text')]
      const actionCell = wrap.querySelector('.payment-action-cell')
      const actionButton = wrap.querySelector('.payment-desktop-void')
      const pageOverflow = document.documentElement.scrollWidth > window.innerWidth + 1
      const cellsAligned = rowCells.every((cell, index) => index === rowCells.length - 1 || cell.getBoundingClientRect().right <= rowCells[index + 1].getBoundingClientRect().left + 1)
      const textInside = textSpans.every((span) => {
        const spanRect = span.getBoundingClientRect()
        const cellRect = span.closest('td')?.getBoundingClientRect()
        return Boolean(cellRect) && spanRect.left >= cellRect!.left - 1 && spanRect.right <= cellRect!.right + 1
      })
      const actionInside = actionCell && actionButton
        ? actionButton.getBoundingClientRect().left >= actionCell.getBoundingClientRect().left - 1 && actionButton.getBoundingClientRect().right <= actionCell.getBoundingClientRect().right + 1
        : false

      return {
        pageOverflow,
        tableHasLocalOverflow: Boolean(table && wrap.scrollWidth > wrap.clientWidth),
        headersStayOnOneLine: headerCells.every((cell) => getComputedStyle(cell).whiteSpace === 'nowrap'),
        cellsAligned,
        textInside,
        actionInside,
        stateWidth: headerCells[6]?.getBoundingClientRect().width ?? 0,
        actionWidth: headerCells[7]?.getBoundingClientRect().width ?? 0,
      }
    })

    expect(metrics.pageOverflow).toBe(false)
    expect(metrics.tableHasLocalOverflow).toBe(true)
    expect(metrics.headersStayOnOneLine).toBe(true)
    expect(metrics.cellsAligned).toBe(true)
    expect(metrics.textInside).toBe(true)
    expect(metrics.actionInside).toBe(true)
    expect(metrics.stateWidth).toBeGreaterThanOrEqual(110)
    expect(metrics.actionWidth).toBeGreaterThanOrEqual(110)
  }

  await page.setViewportSize({ width: 390, height: 844 })
  const mobileMetrics = await page.locator('.payment-mobile-card').first().evaluate((card) => {
    const cardRect = card.getBoundingClientRect()
    const content = [...card.querySelectorAll('strong, .payment-mobile-detail > span, .badge, .payment-mobile-more')]
    return {
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      contentInside: content.every((element) => element.getBoundingClientRect().right <= cardRect.right + 1),
    }
  })

  expect(mobileMetrics.pageOverflow).toBe(false)
  expect(mobileMetrics.contentInside).toBe(true)
  await expect(page.locator('.payment-table-wrap')).toBeHidden()
  await expect(page.locator('.payment-mobile-card').first()).toBeVisible()
})
