// Validation-only instrumentation. DOM-backed report; no product handlers or network are changed.
(() => {
  const events = []
  const publish = () => {
    let report = document.getElementById('final-validation-events')
    if (!report && document.body) {
      report = document.createElement('output')
      report.id = 'final-validation-events'
      report.hidden = true
      document.body.append(report)
    }
    if (report) report.textContent = JSON.stringify(events)
  }
  const record = (kind, message) => { events.push({ kind, message: String(message) }); publish() }
  window.addEventListener('error', (event) => record(event.error ? 'uncaught' : 'resource/error', event.message || event.target?.src || event.target?.href || 'unknown'), true)
  window.addEventListener('unhandledrejection', (event) => record('unhandled rejection', event.reason?.message || event.reason))
  for (const kind of ['error', 'warn']) {
    const original = console[kind].bind(console)
    console[kind] = (...args) => { record(`console.${kind}`, args.join(' ')); original(...args) }
  }
  document.addEventListener('DOMContentLoaded', publish, { once: true })
})()
