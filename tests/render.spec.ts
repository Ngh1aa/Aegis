import { mkdir } from 'node:fs/promises'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const routes = [
  ['overview', '/', 'Risk overview'],
  ['transactions', '/transactions', 'Transaction monitoring'],
  ['investigation', '/transactions/TX-8421', 'TX-8421'],
  ['cases', '/cases', 'Case management'],
  ['case-detail', '/cases/CS-2401', 'CS-2401'],
  ['disputes', '/disputes', 'Dispute resolution'],
  ['dispute-detail', '/disputes/DP-6101', 'DP-6101'],
  ['analytics', '/analytics', 'Risk analytics'],
  ['rules', '/rules', 'Rules management'],
  ['rule-detail', '/rules/RULE-103', 'Early review threshold'],
  ['audit', '/audit', 'Audit trail'],
] as const

for (const width of [1440, 1280, 768, 390, 320]) {
  for (const colorScheme of (width === 1440 || width === 390 ? ['light', 'dark'] : ['light']) as ('light' | 'dark')[]) {
    test('render ' + width + ' ' + colorScheme, async ({ page }) => {
      test.setTimeout(120_000)
      await page.setViewportSize({ width, height: width >= 768 ? 960 : 844 })
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
      page.on('response', response => { if (response.status() >= 400) errors.push(response.status() + ' ' + response.url()) })
      for (const [name, path, title] of routes) {
        await page.goto('/#' + path)
        await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible()
        await page.evaluate(() => document.fonts.ready)
        expect(await page.evaluate(() => document.documentElement.scrollWidth), name + ' page width').toBeLessThanOrEqual(width)
        if (width === 1440 || width === 390) {
          const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag21a', 'best-practice']).analyze()
          expect(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), name + ' axe').toEqual([])
          const target = process.env.AEGIS_CAPTURES
          if (target) {
            await mkdir(target, { recursive: true })
            await page.screenshot({ fullPage: true, path: target + '/' + name + '-' + width + '-' + colorScheme + '.png' })
          }
        }
      }
      expect(errors).toEqual([])
    })
  }
}

test('mobile navigation and decision dialog are keyboard reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused()
  await page.keyboard.press('Enter')
  const nav = page.getByRole('dialog', { name: 'Workspace navigation' })
  await expect(nav).toBeVisible()
  await nav.getByRole('link', { name: 'Transactions', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Transaction monitoring' })).toBeVisible()
  await expect(page.getByRole('main')).toBeFocused()
  await page.evaluate(() => document.fonts.ready)
  const amount = page.getByText('USD 2,840.00', { exact: true })
  const table = page.getByRole('region', { name: 'Transaction monitoring', exact: true })
  const amountBox = (await amount.boundingBox())!
  const tableBox = (await table.boundingBox())!
  expect(amountBox.x + amountBox.width).toBeLessThanOrEqual(tableBox.x + tableBox.width)
  await page.getByRole('link', { name: 'TX-8421' }).click()
  await page.getByRole('combobox', { name: 'Decision', exact: true }).selectOption('Escalate case')
  await page.getByRole('textbox', { name: 'Decision reason' }).fill('Additional review required by the Risk Manager.')
  const trigger = page.getByRole('button', { name: 'Review decision' })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Escalate case', exact: true })
  await expect(dialog).toBeVisible()
  const violations = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(violations.violations.map(v => v.id)).toEqual([])
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('semantic colors retain light/dark parity and contrast', async ({ page }) => {
  await page.goto('/#/')
  const themeKeys = await page.evaluate(() => {
    const rules = [...document.styleSheets].flatMap(sheet => [...sheet.cssRules])
    const root = rules.find((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && rule.selectorText === ':root')
    const dark = rules.find((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule && rule.conditionText.includes('prefers-color-scheme: dark'))
    const darkRule = dark?.cssRules[0] as CSSStyleRule | undefined
    const keys = (rule?: CSSStyleRule) => Array.from(rule?.style ?? []).filter(key => key.startsWith('--'))
    return { light: keys(root), dark: keys(darkRule) }
  })
  expect(themeKeys.dark.length).toBeGreaterThan(20)
  expect(themeKeys.dark.filter(key => !themeKeys.light.includes(key))).toEqual([])
  expect(themeKeys.light.slice(0, themeKeys.light.indexOf('--radius')).sort()).toEqual(themeKeys.dark.sort())

  const pairs: [string, string, number][] = [
    ['text', 'paper', 4.5], ['muted', 'canvas', 4.5], ['muted', 'rail', 4.5], ['muted', 'quiet', 4.5],
    ['brand-ink', 'brand-soft', 4.5], ['brand-on', 'brand', 4.5], ['brand-on', 'brand-hover', 4.5],
    ['red', 'red-bg', 4.5], ['amber', 'amber-bg', 4.5], ['blue', 'blue-bg', 4.5],
    ['purple', 'purple-bg', 4.5], ['green', 'green-bg', 4.5],
    ['focus', 'paper', 3], ['focus', 'canvas', 3], ['control', 'paper', 3],
    ['chart-base', 'paper', 3], ['chart-end', 'paper', 3], ['chart-ink', 'paper', 3], ['chart-ink-end', 'paper', 3],
  ]
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    const ratios = await page.evaluate(values => {
      const style = getComputedStyle(document.documentElement)
      const luminance = (name: string) => {
        const raw = style.getPropertyValue('--' + name).trim().slice(1)
        const hex = raw.length === 3 ? [...raw].map(character => character.repeat(2)).join('') : raw
        const [r, g, b] = [0, 2, 4].map(offset => {
          const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
          return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4
        })
        return .2126 * r + .7152 * g + .0722 * b
      }
      return values.map(([ink, surface]) => {
        const a = luminance(ink)
        const b = luminance(surface)
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
      })
    }, pairs)
    pairs.forEach(([ink, surface, minimum], i) =>
      expect(ratios[i], colorScheme + ' ' + ink + '/' + surface).toBeGreaterThanOrEqual(minimum))
  }
})
