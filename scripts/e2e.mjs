// Runs the Playwright roll-flow test (e2e/rollFlow.spec.ts) with two test logins.
//
// The test signs in as a DM and a player with email and password, so it needs two test users made
// in the Supabase dashboard (see docs/PROGRESS.md). This script asks for their emails and passwords
// in the terminal, with the passwords hidden as you type, and passes them only to the test. Nothing
// is saved. You can set E2E_DM_EMAIL, E2E_DM_PASSWORD, E2E_PLAYER_EMAIL and E2E_PLAYER_PASSWORD
// instead to skip the questions. Usage: npm run test:e2e

import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline'

/** The Supabase address and publishable key, from .env.local like the app itself. */
function readEnvFile(path) {
  if (!existsSync(path)) return {}
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split('\n')
      .map((line) => /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line))
      .filter(Boolean)
      .map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')]),
  )
}

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: true })
    if (hidden) {
      // Print the question, then echo nothing while the password is typed.
      rl._writeToOutput = (text) => {
        if (text.includes(question)) stdout.write(text)
      }
    }
    rl.question(question, (answer) => {
      rl.close()
      if (hidden) stdout.write('\n')
      resolve(answer.trim())
    })
  })
}

const env = { ...readEnvFile('.env.local'), ...process.env }
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
  console.error('The Supabase address and key are missing: they live in .env.local.')
  process.exit(1)
}

console.log('The roll-flow test signs in as your two test users (see "Test logins" in docs/PROGRESS.md).')
env.E2E_DM_EMAIL ||= await ask('Test DM email: ')
env.E2E_DM_PASSWORD ||= await ask('Test DM password (hidden): ', true)
env.E2E_PLAYER_EMAIL ||= await ask('Test player email: ')
env.E2E_PLAYER_PASSWORD ||= await ask('Test player password (hidden): ', true)

const run = spawn('npx', ['playwright', 'test', ...process.argv.slice(2)], { stdio: 'inherit', env })
run.on('exit', (code) => process.exit(code ?? 1))
