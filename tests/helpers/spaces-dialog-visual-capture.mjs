import fs from 'node:fs/promises'
import { snapshot, stableRaster } from './spaces-visual-capture.mjs'

export const cases = ['desktop', 'mobile'].flatMap(size =>
  [{ theme: 'light', os: 'light' }, { theme: 'dark', os: 'light' }, { theme: 'system', os: 'light' }, { theme: 'system', os: 'dark' }].flatMap(mode =>
    ['channel', 'channel-voice', 'channel-busy-error', 'category', 'category-busy-error'].map(scene => ({ size, ...mode, scene, id: `${size}-${mode.theme}-${mode.os}-${scene}` }))))
export async function capture(tab, viewport, directory, side, start, end) {
  await fs.mkdir(directory, { recursive: true })
  for (const item of cases.slice(start, end)) {
    const wanted = item.size === 'desktop' ? [1440, 900] : [390, 844]
    if (JSON.stringify(await tab.playwright.evaluate(() => [innerWidth, innerHeight])) !== JSON.stringify(wanted)) await viewport.set(item.size === 'desktop' ? { width: 1714, height: 1071 } : { width: 464, height: 1004 })
    await tab.goto(`http://127.0.0.1:5175/${side}/?scene=${item.scene}&theme=${item.theme}&os=${item.os}`)
    await tab.playwright.locator('html[data-visual-ready="true"]').waitFor({ state: 'attached' })
    await tab.getAXState({ emit: false })
    const state = await tab.playwright.evaluate(snapshot), effective = item.theme === 'system' ? item.os : item.theme
    if (state.theme !== effective || state.appearance !== item.theme || state.colorScheme !== effective || state.systemDark !== (item.os === 'dark') || state.systemLight !== (item.os === 'light') || state.fonts !== 'loaded' || state.diagnostics !== '[]' || state.dpr !== 1.190000057220459 || JSON.stringify(state.viewport) !== JSON.stringify(wanted)) throw new Error(`Invalid dialog setup: ${side}/${item.id}`)
    await fs.writeFile(`${directory}/${side}-${item.id}.json`, JSON.stringify(state))
    await stableRaster(tab, directory, `${side}-${item.id}`)
    for (let repeat = 1; repeat <= 3; repeat++) {
      await fs.writeFile(`${directory}/${side}-${item.id}-${repeat}.jpg`, await tab.screenshot({ fullPage: false }))
      if (JSON.stringify(await tab.playwright.evaluate(snapshot)) !== JSON.stringify(state)) throw new Error(`Dialog state changed: ${side}/${item.id}/${repeat}`)
    }
  }
  return { side, start, end, scenes: end - start }
}
