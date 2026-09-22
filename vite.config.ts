import { writeFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'

/**
 * The phone is on plain http over LAN, so the clipboard API is unavailable.
 * The grade panel POSTs here instead and the values land in grade.json.
 */
function gradeSink(): Plugin {
  return {
    name: 'grade-sink',
    configureServer(server) {
      server.middlewares.use('/__grade', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end()
        }
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
          writeFileSync(new URL('./grade.json', import.meta.url), body)
          server.config.logger.info('\n  grade values saved -> grade.json\n')
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
