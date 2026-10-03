import type { ComponentPropsWithoutRef, MouseEventHandler } from 'react'

type DialogProps = Omit<ComponentPropsWithoutRef<'section'>, 'role' | 'aria-modal'> & {
  'aria-labelledby': string
  overlayClassName?: string
  onBackdropMouseDown: MouseEventHandler<HTMLDivElement>
}

// Presentation only. The consumer retains mounting, dismissal and all focus/Escape policy.
export function Dialog({ children, className, overlayClassName, onBackdropMouseDown, ...props }: DialogProps) {
  return <div className={['ui-dialog-overlay ui:fixed ui:z-overlay ui:grid ui:place-items-center ui:bg-overlay', overlayClassName].filter(Boolean).join(' ')} role="presentation" onMouseDown={onBackdropMouseDown}>
    <section {...props} className={['ui-dialog ui:box-border', 'account-dialog', className].filter(Boolean).join(' ')} role="dialog" aria-modal="true">
      {children}
    </section>
  </div>
}
