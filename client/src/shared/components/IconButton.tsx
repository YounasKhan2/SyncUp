import type { ComponentPropsWithRef } from 'react'

type IconButtonProps = ComponentPropsWithRef<'button'> & { 'aria-label': string }

export function IconButton({ className, ...props }: IconButtonProps) {
  return <button {...props} className={['ui-icon-button', className].filter(Boolean).join(' ')} />
}
