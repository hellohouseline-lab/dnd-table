import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import styles from './Field.module.css'

type FieldFrameProps = { label: string; hint?: string; children: (ids: { id: string; hintId?: string }) => ReactNode }

function FieldFrame({ label, hint, children }: FieldFrameProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children({ id, hintId })}
      {hint && (
        <div id={hintId} className={styles.hint}>
          {hint}
        </div>
      )}
    </div>
  )
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }

/** A labelled text box in the table's dark style. */
export function TextField({ label, hint, ...input }: TextFieldProps) {
  return (
    <FieldFrame label={label} hint={hint}>
      {({ id, hintId }) => <input id={id} aria-describedby={hintId} className={styles.input} {...input} />}
    </FieldFrame>
  )
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string }

/** A labelled drop-down in the table's dark style. */
export function SelectField({ label, hint, children, ...select }: SelectFieldProps) {
  return (
    <FieldFrame label={label} hint={hint}>
      {({ id, hintId }) => (
        <select id={id} aria-describedby={hintId} className={styles.input} {...select}>
          {children}
        </select>
      )}
    </FieldFrame>
  )
}
