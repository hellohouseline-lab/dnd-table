import { useCallback, useEffect, useRef, useState } from 'react'
import { createDiceTray, type DiceTray, type TrayThrow } from './diceTray.ts'

/**
 * Puts a 3D dice tray in the element given to `attach` (as its ref). `throwDice` resolves once the dice land. If
 * the browser can't show 3D (no WebGL), it resolves straight away and only the result card shows.
 */
export function useDiceTray() {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const ready = useRef<Promise<DiceTray | null>>(Promise.resolve(null))

  useEffect(() => {
    if (!element) return
    let tray: DiceTray | null = null
    let gone = false
    ready.current = createDiceTray(element)
      .then((made) => {
        if (gone) {
          made.destroy()
          return null
        }
        tray = made
        return made
      })
      .catch((error: unknown) => {
        console.warn('3D dice are not available in this browser', error)
        return null
      })
    return () => {
      gone = true
      tray?.destroy()
      ready.current = Promise.resolve(null)
    }
  }, [element])

  const throwDice = useCallback(async (dice: TrayThrow) => {
    const tray = await ready.current
    await tray?.throw(dice)
  }, [])

  return { attach: setElement, throwDice }
}
