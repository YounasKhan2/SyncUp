// Verification-only color-preference boundary, installed before CSS/modules.
(() => {
  const params = new URLSearchParams(location.search)
  const preference = params.get('theme') ?? 'light'
  const os = params.get('os') ?? 'light'
  if (!['light', 'dark', 'system'].includes(preference) || !['light', 'dark'].includes(os)) throw new Error('Invalid visual theme')
  const nativeMatchMedia = window.matchMedia.bind(window)
  window.matchMedia = query => {
    if (!/^\(prefers-color-scheme: (dark|light)\)$/.test(query)) return nativeMatchMedia(query)
    const matches = query.includes(os)
    return { matches, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true } }
  }
  const effective = preference === 'system' ? os : preference
  document.documentElement.dataset.appearance = preference
  document.documentElement.dataset.theme = effective
  document.documentElement.style.colorScheme = effective
  document.documentElement.dataset.visualOs = os
  document.documentElement.dataset.visualSystemDark = String(window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.visualSystemLight = String(window.matchMedia('(prefers-color-scheme: light)').matches)
  window.__spacesVisual = { preference, os, effective, nativeDark: nativeMatchMedia('(prefers-color-scheme: dark)').matches }
})()
