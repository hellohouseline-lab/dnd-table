import { useState } from 'react'
import { cx } from '../../components/cx.ts'
import styles from './SheetPanel.module.css'

/** Puts text on the clipboard; true if it worked. */
async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Saves text as a .txt file in the browser's downloads. */
function download(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Copy or download a character sheet (or the whole party's) as plain text, with a picture
 * description at the top for making a portrait with an image generator.
 */
export function SheetExport({
  text,
  fileName,
  copyLabel = 'Copy as text',
  className,
}: {
  text: () => string
  fileName: string
  copyLabel?: string
  className?: string
}) {
  const [said, setSaid] = useState<string | null>(null)
  const tell = (words: string) => {
    setSaid(words)
    setTimeout(() => setSaid(null), 2500)
  }
  return (
    <span className={cx(styles.export, className)}>
      <button
        type="button"
        className={styles.exportButton}
        title="The whole sheet as text, with a picture description for an image generator"
        onClick={() => void copy(text()).then((ok) => tell(ok ? 'Copied' : 'Couldn’t copy: try Download'))}
      >
        {copyLabel}
      </button>
      <button type="button" className={styles.exportButton} onClick={() => download(text(), fileName)}>
        Download
      </button>
      {said && (
        <span className={styles.exportSaid} role="status">
          {said}
        </span>
      )}
    </span>
  )
}
