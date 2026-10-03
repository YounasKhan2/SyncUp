import { Avatar } from '../../../shared/components/Avatar'
import type { IncomingCall } from '../../../shared/types'

type IncomingCallBannerProps = {
  incomingCall: IncomingCall
  onAnswer: () => void
  onDecline: () => void
}

export function IncomingCallBanner({ incomingCall, onAnswer, onDecline }: IncomingCallBannerProps) {
  return (
    <section className="incoming-call-banner" role="alertdialog" aria-modal="true" aria-labelledby="incoming-call-title">
      <Avatar name={incomingCall.group_title ?? incomingCall.caller_name} src={incomingCall.is_group ? undefined : incomingCall.caller_avatar_url} />
      <div><strong id="incoming-call-title">{incomingCall.group_title ?? incomingCall.caller_name}</strong><small>{incomingCall.is_group ? `${incomingCall.caller_name} is calling` : `Incoming ${incomingCall.call_type} call`}</small></div>
      <button type="button" className="answer-call-button" onClick={onAnswer}>Answer</button>
      <button type="button" className="decline-call-button" onClick={onDecline}>Decline</button>
    </section>
  )
}
