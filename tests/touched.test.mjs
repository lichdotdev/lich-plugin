// Pins the session-touched clients to lich's contract: the paths each harness
// sends for its own write, `hold` where the harness cannot show the note there,
// `collect` before its next model call, and the note lich answers with, handed
// to the model in the harness's own shape and byte for byte. The script
// harnesses run hooks/report-touched.sh as their registration spells it;
// opencode and omp run their modules in process.
//
// The notes are lich's, replayed from session-touched.jsonl. The payloads are
// the providers' own as measured on 2026-11-23 (docs/session-touched.md), cut
// to the fields that matter.
//
// Run: node --test tests/

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { CASES, LICH_SESSION_ID, ROOT, TOKEN, assertContractHonoured, assertReportHonoured, lichEnv, settleStubs, startStub, withStub } from './contract.mjs'
import { LichPlugin } from '../opencode/lich.js'
import lichPlugin from '../omp/lich.js'

const ENDPOINT = '/session-touched'
const NOTES = [...new Set(CASES[ENDPOINT].map((c) => c.answer?.note).filter(Boolean))]
const NOTE = NOTES[0]

// ---------------------------------------------------------------- clients --

const BASE_ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('LICH_')))
const TMP = mkdtempSync(path.join(tmpdir(), 'lich-plugin-touched-'))
const SPACED_ROOT = path.join(TMP, 'Application Support')
symlinkSync(ROOT, SPACED_ROOT)

const read = (file) => JSON.parse(readFileSync(path.join(ROOT, file), 'utf8'))
const hooksIn = (group) => (Array.isArray(group.hooks) ? group.hooks : [group])

/** The registered touched command a hook file runs on `event`. */
function touchedCommand(file, event) {
  const events = read(file).hooks ?? read(file).lich
  for (const group of events[event] ?? []) {
    for (const hook of hooksIn(group)) if (hook.command.includes('report-touched.sh')) return hook.command
  }
  assert.fail(`${file} registers no touched hook on ${event}`)
}

// Kiro's hooks are written by lich into the agent's config, so the suite runs
// the lines lich registers (docs/session-touched.md, Registration).
const COMMANDS = {
  claude: touchedCommand('hooks/hooks.json', 'PostToolUse'),
  codex: touchedCommand('hooks/codex-hooks.json', 'PostToolUse'),
  crush: touchedCommand('hooks/crush-hooks.json', 'PostToolUse').split('<lich-plugin>').join(SPACED_ROOT),
  'crush-pre': `"${SPACED_ROOT}/hooks/report-touched.sh"`,
  'antigravity-hold': touchedCommand('hooks.json', 'PostToolUse'),
  'antigravity-collect': touchedCommand('hooks.json', 'PreInvocation'),
  'kiro-hold': `"${SPACED_ROOT}/hooks/report-touched.sh" hold`,
  'kiro-collect': `"${SPACED_ROOT}/hooks/report-touched.sh" collect`,
}

/** Antigravity runs a hook with the plugin root as its working directory. */
function runScript(client, payload, env) {
  return new Promise((resolve) => {
    const child = spawn('/bin/sh', ['-c', COMMANDS[client]], {
      cwd: SPACED_ROOT,
      env: {
        ...BASE_ENV,
        ...(client.startsWith('antigravity') ? {} : { CLAUDE_PLUGIN_ROOT: SPACED_ROOT }),
        ...env,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c) => (stdout += c))
    child.stderr.on('data', (c) => (stderr += c))
    child.stdin.on('error', () => {})
    child.stdin.end(JSON.stringify(payload))
    child.on('close', (code) => settleStubs().then(() => resolve({ code, stdout, stderr })))
  })
}

async function withEnv(env, fn) {
  const saved = { ...process.env }
  for (const key of Object.keys(process.env)) if (key.startsWith('LICH_')) delete process.env[key]
  Object.assign(process.env, env)
  try {
    return await fn()
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]
    Object.assign(process.env, saved)
  }
}

/**
 * Runs one client on its payload and returns the note the model is handed, or
 * null when it is handed none. A shape the harness would not read fails here.
 */
