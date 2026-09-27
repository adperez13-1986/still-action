/**
 * Folds playtest logs exported from the phone into playtest.json, one entry per run key
 * (the later save of a run wins, the same rule the dev server uses).
 *
 *   npx tsx tools/mergelog.ts ~/Downloads/still-playtest-2026-09-27.json [more.json ...]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

interface Entry { key: string; savedAt?: string }

const file = new URL('../playtest.json', import.meta.url)
const runs: Entry[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []
const files = process.argv.slice(2)
if (!files.length) {
  console.error('usage: npx tsx tools/mergelog.ts <exported.json> [...]')
  process.exit(1)
}

let added = 0
let replaced = 0
for (const path of files) {
  for (const entry of JSON.parse(readFileSync(path, 'utf8')) as Entry[]) {
    const i = runs.findIndex((r) => r.key === entry.key)
    if (i < 0) {
      runs.push(entry)
      added++
    } else if ((entry.savedAt ?? '') > (runs[i]!.savedAt ?? '')) {
      runs[i] = entry
      replaced++
    }
  }
}
writeFileSync(file, JSON.stringify(runs, null, 1))
console.log(`playtest.json: ${added} added, ${replaced} updated, ${runs.length} runs`)
