// Pins the subagent veto to lich's subagent-cards contract: the body each
// harness's client sends /subagent for its own subagent call, the veto each
// turns lich's deny into, with the reason untouched, and the allow every other
// outcome is. The script harnesses run hooks/veto-subagent.sh as their own
// registration spells it; opencode and omp run their modules in process.
//
// The answers are lich's own, replayed from subagent-cards.jsonl. The request
// payloads are the provider's, written here from the contract's table (Event →
// veto mapping): lich measured those names, and this suite holds the clients to
// them, not to a real run.
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

const ENDPOINT = '/subagent'
const FIXTURES = CASES[ENDPOINT]

// ----------------------------------------------------------------- clients --

const BASE_ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('LICH_')))
const TMP = mkdtempSync(path.join(tmpdir(), 'lich-plugin-veto-'))
const SPACED_ROOT = path.join(TMP, 'Application Support')
symlinkSync(ROOT, SPACED_ROOT)

const read = (file) => JSON.parse(readFileSync(path.join(ROOT, file), 'utf8'))
const groupsOf = (json, event) => (json.hooks ?? json.lich)[event]
const hooksIn = (group) => (Array.isArray(group.hooks) ? group.hooks : [group])

/** The registered veto entry of a hook file, with its matcher. */
function vetoEntry(file) {
  for (const group of groupsOf(read(file), 'PreToolUse')) {
    for (const hook of hooksIn(group)) {
      if (hook.command.includes('veto-subagent.sh')) return { matcher: group.matcher, ...hook }
    }
  }
  assert.fail(`${file} registers no subagent veto`)
}

// Kiro's hooks are written by lich into the agent's config, so the suite runs
// the line lich is told to register (docs/subagent-cards.md, Registration lich writes).
const COMMANDS = {
  claude: vetoEntry('hooks/hooks.json').command,
  codex: vetoEntry('hooks/codex-hooks.json').command,
  antigravity: vetoEntry('hooks.json').command,
  crush: vetoEntry('hooks/crush-hooks.json').command.split('<lich-plugin>').join(SPACED_ROOT),
  kiro: `"${SPACED_ROOT}/hooks/veto-subagent.sh" kiro`,
}

