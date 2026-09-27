// The little of Node the tools use: the repo has no @types/node, and the game never needs it.
declare module 'node:fs' {
  export function existsSync(path: string | URL): boolean
  export function readFileSync(path: string | URL, encoding: 'utf8'): string
  export function writeFileSync(path: string | URL, data: string): void
}
declare const process: { argv: string[]; exit(code?: number): never }
