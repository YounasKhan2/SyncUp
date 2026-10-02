export type AppearancePreference = 'system' | 'light' | 'dark'

const storageKey = 'syncup-appearance'

export function parseAppearancePreference(value: string | null): AppearancePreference {
  return value === 'light' || value === 'dark' ? value : 'system'
}

export function readAppearancePreference(): AppearancePreference {
  try {
    return parseAppearancePreference(window.localStorage.getItem(storageKey))
  } catch {
    return 'system'
  }
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

// Installed at bootstrap so system changes also reach Auth and Unlock.
export function startAppearanceLifecycle() {
  applyAppearancePreference(readAppearancePreference())
  const system = window.matchMedia('(prefers-color-scheme: dark)')
  const updateSystem = () => {
    const preference = readAppearancePreference()
    if (preference === 'system') applyAppearancePreference(preference)
  }
  system.addEventListener('change', updateSystem)
  return () => system.removeEventListener('change', updateSystem)
}
