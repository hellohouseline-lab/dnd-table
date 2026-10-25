// Runs the pgTAP files in supabase/tests/database against the linked Supabase project, without Docker.
//
// `supabase test db` needs Docker, so instead each file is sent as one batch through `supabase db query`.
// The batch always ends by raising an error that carries the results, which makes the database undo
// everything the tests did. Nothing a test creates is ever kept. Error messages are cut short after
// about a thousand characters, so the report is a count plus the full text of any failures.
//
// Test files follow the usual pgTAP shape (begin; plan; assertions; finish; rollback), with each
// statement ending in ';' at the end of a line. Usage: npm run test:db

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const TEST_DIR = 'supabase/tests/database'
const SUPABASE = 'node_modules/.bin/supabase'
const ASSERTION = /^select\s+(ok|is|isnt|matches|imatches|throws_ok|lives_ok|cmp_ok|results_eq|set_eq|bag_eq|is_empty|isnt_empty|pass|fail)\s*\(/i
const MARKER = 'TAP-RESULTS'

const SETUP = `
create schema tap_run;
create table tap_run.out (n serial primary key, line text not null);
grant usage on schema tap_run to anon, authenticated;
grant select, insert on tap_run.out to anon, authenticated;
grant usage on sequence tap_run.out_n_seq to anon, authenticated`

const REPORT = `
reset role;
do $$
begin
  raise exception '${MARKER}%', E'\\n'
    || (select count(*) filter (where line like 'ok %') || ' passed, '
          || count(*) filter (where line not like 'ok %') || ' failed'
        from tap_run.out)
    || coalesce(E'\\n' || (select string_agg(line, E'\\n' order by n) from tap_run.out where line not like 'ok %'), '')
    || coalesce(E'\\n' || (select string_agg(f, E'\\n') from extensions.finish() f), '');
end
$$`

function toBatch(sql) {
  const statements = sql
    .replace(/^\s*--.*$/gm, '')
    .split(/;\s*\n/)
    .map((statement) => statement.trim())
    .filter((statement) => statement && !/^(begin|rollback|reset role|select \* from finish\(\))$/i.test(statement))
    .map((statement) => (ASSERTION.test(statement) ? `insert into tap_run.out (line) ${statement}` : statement))
  return [SETUP, ...statements, REPORT].join(';\n') + ';\n'
}

function runBatch(batch) {
  const dir = mkdtempSync(join(tmpdir(), 'dnd-table-tests-'))
  const file = join(dir, 'batch.sql')
  writeFileSync(file, batch)
  try {
    execFileSync(SUPABASE, ['db', 'query', '--linked', '-f', file], { encoding: 'utf8', stdio: 'pipe' })
    throw new Error('The batch finished without reporting results, so it may not have been undone.')
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}` || String(error)
    return readResults(output)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// The CLI prints {"error":{"message":"unexpected status 400: {\"message\":\"... TAP-RESULTS ...\"}"}}.
function readResults(output) {
  const json = output.split('\n').find((line) => line.startsWith('{"_tag"')) ?? ''
  try {
    const outer = JSON.parse(json).error.message
    const inner = JSON.parse(outer.slice(outer.indexOf('{'))).message
    const start = inner.indexOf(MARKER)
    if (start === -1) return { ok: false, text: inner }
    const text = inner.slice(start + MARKER.length).split('\nCONTEXT:')[0].trim()
    return { ok: /^\d+ passed, 0 failed$/m.test(text) && !/^# Looks like/m.test(text), text }
  } catch {
    return { ok: false, text: output }
  }
}

let allPassed = true
for (const name of readdirSync(TEST_DIR).filter((file) => file.endsWith('.test.sql')).sort()) {
  const { ok, text } = runBatch(toBatch(readFileSync(join(TEST_DIR, name), 'utf8')))
  console.log(`\n# ${name}\n${text}`)
  allPassed &&= ok
}
console.log(allPassed ? '\nAll database tests passed.' : '\nSome database tests failed.')
process.exit(allPassed ? 0 : 1)
