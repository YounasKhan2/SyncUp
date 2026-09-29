import { MessageCircleHeart } from 'lucide-react'
export function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand-mark${small ? ' brand-mark-small' : ''}`} aria-hidden="true">
      <MessageCircleHeart className="brand-mark-icon" aria-hidden="true" />
    </div>
  )
}
