import { useEffect, useState } from 'react'

/** Loads one of the big SRD data sets (see rules/srd), giving null until it arrives. */
export function useSrd<T>(load: () => Promise<T>): T | null {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => {
    let current = true
    void load().then((loaded) => current && setData(loaded))
    return () => {
      current = false
    }
  }, [load])
  return data
}
