import { lazy, Suspense } from 'react'
import type { PickerProps } from 'emoji-picker-react'

const EmojiPicker = lazy(async () => {
  const picker = await import('emoji-picker-react')
  const Picker = picker.default
  function ThemedPicker(props: Omit<PickerProps, 'theme'>) {
    const theme = document.documentElement.dataset.theme === 'dark'
      ? picker.Theme.DARK
      : picker.Theme.LIGHT
    return <Picker {...props} theme={theme} />
  }
  return { default: ThemedPicker }
})

export function FullEmojiPicker({ onSelect, onClose }: {
  onSelect: (emoji: string) => void
  onClose: () => void
}) {
  return (
    <div
      role="dialog"
      aria-label="Choose an emoji"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
    >
      <Suspense fallback={<div className="emoji-picker-loading" role="status">Loading emoji…</div>}>
        <EmojiPicker
          open
          width="min(340px, calc(100vw - 32px))"
          height={400}
          previewConfig={{ showPreview: false }}
          onEmojiClick={(emoji) => onSelect(emoji.emoji)}
        />
      </Suspense>
    </div>
  )
}