async function delivered(client, payload, env) {
  if (client === 'opencode') {
    return withEnv(env, async () => {
      const hooks = await LichPlugin()
      const output = { title: 't', output: 'Wrote file successfully.', metadata: payload.metadata ?? {} }
      await hooks['tool.execute.after'](payload.input, output)
      if (output.output === 'Wrote file successfully.') return null
      assert.ok(output.output.startsWith('Wrote file successfully.\n\n'), 'the note goes after the tool output')
      return output.output.slice('Wrote file successfully.\n\n'.length)
    })
  }
  if (client === 'omp') {
    return withEnv(env, async () => {
      const handlers = new Map()
      lichPlugin({ on: (name, handler) => handlers.set(name, [...(handlers.get(name) ?? []), handler]) })
      const ctx = { sessionManager: { getSessionId: () => 'p1' } }
      const answers = await Promise.all((handlers.get('tool_result') ?? []).map((h) => h(payload, ctx)))
      const given = answers.filter((a) => a !== undefined)
      if (given.length === 0) return null
      assert.equal(given.length, 1)
      assert.deepEqual(Object.keys(given[0]), ['additionalContext'])
      return given[0].additionalContext
    })
  }
  const result = await runScript(client, payload, env)
  assert.equal(result.code, 0, `exited ${result.code}: ${result.stderr}`)
  const out = result.stdout
  switch (client) {
    case 'claude':
    case 'codex': {
      if (out === '') return null
      const json = JSON.parse(out)
      assert.deepEqual(json, { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: json.hookSpecificOutput.additionalContext } })
      return json.hookSpecificOutput.additionalContext
    }
    case 'crush': {
      if (out === '') return null
      const json = JSON.parse(out)
      assert.deepEqual(Object.keys(json).sort(), ['context', 'version'])
      assert.equal(json.version, 1)
      return json.context
    }
    case 'crush-pre':
    case 'kiro-hold':
      assert.equal(out, '', 'a touch that cannot show a note prints nothing')
      return null
    case 'antigravity-hold':
      assert.equal(out, '{}', 'Antigravity gets its verdict and nothing else')
      return null
    case 'antigravity-collect': {
      const json = JSON.parse(out)
      if (Object.keys(json).length === 0) return null
      assert.equal(json.injectSteps.length, 1)
      assert.deepEqual(Object.keys(json.injectSteps[0]), ['systemMessage'])
      return json.injectSteps[0].systemMessage.systemMessage
    }
    case 'kiro-collect':
      return out === '' ? null : out
  }
  throw new Error(`no client ${client}`)
}

const IN_PROCESS = new Set(['opencode', 'omp'])

/** The one touched request a stub got, held to the contract. */
function touchedRequest(client, stub) {
  const asked = stub.requests.filter((r) => r.url.split('?')[0] === ENDPOINT)
  assert.equal(asked.length, 1, `${client} reported ${asked.length} times`)
  const [request] = asked
  if (IN_PROCESS.has(client)) return assertContractHonoured(ENDPOINT, request).body
  assert.equal(request.url, ENDPOINT)
  assert.equal(request.headers.authorization, `Bearer ${TOKEN}`)
  return assertReportHonoured(ENDPOINT, request).body
}

// --------------------------------------------------------------- payloads --

const PATCH = '*** Begin Patch\n*** Add File: a.go\n+x\n*** Update File: sub/../b.go\n@@\n-x\n+y\n*** Move to: c.go\n*** Delete File: ./d.go\n*** End Patch'

