export function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand-mark${small ? ' brand-mark-small' : ''}`} aria-hidden="true">
      <svg className="brand-mark-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path className="brand-mark-bubble-back" d="M35 7c-10.5 0-19 7.4-19 16.6 0 3.1 1 6 2.8 8.5L17 41l10.2-4.5c2.4.9 5 .1 7.8.1 10.5 0 19-7.4 19-16.6S45.5 7 35 7Z" />
        <path className="brand-mark-bubble-front" d="M27 17C14.9 17 5 25.2 5 35.3c0 3.6 1.3 6.9 3.7 9.6L6 56l12.5-5.5c2.6.9 5.5 1.4 8.5 1.4 12.1 0 22-8.2 22-18.3S39.1 17 27 17Z" />
      </svg>
    </div>
  )
}
