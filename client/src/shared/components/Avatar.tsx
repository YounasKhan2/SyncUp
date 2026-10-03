type AvatarProps = {
  name: string
  src?: string | null
  className?: string
}

export function Avatar({ name, src, className = '' }: AvatarProps) {
  const initial = name.trim().slice(0, 1).toUpperCase() || '?'
  return (
    <span className={`avatar ui:relative ui:grid ui:place-items-center ui:overflow-hidden ${className}${src ? ' avatar-has-image' : ''}`} role="img" aria-label={name}>
      {src && <img key={src} src={src} alt="" width={64} height={64} onError={(event) => {
        event.currentTarget.style.display = 'none'
        event.currentTarget.parentElement?.classList.remove('avatar-has-image')
      }} />}
      <span aria-hidden="true">{initial}</span>
    </span>
  )
}
