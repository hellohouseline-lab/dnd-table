// Art and sound from the private buckets, kept in the browser after the first download. Files are
// never changed once uploaded (each upload gets a new name), so a kept copy is never out of date,
// and a 300 MB music library is downloaded once rather than every session.

import { supabase } from './supabase.ts'

export type Bucket = 'art' | 'audio'

const CACHE_NAME = 'dnd-table-files-v1'
const SIGNED_URL_SECONDS = 60 * 60
const urls = new Map<string, Promise<string | null>>()

function cacheKey(bucket: Bucket, path: string): string {
  return `https://files.dnd-table.invalid/${bucket}/${path}`
}

async function signedUrl(bucket: Bucket, path: string): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_SECONDS)
  return data?.signedUrl ?? null
}

async function load(bucket: Bucket, path: string): Promise<string | null> {
  const key = cacheKey(bucket, path)
  const cache = typeof caches === 'undefined' ? null : await caches.open(CACHE_NAME).catch(() => null)
  const kept = await cache?.match(key)
  if (kept) return URL.createObjectURL(await kept.blob())

  const url = await signedUrl(bucket, path)
  if (!url) return null
  if (!cache) return url
  const response = await fetch(url)
  if (!response.ok) return null
  await cache.put(key, response.clone()).catch(() => undefined)
  return URL.createObjectURL(await response.blob())
}

/** A local address for a file, downloading it the first time. Null if it can't be had. */
export function fileUrl(bucket: Bucket, path: string): Promise<string | null> {
  const key = `${bucket}/${path}`
  let url = urls.get(key)
  if (!url) {
    url = load(bucket, path).catch(() => null)
    urls.set(key, url)
    // Try again next time if this one failed.
    void url.then((found) => found === null && urls.delete(key))
  }
  return url
}

/** Forgets a kept file, after the DM deletes it from the library. */
export function forgetFile(bucket: Bucket, path: string): void {
  urls.delete(`${bucket}/${path}`)
  if (typeof caches !== 'undefined') void caches.open(CACHE_NAME).then((cache) => cache.delete(cacheKey(bucket, path)))
}