/** One write per client, the body lich must get for it, and whether it can carry a note. */
const WRITES = [
  {
    client: 'claude',
    payload: { session_id: 'p1', cwd: '/repo', hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: '/repo/a.go', content: 'x' } },
    body: { session_id: LICH_SESSION_ID, paths: ['/repo/a.go'] },
  },
  {
    name: 'a Cursor CLI write, through the Claude Code install',
    client: 'claude',
    payload: {
      conversation_id: 'p1',
      session_id: 'p1',
      hook_event_name: 'postToolUse',
      tool_name: 'Write',
      tool_input: { file_path: '/repo/a.go', contents: 'x' },
      tool_use_id: 'call-1',
      cursor_version: '2026.11.22-e9042b2',
    },
    body: { session_id: LICH_SESSION_ID, paths: ['/repo/a.go'] },
  },
  {
    client: 'codex',
    payload: { session_id: 'p1', turn_id: 't1', cwd: '/repo', hook_event_name: 'PostToolUse', tool_name: 'apply_patch', tool_input: { command: PATCH }, tool_use_id: 'call_1' },
    body: { session_id: LICH_SESSION_ID, paths: ['/repo/a.go', '/repo/b.go', '/repo/c.go', '/repo/d.go'] },
  },
  {
    client: 'crush',
    payload: { event: 'PostToolUse', hook_event_name: 'PostToolUse', session_id: 'p1', cwd: '/repo', tool_name: 'edit', tool_input: { file_path: '/repo/a.go' }, tool_response: 'ok', tool_use_id: 'call_1' },
    body: { session_id: LICH_SESSION_ID, paths: ['/repo/a.go'] },
  },
  {
    client: 'opencode',
    payload: { input: { tool: 'write', sessionID: 'p1', callID: 'c1', args: { filePath: '/repo/a.go', content: 'x' } }, metadata: { filepath: '/repo/a.go' } },
    body: { session_id: LICH_SESSION_ID, paths: ['/repo/a.go'] },
  },
  {
    name: 'an opencode apply_patch',
    client: 'opencode',
    payload: {
      input: { tool: 'apply_patch', sessionID: 'p1', callID: 'c2', args: { patchText: PATCH } },
      metadata: { files: [{ filePath: '/repo/a.go', relativePath: 'a.go' }, { filePath: '/repo/b.go', relativePath: 'b.go' }] },
    },
    body: { session_id: LICH_SESSION_ID, paths: ['/repo/a.go', '/repo/b.go'] },
  },
  {
    client: 'omp',
    payload: { type: 'tool_result', toolCallId: 'c', toolName: 'write', input: { path: 'a.go' }, content: [], isError: false, details: { resolvedPath: '/repo/a.go' } },
    body: { session_id: LICH_SESSION_ID, paths: ['/repo/a.go'] },
  },
  {
    name: 'an oh-my-pi edit',
    client: 'omp',
    payload: { type: 'tool_result', toolCallId: 'c', toolName: 'edit', input: { path: 'a.go' }, content: [], isError: false, details: { op: 'update', path: '/repo/a.go' } },
    body: { session_id: LICH_SESSION_ID, paths: ['/repo/a.go'] },
  },
]

/** The writes whose hook cannot hand the model text: lich holds the note. */
const HELD = [
  {
    client: 'antigravity-hold',
    payload: { conversationId: 'p1', cwd: '/repo', hookEventName: 'PostToolUse', stepIdx: 4, toolCall: { id: 'call_1', name: 'edit_file', args: { Path: '/repo/a.go' } }, error: '' },
    body: { session_id: LICH_SESSION_ID, paths: ['/repo/a.go'], hold: true },
  },
  {
    client: 'kiro-hold',
    payload: { hook_event_name: 'postToolUse', cwd: '/repo', session_id: 'p1', tool_name: 'write', tool_input: { command: 'create', path: 'notes/./a.go', content: 'x' } },
    body: { session_id: LICH_SESSION_ID, paths: ['/repo/notes/a.go'], hold: true },
  },
]

/** The hooks that run before the next model call and collect what was held. */
const COLLECTS = [
  { client: 'antigravity-collect', payload: { conversationId: 'p1', cwd: '/repo', hookEventName: 'PreInvocation', stepIdx: 5 } },
  { client: 'kiro-collect', payload: { hook_event_name: 'userPromptSubmit', cwd: '/repo', session_id: 'p1', prompt: 'go on' } },
]

const label = (c) => c.name ?? `a ${c.client} write`
const noteAnswer = (note) => ({ status: 200, body: JSON.stringify({ note }) })

// ---------------------------------------------------------------- requests --

for (const w of [...WRITES, ...HELD]) {
  test(`${label(w)}: reports its files the way the contract spells them`, async () => {
    await withStub(async (stub) => {
      await delivered(w.client, w.payload, lichEnv(stub.port))
      assert.deepEqual(touchedRequest(w.client, stub), w.body)
    })
  })
}

for (const c of COLLECTS) {
  test(`${c.client}: asks for the held note and nothing else`, async () => {
    await withStub(async (stub) => {
      await delivered(c.client, c.payload, lichEnv(stub.port))
      assert.deepEqual(touchedRequest(c.client, stub), { session_id: LICH_SESSION_ID, collect: true })
    })
  })
}

