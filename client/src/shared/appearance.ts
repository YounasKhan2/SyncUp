export type AppearancePreference = 'system' | 'light' | 'dark'

const storageKey = 'syncup-appearance'

export function parseAppearancePreference(value: string | null): AppearancePreference {
  return value === 'light' || value === 'dark' ? value : 'system'
}

export function readAppearancePreference(): AppearancePreference {
  return parseAppearancePreference(window.localStorage.getItem(storageKey))
}

export function saveAppearancePreference(preference: AppearancePreference) {
  window.localStorage.setItem(storageKey, preference)
}

export function applyAppearancePreference(preference: AppearancePreference) {
  const root = document.documentElement
  const effectiveTheme = preference === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    : preference
  root.dataset.appearance = preference
  root.dataset.theme = effectiveTheme
  root.style.colorScheme = effectiveTheme
}
