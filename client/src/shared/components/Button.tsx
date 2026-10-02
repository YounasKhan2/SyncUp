import type { ComponentPropsWithRef } from 'react'

// The repeated full-width primary action. Consumers own type, loading copy and disabling.
export function Button({ className, ...props }: ComponentPropsWithRef<'button'>) {
  return <button {...props} className={['ui-button', className].filter(Boolean).join(' ')} />
}
