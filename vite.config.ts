import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

const SINKS = new Set(['grade', 'mix', 'zoom', 'kit'])

/**
 * The phone is on plain http over LAN, so the clipboard API is unavailable.
 * The tuning panel POSTs here instead and the values land in grade.json / mix.json / zoom.json.
 */
function gradeSink(): Plugin {
  return {
    name: 'grade-sink',
    configureServer(server) {
      server.middlewares.use('/__save', (req, res) => {
        const name = (req.url ?? '').replace(/^\//, '')
        if (req.method !== 'POST' || !SINKS.has(name)) {
          res.statusCode = 405
          return res.end()
        }
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
          writeFileSync(new URL(`./${name}.json`, import.meta.url), body)
          server.config.logger.info(`\n  values saved -> ${name}.json\n`)
          res.setHeader('content-type', 'application/json')
          res.end('{"ok":true}')
        })
      })
    },
  }
}

/**
 * Offline from the first install: after the build, write every file it made (and
 * its content hash) into dist/sw.js, so the worker can cache the whole game at
 * install, not only what one visit happened to fetch. Build only.
 */
function precache(): Plugin {
  let outDir = 'dist'
  return {
    name: 'precache',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir
    },
    closeBundle() {
      const files: string[] = []
      const walk = (d: string) => {
        for (const f of readdirSync(d)) {
          const p = join(d, f)
          if (statSync(p).isDirectory()) walk(p)
          else files.push(p)
        }
      }
      walk(outDir)
      const list = files
        .map((p) => relative(outDir, p).split(sep).join('/'))
        .filter((u) => u !== 'sw.js' && !u.endsWith('.map') && !u.endsWith('LICENSE.txt'))
        .sort()
        .map((u) => [u === 'index.html' ? './' : u, createHash('sha1').update(readFileSync(join(outDir, u))).digest('hex').slice(0, 10)])
      const version = createHash('sha1').update(JSON.stringify(list)).digest('hex').slice(0, 10)
      const sw = join(outDir, 'sw.js')
      const src = readFileSync(sw, 'utf8')
      if (!src.includes('/*__PRECACHE__*/[]') || !src.includes("/*__VERSION__*/'dev'")) throw new Error('sw.js tokens missing')
      writeFileSync(sw, src.replace('/*__PRECACHE__*/[]', JSON.stringify(list)).replace("/*__VERSION__*/'dev'", JSON.stringify(version)))
    },
  }
}

// GitHub Pages serves the build from /still-action/; the dev server stays at the root
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/still-action/' : '/',
  server: { host: true },
  plugins: [gradeSink(), precache()],
  // the build's time, for a saved run to say which build it came from
  define: { __BUILD__: JSON.stringify(new Date().toISOString()) },
}))
