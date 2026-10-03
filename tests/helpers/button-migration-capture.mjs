// Run through cua_repl with the documented browser and viewport handles only.
import fs from 'node:fs/promises'
import { fullSnapshot } from './design-system-wiring-visual-capture.mjs'
import { stableRaster } from './spaces-visual-capture.mjs'
export const cases = ['desktop', 'mobile'].flatMap(size => [{ theme: 'light', os: 'light' }, { theme: 'dark', os: 'light' }, { theme: 'system', os: 'light' }, { theme: 'system', os: 'dark' }].flatMap(mode => ['auth', 'unlock', 'profile', 'report', 'native', 'focus', 'hover', 'busy'].map(scene => ({ size, ...mode, scene, id: `${size}-${mode.theme}-${mode.os}-${scene}` }))))
export async function capture(tab, viewport, directory, start, end) {
  await fs.mkdir(directory, { recursive: true })
  for (const item of cases.slice(start, end)) {
    const wanted = item.size === 'desktop' ? [1440, 900] : [390, 844]
    if (JSON.stringify(await tab.playwright.evaluate(() => [innerWidth, innerHeight])) !== JSON.stringify(wanted)) await viewport.set(item.size === 'desktop' ? { width: 1714, height: 1071 } : { width: 464, height: 1004 })
    for (const side of ['base', 'head']) {
      const scene = ['focus', 'hover'].includes(item.scene) ? 'native' : item.scene === 'busy' ? 'report' : item.scene
      await tab.goto(`http://127.0.0.1:5179/${side}/?scene=${scene}&theme=${item.theme}&os=${item.os}`)
      await tab.playwright.locator('html[data-visual-ready="true"]').waitFor({ state: 'attached' })
      await tab.getAXState({ emit: false })
      if (item.scene === 'focus') { await tab.playwright.locator('#start').click(); await tab.playwright.locator('#start').press('Tab') }
      else if (item.scene === 'hover') await tab.playwright.locator('#explicit').click()
      else if (item.scene === 'busy') await tab.playwright.getByRole('button', { name: 'Submit report', exact: true }).click()
      else await tab.playwright.getByRole('heading').first().click()
      await tab.getAXState({ emit: false })
      const setup = await tab.playwright.evaluate(() => ({ theme: document.documentElement.dataset.theme, appearance: document.documentElement.dataset.appearance, os: document.documentElement.dataset.visualOs, dark: document.documentElement.dataset.visualSystemDark, light: document.documentElement.dataset.visualSystemLight, colorScheme: document.documentElement.style.colorScheme, fonts: document.fonts.status, diagnostics: document.querySelector('#final-validation-events')?.textContent, focus: document.activeElement?.id, focusVisible: document.activeElement?.matches(':focus-visible') }))
      if (setup.theme !== (item.theme === 'system' ? item.os : item.theme) || setup.appearance !== item.theme || setup.os !== item.os || setup.dark !== String(item.os === 'dark') || setup.light !== String(item.os === 'light') || setup.colorScheme !== setup.theme || setup.fonts !== 'loaded' || setup.diagnostics !== '[]') throw Error('Invalid setup ' + item.id)
      if (item.scene === 'focus' && (setup.focus !== 'default' || !setup.focusVisible)) throw Error('Invalid keyboard focus ' + item.id)
      await stableRaster(tab, directory, `${side}-${item.id}`)
      const state = await tab.playwright.evaluate(fullSnapshot)
      if (JSON.stringify(state.viewport) !== JSON.stringify(wanted) || state.dpr !== 1.190000057220459) throw Error('Invalid viewport ' + item.id)
      await fs.writeFile(`${directory}/${side}-${item.id}.json`, JSON.stringify({ setup, ...state }))
      for (let repeat = 1; repeat <= 3; repeat++) await fs.writeFile(`${directory}/${side}-${item.id}-${repeat}.jpg`, await tab.screenshot({ fullPage: false }))
      if (JSON.stringify(await tab.playwright.evaluate(fullSnapshot)) !== JSON.stringify(state)) throw Error('DOM changed ' + item.id)
    }
  }
  return { start, end, cases: end - start }
}

export async function interactions(tab, directory, side) {
  await tab.goto(`http://127.0.0.1:5179/${side}/?scene=native&theme=light&os=light`)
  await tab.playwright.locator('html[data-visual-ready="true"]').waitFor({ state: 'attached' })
  await tab.getAXState({ emit: false })
  const steps = [], observe = () => tab.playwright.evaluate(() => ({ counts: JSON.parse(document.querySelector('#counts').textContent), refs: document.querySelector('#refs').textContent, focus: document.activeElement?.id, focusVisible: document.activeElement?.matches(':focus-visible'), disabled: [...document.querySelectorAll('button:disabled')].map(n => n.id) }))
  for (const [id, action] of [['default', 'click'], ['explicit', 'Enter'], ['explicit', 'Space'], ['icon', 'Enter'], ['icon', 'Space'], ['submit', 'click'], ['disabled', 'force'], ['disabled-icon', 'force'], ['inspect-refs', 'click'], ['start', 'click'], ['start', 'Tab'], ['default', 'Tab'], ['explicit', 'Tab'], ['submit', 'Tab']]) {
    const target = tab.playwright.locator('#' + id)
    if (action === 'click' || action === 'force') await target.click(action === 'force' ? { force: true } : {})
    else await target.press(action)
    await tab.getAXState({ emit: false })
    steps.push({ id, action, ...await observe() })
  }
  await fs.writeFile(`${directory}/${side}-interactions.json`, JSON.stringify(steps, null, 2))
  return steps
}
