type AvatarProps = {
  name: string
  src?: string | null
  className?: string
}

export function Avatar({ name, src, className = '' }: AvatarProps) {
  const initial = name.trim().slice(0, 1).toUpperCase() || '?'
  return (
    <span className={`avatar ${className}${src ? ' avatar-has-image' : ''}`} role="img" aria-label={name}>
      {src && <img key={src} src={src} alt="" onError={(event) => {
        event.currentTarget.style.display = 'none'
        event.currentTarget.parentElement?.classList.remove('avatar-has-image')
      }} />}
      <span aria-hidden="true">{initial}</span>
    </span>
  )
}