/** Antigravity runs a hook with the plugin root as its working directory. */
function runScript(harness, payload, env) {
  return new Promise((resolve) => {
    const child = spawn('/bin/sh', ['-c', COMMANDS[harness]], {
      cwd: SPACED_ROOT,
      env: {
        ...BASE_ENV,
        TMPDIR: mkdtempSync(path.join(TMP, 'run-')),
        ...(harness === 'antigravity' ? {} : { CLAUDE_PLUGIN_ROOT: SPACED_ROOT }),
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

/**
 * Runs one harness's client on its own payload and says what the call became:
 * `{ veto: reason }` when it was refused with lich's text, `{ allow: true }`
 * when it runs. Anything else (a veto in the wrong shape, output on allow, a
 * crash) fails here, so every caller only has to compare outcomes.
 */
async function outcome(harness, payload, env) {
  if (harness === 'opencode') return opencodeOutcome(payload, env)
  if (harness === 'omp') return ompOutcome(payload, env)
  const result = await runScript(harness, payload, env)
  if (harness === 'kiro' || harness === 'crush') {
    assert.equal(result.stdout, '', 'a veto by exit code says nothing on stdout')
    if (result.code === 2) return { veto: result.stderr }
    assert.equal(result.code, 0, `exited ${result.code}: ${result.stderr}`)
    assert.equal(result.stderr, '', 'an allowed call writes nothing')
    return { allow: true }
  }
  assert.equal(result.code, 0, `exited ${result.code}: ${result.stderr}`)
  if (harness === 'antigravity') {
    const verdict = JSON.parse(result.stdout)
    if (verdict.decision === 'allow') {
      assert.deepEqual(verdict, { decision: 'allow' })
      return { allow: true }
    }
    assert.deepEqual(Object.keys(verdict).sort(), ['decision', 'reason'])
    assert.equal(verdict.decision, 'deny')
    return { veto: verdict.reason }
  }
  if (result.stdout === '') return { allow: true }
  const out = JSON.parse(result.stdout)
  assert.deepEqual(Object.keys(out), ['hookSpecificOutput'])
  const { hookEventName, permissionDecision, permissionDecisionReason } = out.hookSpecificOutput
  assert.deepEqual(Object.keys(out.hookSpecificOutput).sort(), ['hookEventName', 'permissionDecision', 'permissionDecisionReason'])
  assert.equal(hookEventName, 'PreToolUse')
  assert.equal(permissionDecision, 'deny')
  return { veto: permissionDecisionReason }
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

/** opencode refuses a call by the hook throwing; the model reads the message. */
async function opencodeOutcome({ input, args, subSession }, env) {
  return withEnv(env, async () => {
    const hooks = await LichPlugin()
    if (subSession) await hooks.event({ event: { type: 'session.created', properties: { info: { id: input.sessionID, parentID: 'root' } } } })
    try {
      await hooks['tool.execute.before'](input, { args })
      return { allow: true }
    } catch (error) {
      assert.ok(error instanceof Error)
      return { veto: error.message }
    }
  })
}

/** omp refuses a call by the tool_call handler returning `{block, reason}`. */
async function ompOutcome({ event, sessionId }, env) {
  return withEnv(env, async () => {
    const handlers = new Map()
    lichPlugin({ on: (name, handler) => handlers.set(name, [...(handlers.get(name) ?? []), handler]) })
    const ctx = { sessionManager: { getSessionId: () => sessionId } }
    const answers = await Promise.all((handlers.get('tool_call') ?? []).map((h) => h(event, ctx)))
    const blocks = answers.filter((a) => a !== undefined)
    if (blocks.length === 0) return { allow: true }
    assert.equal(blocks.length, 1)
    assert.deepEqual(Object.keys(blocks[0]).sort(), ['block', 'reason'])
    assert.equal(blocks[0].block, true)
    return { veto: blocks[0].reason }
  })
}

const IN_PROCESS = new Set(['opencode', 'omp'])

/** The /subagent request among a stub's requests, held to the contract. */
function subagentRequest(harness, stub) {
  const asked = stub.requests.filter((r) => r.url.split('?')[0] === ENDPOINT)
  assert.equal(asked.length, 1, `${harness} asked lich ${asked.length} times`)
  const [request] = asked
  // A script's token rides a header, as every report script's does; a module
  // is handed no process command line, so it keeps `?token=`.
  if (IN_PROCESS.has(harness)) return assertContractHonoured(ENDPOINT, request).body
  assert.equal(request.url, ENDPOINT)
  assert.equal(request.headers.authorization, `Bearer ${TOKEN}`)
  return assertReportHonoured(ENDPOINT, request).body
}

// --------------------------------------------------------------- payloads --

const FIX = 'Fix #412: the relay handshake races on reconnect.'
const DENY = FIXTURES.find((c) => c.answer?.decision === 'deny').answer

/** A body as the contract spells it, for the fields a call leaves at default. */
const body = (fields) => ({
  session_id: LICH_SESSION_ID,
  provider_session_id: 'p1',
  nested: false,
  call: 'spawn',
  tool_use_id: '',
  model: '',
  sealed: false,
  isolation: '',
  background: false,
  ...fields,
})

/**
 * One call per harness and shape the contract's table names, the payload the
 * provider hands its hook, and the body lich must receive for it.
 */
const CALLS = [
  {
    name: 'a Claude Code Agent call, every field set',
    harness: 'claude',
    payload: {
      session_id: 'p1',
      tool_name: 'Agent',
      tool_use_id: 'toolu_1',
      tool_input: {
        description: 'Fix the handshake race',
        prompt: FIX,
        subagent_type: 'general-purpose',
        model: 'opus',
        isolation: 'worktree',
        run_in_background: true,
      },
    },
    body: body({
      tool: 'Agent',
      tool_use_id: 'toolu_1',
      tasks: [{ title: 'Fix the handshake race', prompt: FIX, type: 'general-purpose' }],
      model: 'opus',
      isolation: 'worktree',
      background: true,
    }),
  },
  {
    name: 'a Claude Code Agent call from inside a native subagent',
    harness: 'claude',
    payload: { session_id: 'p1', agent_id: 'a1', tool_name: 'Agent', tool_use_id: 'toolu_2', tool_input: { description: 'd', prompt: FIX } },
    body: body({ nested: true, tool: 'Agent', tool_use_id: 'toolu_2', tasks: [{ title: 'd', prompt: FIX, type: '' }] }),
  },
  {
    name: "a Cursor CLI Task call, through the Claude Code install's hook",
    harness: 'claude',
    payload: { session_id: 'p1', tool_name: 'Task', tool_input: { description: 'Map it', prompt: 'Map the relay package.', subagent_type: 'explore' } },
    body: body({ tool: 'Task', tasks: [{ title: 'Map it', prompt: 'Map the relay package.', type: 'explore' }] }),
  },
  {
    name: 'a Codex v1 spawn_agent call',
    harness: 'codex',
    payload: { session_id: 'p1', tool_name: 'spawn_agent', tool_use_id: 'exec-1', tool_input: { message: FIX, agent_type: 'worker' } },
    body: body({ tool: 'spawn_agent', tool_use_id: 'exec-1', tasks: [{ title: '', prompt: FIX, type: 'worker' }] }),
  },
  {
    name: 'a Codex v2 spawn, its message encrypted',
    harness: 'codex',
    payload: { session_id: 'p1', tool_name: 'collaborationspawn_agent', tool_use_id: 'exec-2', tool_input: { task_name: 'fix_handshake', message: 'gAAAAABo-ciphertext' } },
    body: body({ tool: 'collaborationspawn_agent', tool_use_id: 'exec-2', sealed: true, tasks: [{ title: 'fix_handshake', prompt: '', type: '' }] }),
  },
  {
    name: 'a Codex v2 wait',
    harness: 'codex',
    payload: { session_id: 'p1', tool_name: 'collaborationwait_agent', tool_use_id: 'exec-3', tool_input: { targets: ['fix_handshake'] } },
    body: body({ call: 'wait', tool: 'collaborationwait_agent', tool_use_id: 'exec-3', tasks: [] }),
  },
  {
    name: 'an Antigravity invoke_subagent call',
    harness: 'antigravity',
    payload: { conversationId: 'p1', toolCall: { name: 'invoke_subagent', args: { Prompt: FIX, TypeName: 'general' } } },
    body: body({ tool: 'invoke_subagent', tasks: [{ title: '', prompt: FIX, type: 'general' }] }),
  },
  {
    name: 'a Kiro CLI subagent call (ACP)',
    harness: 'kiro',
    payload: { session_id: 'p1', tool_name: 'subagent', tool_input: { task: FIX, stages: [{ name: 'Fix it' }, { name: 'Review' }] } },
    body: body({ tool: 'subagent', tasks: [{ title: 'Fix it', prompt: FIX, type: '' }] }),
  },
  {
    name: 'a Kiro CLI use_subagent call starting two subagents',
    harness: 'kiro',
    payload: {
      session_id: 'p1',
      tool_name: 'use_subagent',
      tool_input: { command: 'InvokeSubagents', content: { subagents: [{ query: 'Map the relay package.' }, { query: 'Fix #412.' }] } },
    },
    body: body({
      tool: 'use_subagent',
      tasks: [
        { title: '', prompt: 'Map the relay package.', type: '' },
        { title: '', prompt: 'Fix #412.', type: '' },
      ],
    }),
  },
  {
    name: 'a Crush agent call',
    harness: 'crush',
    payload: { session_id: 'p1', tool_name: 'agent', tool_input: { prompt: 'Map the relay package.' } },
    body: body({ tool: 'agent', tasks: [{ title: '', prompt: 'Map the relay package.', type: '' }] }),
  },
  {
    name: 'an opencode task call',
    harness: 'opencode',
    payload: {
      input: { tool: 'task', sessionID: 'p1', callID: 'call_1' },
      args: { description: 'Map it', prompt: 'Map the relay package.', subagent_type: 'general' },
    },
    body: body({ tool: 'task', tool_use_id: 'call_1', tasks: [{ title: 'Map it', prompt: 'Map the relay package.', type: 'general' }] }),
  },
  {
    name: "an opencode task call from a sub-session",
    harness: 'opencode',
    payload: {
      input: { tool: 'task', sessionID: 'child', callID: 'call_2' },
      args: { description: 'Map it', prompt: 'Map the relay package.', subagent_type: 'general' },
      subSession: true,
    },
    body: body({
      provider_session_id: 'child',
      nested: true,
      tool: 'task',
      tool_use_id: 'call_2',
      tasks: [{ title: 'Map it', prompt: 'Map the relay package.', type: 'general' }],
    }),
  },
  {
    name: 'an oh-my-pi task call with two tasks and a shared context',
    harness: 'omp',
    payload: {
      sessionId: 'p1',
      event: {
        type: 'tool_call',
        toolCallId: 'toolu_1',
        toolName: 'task',
        input: {
          context: 'The relay is in internal/relay.',
          tasks: [
            { name: 'scan', task: 'Map the relay package.', agent: 'scout' },
            { name: 'fix', task: 'Fix #412.', agent: 'task' },
          ],
        },
      },
    },
    body: body({
      tool: 'task',
      tool_use_id: 'toolu_1',
      tasks: [
        { title: 'scan', prompt: 'The relay is in internal/relay.\n\nMap the relay package.', type: 'scout' },
        { title: 'fix', prompt: 'The relay is in internal/relay.\n\nFix #412.', type: 'task' },
      ],
    }),
  },
]

const HARNESSES = [...new Set(CALLS.map((c) => c.harness))]
const callOf = (harness) => CALLS.find((c) => c.harness === harness)

// ---------------------------------------------------------------- requests --

for (const call of CALLS) {
  test(`${call.name}: asks lich with the contract's body`, async () => {
    await withStub(
      async (stub) => {
        await outcome(call.harness, call.payload, lichEnv(stub.port))
        assert.deepEqual(subagentRequest(call.harness, stub), call.body)
      },
      { status: 200, body: JSON.stringify({ decision: 'allow' }) },
    )
  })
}

// Calls that start no subagent, or one lich would refuse for want of a prompt,
// are left native without a request: lich's 400 would be an allow anyway.
const NOT_ASKED = [
  ['claude', { session_id: 'p1', tool_name: 'Bash', tool_input: { command: 'ls' } }],
  ['claude', { session_id: 'p1', tool_name: 'Agent', tool_input: { description: 'd', prompt: '   ' } }],
  ['codex', { session_id: 'p1', tool_name: 'shell', tool_input: { command: ['ls'] } }],
  ['codex', { session_id: 'p1', tool_name: 'spawn_agent', tool_input: {} }],
  ['antigravity', { conversationId: 'p1', toolCall: { name: 'run_command', args: { CommandLine: 'ls' } } }],
  ['kiro', { session_id: 'p1', tool_name: 'use_subagent', tool_input: { command: 'ListAgents' } }],
  ['kiro', { session_id: 'p1', tool_name: 'use_subagent', tool_input: { command: 'InvokeSubagents', content: { subagents: [] } } }],
  ['crush', { session_id: 'p1', tool_name: 'bash', tool_input: { command: 'ls' } }],
  ['opencode', { input: { tool: 'bash', sessionID: 'p1', callID: 'c' }, args: { command: 'ls' } }],
  ['opencode', { input: { tool: 'task', sessionID: 'p1', callID: 'c' }, args: { description: 'd', prompt: '' } }],
  ['omp', { sessionId: 'p1', event: { type: 'tool_call', toolCallId: 'c', toolName: 'bash', input: { command: 'ls' } } }],
  ['omp', { sessionId: 'p1', event: { type: 'tool_call', toolCallId: 'c', toolName: 'task', input: { tasks: [] } } }],
]

for (const [harness, payload] of NOT_ASKED) {
  const tool = payload.tool_name ?? payload.toolCall?.name ?? payload.input?.tool ?? payload.event?.toolName
  test(`${harness}: a ${tool} call that starts no subagent lich would take is not asked about`, async () => {
    await withStub(
      async (stub) => {
        assert.deepEqual(await outcome(harness, payload, lichEnv(stub.port)), { allow: true })
        assert.deepEqual(
          stub.requests.filter((r) => r.url.split('?')[0] === ENDPOINT),
          [],
        )
      },
      { status: 200, body: JSON.stringify(DENY) },
    )
  })
}

// ------------------------------------------------------------------ vetoes --

// Every answer lich's fixture gives, replayed for every harness, plus a reason
// in another script and with a newline, since lich writes it in the session's
// prompt language: a deny reaches the model as that harness's own veto with
// the reason byte for byte, and an allow lets the call run.
const ANSWERS = [
  ...new Map(FIXTURES.filter((c) => c.answer).map((c) => [JSON.stringify(c.answer), c.answer])).values(),
  { decision: 'deny', reason: 'lich abriu esta tarefa como a sessão "Ação" (ticket 4b9bc94e).\nNão repita a ferramenta.', sessions: [] },
]

for (const harness of HARNESSES) {
  test(`${harness}: every answer lich gives becomes the harness's own veto, or lets the call run`, async () => {
    for (const answer of ANSWERS) {
      await withStub(
        async (stub) => {
          const got = await outcome(harness, callOf(harness).payload, lichEnv(stub.port))
          assert.deepEqual(got, answer.decision === 'deny' ? { veto: answer.reason } : { allow: true }, JSON.stringify(answer))
        },
        { status: 200, body: JSON.stringify(answer) },
      )
    }
  })
}

// --------------------------------------------------------------- fail open --

const FAILURES = [
  ['a status other than 200', { status: 500, body: JSON.stringify(DENY) }],
  ['a 400', { status: 400, body: '{"error":"tool is required"}' }],
  ['a body that is not JSON', { status: 200, body: 'deny' }],
  ['a deny with no reason', { status: 200, body: '{"decision":"deny"}' }],
  ['a decision lich does not send', { status: 200, body: '{"decision":"maybe","reason":"x"}' }],
]

for (const harness of HARNESSES) {
  test(`${harness}: outside lich the call runs and nothing is asked`, async () => {
    await withStub(async (stub) => {
      assert.deepEqual(await outcome(harness, callOf(harness).payload, {}), { allow: true })
      assert.equal(stub.requests.length, 0)
    })
  })

  test(`${harness}: lich refusing the connection lets the call run`, async () => {
    const stub = await startStub()
    const env = lichEnv(stub.port)
    await stub.close()
    assert.deepEqual(await outcome(harness, callOf(harness).payload, env), { allow: true })
  })

  for (const [what, answer] of FAILURES) {
    test(`${harness}: ${what} lets the call run`, async () => {
      await withStub(async (stub) => {
        assert.deepEqual(await outcome(harness, callOf(harness).payload, lichEnv(stub.port)), { allow: true })
      }, answer)
    })
  }
}

// lich closes what it opened when nobody read its answer, so a client that gave
// up lets the call run. 10 seconds is the contract's wait; one client of each
// kind waits it out, side by side.
test('a lich that never answers lets the call run after the 10 seconds the contract waits', async () => {
  // One stub and one environment for all three: the two in-process clients
  // read process.env, which the outer withEnv holds steady while they run.
  const stub = await startStub({ hang: true })
  const env = lichEnv(stub.port)
  try {
    const waited = await withEnv(env, () =>
      Promise.all(
        ['claude', 'opencode', 'omp'].map(async (harness) => {
          const started = Date.now()
          assert.deepEqual(await outcome(harness, callOf(harness).payload, env), { allow: true })
          return [harness, Date.now() - started]
        }),
      ),
    )
    // A script's run also waits for the stub to have read every connection
    // (settleStubs), the in-process clients' included, so its ceiling is looser.
    for (const [harness, ms] of waited) {
      assert.ok(ms >= 9500 && ms < 20000, `${harness} gave up after ${ms} ms`)
    }
  } finally {
    await stub.close()
  }
})

// Without jq the script has nothing safe to build a body or read an answer
// with, so it asks nothing and the call runs. Antigravity still gets its
// verdict.
test('without jq the script asks nothing and the call runs', async () => {
  const bin = mkdtempSync(path.join(TMP, 'bin-'))
  for (const tool of ['sh', 'cat', 'curl', 'sed', 'tail', 'dirname', 'grep', 'head', 'printf']) {
    const found = await new Promise((resolve) => {
      const which = spawn('/bin/sh', ['-c', `command -v ${tool}`])
      let out = ''
      which.stdout.on('data', (c) => (out += c))
      which.on('close', () => resolve(out.trim()))
    })
    if (found.startsWith('/')) symlinkSync(found, path.join(bin, tool))
  }
  for (const harness of ['claude', 'antigravity', 'kiro']) {
    await withStub(
      async (stub) => {
        const env = { ...lichEnv(stub.port), PATH: bin }
        assert.deepEqual(await outcome(harness, callOf(harness).payload, env), { allow: true })
        // Antigravity's command runs the tool report too, which has a sed
        // fallback of its own.
        assert.equal(stub.requests.filter((r) => r.url.split('?')[0] === ENDPOINT).length, 0)
      },
      { status: 200, body: JSON.stringify(DENY) },
    )
  }
})

// ----------------------------------------------------------- registrations --

// The tool names each registration's matcher lets through are the contract's
// table, and nothing else reaches the veto: a matcher that names a tool the
// harness does not call vetoes nothing, quietly. Antigravity's entry matches
// every tool, because its veto shares the tool report's command (one verdict
// per call), and the script itself answers allow for any other tool.
test("each registration's matcher names the contract's subagent tools", () => {
  assert.equal(vetoEntry('hooks/hooks.json').matcher, 'Agent|Task')
  assert.equal(vetoEntry('hooks/codex-hooks.json').matcher, 'spawn_agent|collaborationspawn_agent|collaborationwait_agent')
  assert.equal(vetoEntry('hooks/crush-hooks.json').matcher, '^agent$')
  assert.equal(vetoEntry('hooks.json').matcher, '')
})

// The hook waits 10 seconds for lich; a harness that kills it first lets the
// call run while lich may still open a card for it.
test('every registration gives the veto longer than the 10 seconds it waits', () => {
  for (const file of ['hooks/hooks.json', 'hooks/codex-hooks.json', 'hooks/crush-hooks.json', 'hooks.json']) {
    assert.ok(vetoEntry(file).timeout > 10, `${file} kills the veto at ${vetoEntry(file).timeout}s`)
  }
})

// ---------------------------------------------------------------- fixtures --

test('every body lich accepts passes the contract helper, and no rejected one does', () => {
  for (const c of FIXTURES) {
    if (c.accept) assertReportHonoured(ENDPOINT, fakeRequest(JSON.stringify(c.body)))
    if (c.reject) {
      assert.throws(() => assertReportHonoured(ENDPOINT, fakeRequest(c.raw ?? JSON.stringify(c.body))), undefined, c.name)
    }
  }
})

function fakeRequest(raw) {
  return {
    method: 'POST',
    url: ENDPOINT,
    headers: { 'content-type': 'application/json', 'x-lich-plugin': JSON.parse(readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version },
    raw,
  }
}
