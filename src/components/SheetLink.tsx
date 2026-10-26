import type { ReactNode } from 'react'
import { href } from '../app/router.ts'

type SheetLinkProps = {
  campaignId: string
  characterId: string
  /** On a plain click, open the sheet in the app instead (Screen 1's panel). */
  onOpen?: () => void
  className?: string
  title?: string
  children: ReactNode
}

/**
 * A link to a character's sheet that behaves like any link: it opens in a new browser tab, so it
 * can sit on another monitor, and Cmd or Ctrl click and middle click do what they always do. Where
 * the app has its own quick view (onOpen), a plain click opens that instead.
 */
export function SheetLink({ campaignId, characterId, onOpen, className, title, children }: SheetLinkProps) {
  return (
    <a
      href={href(`/c/${campaignId}/sheet/${characterId}`)}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      title={title}
      onClick={(event) => {
        const plain = event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
        if (onOpen && plain) {
          event.preventDefault()
          onOpen()
        }
      }}
    >
      {children}
    </a>
  )
}
