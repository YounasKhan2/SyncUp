import { Monitor } from 'lucide-react'

type SessionRow = { id: string; deviceName: string; activeLabel: string; isCurrent: boolean; onRevoke: () => void }

export function AccountSessionsSection({ rows, error, onRefresh }: {
  rows: SessionRow[]
  error: string
  onRefresh: () => void
}) {
  return (
        <div className="sessions-section ui:text-primary">
          <div className="sessions-heading"><h3>Active sessions</h3><button type="button" onClick={onRefresh}>Refresh</button></div>
          <p className="sessions-caption">Sign out devices you no longer use.</p>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="session-list">
            {rows.map((row) => (
              <div className="session-row" key={row.id}>
                <span className="session-device" aria-hidden="true"><Monitor size={14} /></span>
                <div><span className="small strong">{row.deviceName}{row.isCurrent ? ' · This device' : ''}</span><span className="micro muted">Active {row.activeLabel}</span></div>
                {!row.isCurrent && <button type="button" onClick={row.onRevoke}>Revoke</button>}
              </div>
            ))}
            {rows.length === 0 && !error && <p className="sessions-caption">No active sessions found.</p>}
          </div>
        </div>
  )
}
