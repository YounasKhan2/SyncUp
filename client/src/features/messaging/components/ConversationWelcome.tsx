import { BrandMark } from '../../../shared/components/BrandMark'
import { Avatar } from '../../../shared/components/Avatar'
import type { User } from '../../../shared/types'

export function ConversationWelcome({ user }: { user: User }) {
  return (
    <section className="conversation-pane welcome-pane">
      <div className="welcome-content">
        <div className="welcome-mark">
          <BrandMark />
        </div>
        <p className="eyebrow">PRIVATE BY DESIGN</p>
        <h2>
          Good conversations
          <br />
          <em>start with hello.</em>
        </h2>
        <p className="welcome-description">
          Your personal messages are encrypted on your device. Start a direct
          chat or create a group with people you trust.
        </p>
        <div className="welcome-profile">
          <Avatar name={user.display_name} src={user.avatar_url} className="avatar-card" />
          <div>
            <span className="small strong">{user.display_name}</span>
            <span className="micro muted">@{user.username}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