// A shell names no file: the touch is the refresh alone, and it can still carry
// a note lich kept for the session (a held one, on a harness that cannot hold).
const SHELLS = [
  ['claude', { session_id: 'p1', cwd: '/repo', hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'make' } }],
  ['codex', { session_id: 'p1', cwd: '/repo', hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'make' } }],
  ['crush', { event: 'PostToolUse', hook_event_name: 'PostToolUse', session_id: 'p1', cwd: '/repo', tool_name: 'bash', tool_input: { command: 'make' } }],
  ['opencode', { input: { tool: 'bash', sessionID: 'p1', callID: 'c', args: { command: 'make' } } }],
  ['omp', { type: 'tool_result', toolCallId: 'c', toolName: 'bash', input: { command: 'make' }, content: [], isError: false, details: {} }],
]
for (const [client, payload] of SHELLS) {
  test(`${client}: a shell call is the refresh alone, with no paths`, async () => {
    await withStub(async (stub) => {
      await delivered(client, payload, lichEnv(stub.port))
      assert.deepEqual(touchedRequest(client, stub), { session_id: LICH_SESSION_ID })
    })
  })
}

test('Antigravity reports run_command as the refresh alone, held', async () => {
  await withStub(async (stub) => {
    const payload = { conversationId: 'p1', cwd: '/repo', hookEventName: 'PostToolUse', toolCall: { id: 'c', name: 'run_command', args: { CommandLine: 'make' } } }
    assert.equal(await delivered('antigravity-hold', payload, lichEnv(stub.port)), null)
    assert.deepEqual(touchedRequest('antigravity-hold', stub), { session_id: LICH_SESSION_ID, hold: true })
  })
})

// On a Crush older than v0.99.0 lich keeps the hook on PreToolUse: before the
// write, so it stays the refresh it was, with no paths and nothing printed.
test('a Crush PreToolUse touch is the refresh alone and prints nothing', async () => {
  await withStub(
    async (stub) => {
      const payload = { event: 'PreToolUse', hook_event_name: 'PreToolUse', session_id: 'p1', cwd: '/repo', tool_name: 'edit', tool_input: { file_path: '/repo/a.go' } }
      assert.equal(await delivered('crush-pre', payload, lichEnv(stub.port)), null)
      assert.deepEqual(touchedRequest('crush-pre', stub), { session_id: LICH_SESSION_ID })
    },
    noteAnswer(NOTE),
  )
})

// ------------------------------------------------------------------- notes --

// Every note lich's fixture answers with, plus one in another script with a
// quote and a trailing newline, reaches the model as written.
const ALL_NOTES = [...NOTES, 'A sessão lich "Ação" também editou /repo/a.go.\n']

for (const c of [...WRITES, ...COLLECTS]) {
  test(`${label(c)}: hands the model every note lich answers with, byte for byte`, async () => {
    for (const note of ALL_NOTES) {
      await withStub(async (stub) => {
        assert.equal(await delivered(c.client, c.payload, lichEnv(stub.port)), note)
      }, noteAnswer(note))
    }
  })

  test(`${label(c)}: a 204 hands the model nothing`, async () => {
    await withStub(async (stub) => {
      assert.equal(await delivered(c.client, c.payload, lichEnv(stub.port)), null)
    })
  })
}

for (const h of HELD) {
  test(`${label(h)}: a held touch shows nothing, whatever lich answers`, async () => {
    await withStub(async (stub) => {
      assert.equal(await delivered(h.client, h.payload, lichEnv(stub.port)), null)
    }, noteAnswer(NOTE))
  })
}

// --------------------------------------------------------------- fail open --

const FAILURES = [
  ['a 500', { status: 500, body: JSON.stringify({ note: NOTE }) }],
  ['a 200 that is not JSON', { status: 200, body: 'note' }],
  ['a 200 with no note', { status: 200, body: '{}' }],
  ['a 200 with an empty note', { status: 200, body: '{"note":""}' }],
]

for (const c of [...WRITES, ...COLLECTS]) {
  test(`${label(c)}: outside lich nothing is reported and nothing shown`, async () => {
    await withStub(async (stub) => {
      assert.equal(await delivered(c.client, c.payload, {}), null)
      assert.equal(stub.requests.length, 0)
    })
  })

  test(`${label(c)}: a refused connection shows nothing`, async () => {
    const stub = await startStub()
    const env = lichEnv(stub.port)
    await stub.close()
    assert.equal(await delivered(c.client, c.payload, env), null)
  })

  for (const [what, answer] of FAILURES) {
    test(`${label(c)}: ${what} shows nothing`, async () => {
      await withStub(async (stub) => {
        assert.equal(await delivered(c.client, c.payload, lichEnv(stub.port)), null)
      }, answer)
    })
  }
}
