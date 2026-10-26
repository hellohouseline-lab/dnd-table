import own from '../GiveDialog.module.css'

export type StatusLine = { ok: boolean; text: string }

/** What just happened, or what went wrong. */
export function Status({ status }: { status: StatusLine | null }) {
  if (!status) return null
  return (
    <p className={status.ok ? own.ok : own.problem} role="status">
      {status.text}
    </p>
  )
}
