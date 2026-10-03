import type { ComponentPropsWithRef } from 'react'

// The repeated full-width primary action. Consumers own type, loading copy and disabling.
export function Button({ className, ...props }: ComponentPropsWithRef<'button'>) {
  return <button {...props} className={['ui-button ui:flex ui:w-full ui:items-center ui:justify-center ui:rounded-md ui:text-brand-foreground ui:bg-brand ui:cursor-pointer ui:[&:hover:not(:disabled)]:bg-brand-hover ui:disabled:cursor-wait ui:disabled:opacity-70', className].filter(Boolean).join(' ')} />
}
