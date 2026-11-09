import { mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const dir = 'docs/directions'
await mkdir(dir, { recursive: true })
const browser = await chromium.launch({ channel: process.env.AEGIS_BROWSER || undefined })
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: width > 400 ? 920 : 844 }, colorScheme: 'light' })
    await page.goto(process.env.AEGIS_URL ?? 'http://127.0.0.1:4173/')
    await page.getByRole('heading', { name: 'Risk overview' }).waitFor()
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({ path: dir + '/shift-ledger-' + width + '.png', fullPage: true })
    await page.addStyleTag({ content: `
      .overview-grid { align-items: start; }
      .overview-grid > .recent-panel { grid-column: 1 / span 8; grid-row: 1 / span 2; }
      .overview-grid > .priority-panel { grid-column: 9 / span 4; grid-row: 1; }
      .overview-grid > .trend-panel { grid-column: 9 / span 4; grid-row: 2; }
      @media (max-width: 680px) {
        .overview-grid > .panel { grid-column: 1; grid-row: auto; }
        .overview-grid > .recent-panel { grid-row: 1; }
      }` })
    await page.screenshot({ path: dir + '/monitoring-desk-' + width + '.png', fullPage: true })
    await page.close()
  }
} finally { await browser.close() }
