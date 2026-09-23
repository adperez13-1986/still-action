import { writeFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'

const SINKS = new Set(['grade', 'mix'])

/**
 * The phone is on plain http over LAN, so the clipboard API is unavailable.
 * The tuning panel POSTs here instead and the values land in grade.json / mix.json.
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

export default defineConfig({
  server: { host: true },
  plugins: [gradeSink()],
})
