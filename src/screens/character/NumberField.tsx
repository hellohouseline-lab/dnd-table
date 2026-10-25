import { useState } from 'react'
import { TextField } from '../../components/Field.tsx'

type NumberFieldProps = {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  hint?: string
}

/**
 * A number box that can be emptied while typing. It only passes on whole numbers within
 * min and max, and picks up changes made elsewhere (like rules defaults being filled in).
 */
export function NumberField({ label, value, min, max, onChange, hint }: NumberFieldProps) {
  const [text, setText] = useState(String(value))
  const [shown, setShown] = useState(value)

  // A new value from outside replaces the text, unless the text already says it.
  if (shown !== value) {
    setShown(value)
    if (text === '' || Number(text) !== value) setText(String(value))
  }

  return (
    <TextField
      label={label}
      hint={hint}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      required
      value={text}
      onChange={(event) => {
        setText(event.target.value)
        const number = Number(event.target.value)
        if (event.target.value !== '' && Number.isInteger(number) && number >= min && number <= max) onChange(number)
      }}
    />
  )
}
