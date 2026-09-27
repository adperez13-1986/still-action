/**
 * The playtest log on the phone itself, for the installed game (the dev server keeps
 * playtest.json instead). Owner-only: `?owner` once turns it on for this device, `?owner=0`
 * turns it off; nobody else's runs are ever recorded. Nothing leaves the phone until the
 * pause screen's export hands the file to the share sheet; `npx tsx tools/mergelog.ts <file>`
 * folds it into playtest.json.
 */

const OWNER_KEY = 'still-action.owner'
const LOG_KEY = 'still-action.playlog'
/** Runs kept, newest last: ~13 kB each, far inside localStorage's ~5 MB. */
const KEEP = 80

/** One run as the playtest file holds it; `key` makes a later save of the same run replace it. */
export interface PlayEntry { key: string; [field: string]: unknown }

/** Reads `?owner` from the address once at boot; true when this device records. */
export function ownerFromUrl(): boolean {
  const q = new URLSearchParams(location.search)
  try {
    if (q.has('owner')) {
      if (q.get('owner') === '0') localStorage.removeItem(OWNER_KEY)
      else localStorage.setItem(OWNER_KEY, '1')
    }
    return localStorage.getItem(OWNER_KEY) === '1'
  } catch {
    return false
  }
}

export function readLog(): PlayEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY)
    const runs = raw ? (JSON.parse(raw) as PlayEntry[]) : []
    return Array.isArray(runs) ? runs : []
  } catch {
    return []
  }
}

/** Keeps `entry`, replacing its own earlier save; the oldest runs go first when space runs out. */
export function keep(entry: PlayEntry) {
  const runs = readLog()
  const i = runs.findIndex((r) => r.key === entry.key)
  if (i >= 0) runs[i] = entry
  else runs.push(entry)
  let kept = runs.slice(-KEEP)
  while (kept.length) {
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(kept))
      return
    } catch {
      // full, or storage blocked: drop the older half and try again
      if (kept.length === 1) return
      kept = kept.slice(Math.floor(kept.length / 2))
    }
  }
}

/**
 * Hands the log to the share sheet as a .json file (send it to yourself, save to Files);
 * where sharing files isn't possible (plain http on the LAN, a desktop), it downloads instead.
 */
export async function exportLog() {
  const runs = readLog()
  const day = new Date().toISOString().slice(0, 10)
  const file = new File([JSON.stringify(runs, null, 1)], `still-playtest-${day}.json`, { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Still playtest log' })
      return
    } catch (err) {
      // closing the sheet is a choice, not a failure
      if ((err as Error).name === 'AbortError') return
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}
