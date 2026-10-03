// Invoke only from cua_repl with its documented tab/viewport handles.
import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'

export async function stableRaster(tab, directory, identity) {
  await fs.mkdir(`${directory}/warmups`, { recursive: true })
  let previous, consecutive = 0
  const frames = []
  for (let frame = 1; frame <= 12; frame++) {
    const raster = await tab.screenshot({ fullPage: false })
    const digest = createHash('sha256').update(raster).digest('hex')
    const file = `warmups/${identity}-${frame}.jpg`
    await fs.writeFile(`${directory}/${file}`, raster)
    frames.push({ file, sha256: digest })
    consecutive = digest === previous ? consecutive + 1 : 1
    previous = digest
    if (consecutive === 3) {
      await fs.writeFile(`${directory}/warmups/${identity}.json`, JSON.stringify({ frames, stableSHA256: digest, consecutive }))
      return
    }
  }
  throw new Error(`No three consecutive identical rasters: ${identity}`)
}

export const cases = ['desktop', 'mobile'].flatMap(size =>
  [{ theme: 'light', os: 'light' }, { theme: 'dark', os: 'light' }, { theme: 'system', os: 'light' }, { theme: 'system', os: 'dark' }].flatMap(mode =>
    ['home', 'text', 'announcement', 'private', 'voice', 'history', 'object', 'collapsed'].map(scene => ({ size, ...mode, scene, id: `${size}-${mode.theme}-${mode.os}-${scene}` }))))

export const snapshot = () => {
  const visit = node => {
    if (node.nodeType === 3) return { text: node.textContent }
    if (node.nodeType !== 1) return null
    const style = getComputedStyle(node), rect = node.getBoundingClientRect()
    return { tag: node.tagName, attributes: Object.fromEntries([...node.attributes].map(a => [a.name, a.value]).sort()),
      value: 'value' in node ? node.value : undefined,
      style: Object.fromEntries([...style].sort().map(key => [key, style.getPropertyValue(key)])),
      bounds: [rect.x, rect.y, rect.width, rect.height], children: [...node.childNodes].map(visit).filter(x => x !== null) }
  }
  const root = document.querySelector('#root'), active = document.activeElement
  const focus = active === document.body ? { tag: 'BODY' } : { tag: active?.tagName, html: active?.outerHTML,
    path: (() => { const result = []; let node = active; while (node && node !== root) { result.unshift([...node.parentNode.childNodes].indexOf(node)); node = node.parentNode } return result })() }
  return { viewport: [innerWidth, innerHeight], dpr: devicePixelRatio,
    theme: document.documentElement.dataset.theme, appearance: document.documentElement.dataset.appearance,
    rootAttributes: Object.fromEntries([...document.documentElement.attributes].map(a => [a.name, a.value]).sort()),
    // cua evaluate runs in an isolated observation world. Read the actual page's
    // pre-initialization matchMedia probes persisted by the bootstrap in DOM.
    colorScheme: document.documentElement.style.colorScheme, systemDark: document.documentElement.dataset.visualSystemDark === 'true',
    systemLight: document.documentElement.dataset.visualSystemLight === 'true', fonts: document.fonts.status,
    ready: document.documentElement.dataset.visualReady, focus,
    diagnostics: document.querySelector('#final-validation-events')?.textContent,
    tree: visit(root), regions: [...document.querySelectorAll('#root main, .space-channel-header, .space-sidebar, .space-message-list, .space-message-composer, .space-voice-welcome, .legacy-history-inline, [aria-label="Fixture controls"]')].map(node => {
      const rect = node.getBoundingClientRect(); return { label: node.className || node.getAttribute('aria-label'), bounds: [rect.x, rect.y, rect.width, rect.height], display: getComputedStyle(node).display }
    }) }
}

export async function capture(tab, viewport, directory, start, end) {
  await fs.mkdir(directory, { recursive: true })
  for (const item of cases.slice(start, end)) {
    const wanted = item.size === 'desktop' ? [1440, 900] : [390, 844]
    // Viewport applies once per dimension batch rather than repeatedly per scene.
    const current = await tab.playwright.evaluate(() => [innerWidth, innerHeight])
    if (JSON.stringify(current) !== JSON.stringify(wanted)) await viewport.set(item.size === 'desktop' ? { width: 1714, height: 1071 } : { width: 464, height: 1004 })
    for (const side of ['base', 'head']) {
      await tab.goto(`http://127.0.0.1:5174/${side}/?scene=${item.scene}&theme=${item.theme}&os=${item.os}`)
      await tab.playwright.locator('html[data-visual-ready="true"]').waitFor({ state: 'attached' })
      await tab.getAXState({ emit: false })
      const state = await tab.playwright.evaluate(snapshot)
      const effective = item.theme === 'system' ? item.os : item.theme
      if (state.theme !== effective || state.appearance !== item.theme || state.colorScheme !== effective
        || state.systemDark !== (item.os === 'dark') || state.systemLight !== (item.os === 'light')
        || state.fonts !== 'loaded' || state.ready !== 'true' || state.diagnostics !== '[]'
        || JSON.stringify(state.viewport) !== JSON.stringify(wanted) || state.dpr !== 1.190000057220459) throw new Error(`Invalid capture setup: ${side}/${item.id}`)
      await fs.writeFile(`${directory}/${side}-${item.id}.json`, JSON.stringify(state))
      await stableRaster(tab, directory, `${side}-${item.id}`)
      for (let repeat = 1; repeat <= 3; repeat++) {
        await fs.writeFile(`${directory}/${side}-${item.id}-${repeat}.jpg`, await tab.screenshot({ fullPage: false }))
        const next = await tab.playwright.evaluate(snapshot)
        if (JSON.stringify(next) !== JSON.stringify(state)) throw new Error(`State changed across captures: ${side}/${item.id}/${repeat}`)
      }
    }
  }
  return { start, end, scenes: end - start, screenshots: (end - start) * 6 }
}

export async function captureActions(tab, viewport, directory) {
  const labels = ['Search Project', 'Files in general', 'Edit channel', 'announcement', 'Project', 'Project', 'All Spaces', 'Project 4 channels · Owner', 'voice', 'Join voice']
  await viewport.set({ width: 1714, height: 1071 })
  for (const side of ['base', 'head']) {
    await tab.goto(`http://127.0.0.1:5174/${side}/?scene=text&theme=system&os=dark`)
    await tab.playwright.locator('html[data-visual-ready="true"]').waitFor({ state: 'attached' })
    await tab.getAXState({ emit: false })
    for (let index = 0; index < labels.length; index++) {
      const name = labels[index]
      const target = name === 'Join voice' ? tab.playwright.locator('.space-channel-header').getByRole('button', { name, exact: true }) : tab.playwright.getByRole('button', { name, exact: true })
      await target.click()
      await tab.getAXState({ emit: false })
      const identity = `${side}-action-desktop-${index}`
      await stableRaster(tab, directory, identity)
      const state = await tab.playwright.evaluate(snapshot)
      await fs.writeFile(`${directory}/${identity}.json`, JSON.stringify(state))
      for (let repeat = 1; repeat <= 3; repeat++) {
        await fs.writeFile(`${directory}/${identity}-${repeat}.jpg`, await tab.screenshot({ fullPage: false }))
        if (JSON.stringify(await tab.playwright.evaluate(snapshot)) !== JSON.stringify(state)) throw new Error(`Action state changed: ${identity}`)
      }
    }
  }
  return { actionPairs: labels.length, labels }
}
