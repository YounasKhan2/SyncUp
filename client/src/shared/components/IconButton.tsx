import type { ComponentPropsWithRef } from 'react'

type IconButtonProps = ComponentPropsWithRef<'button'> & { 'aria-label': string }

export function IconButton({ className, ...props }: IconButtonProps) {
  return <button {...props} className={['ui-icon-button ui:grid ui:place-items-center ui:text-secondary ui:bg-hover ui:cursor-pointer', className].filter(Boolean).join(' ')} />
}
