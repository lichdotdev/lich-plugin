// Pins the opencode 2 half of the opencode client to lich's contract fixtures.
//
// opencode 2 loads the module's default export and calls its `setup(ctx)`; the
// suite hands it a context shaped like the one 2.2.5 gave a probe plugin: an
// event stream, a session lookup and tool hooks. The event payloads below were
// taken off that probe, run under `opencode run --standalone`.
//
// Run: node --test tests/

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { LICH_SESSION_ID, assertContractHonoured, lichEnv, withStub } from './contract.mjs'
import plugin from '../opencode/lich.js'

const ROOT_ID = 'ses_e67b89040ffelmwfAueGYutmsk'
const SUB_ID = 'ses_e67b3f580ffeuy1o0SSz7FVSim'

/** An event as 2.2.5 put it on the stream. */
const event = (type, data) => ({ id: 'evt_1', created: 1793556181377, type, data })

/**
 * A 2.x context over a fixed list of events, plus the two tool hooks the module
 * registers, which `call` fires the way the server would.
 */
function fakeContext(events, { parents = { [SUB_ID]: ROOT_ID } } = {}) {
  const hooks = {}
  const ctx = {
    app: { version: '2.2.5' },
    session: {
      get: async ({ sessionID }) =>
        parents[sessionID] ? { id: sessionID, parentID: parents[sessionID] } : { id: sessionID },
    },
    tool: { hook: async (name, fn) => (hooks[name] = fn) },
    event: {
      subscribe: async function* ({ signal }) {
        for (const e of events) yield e
        await new Promise((resolve) => signal.addEventListener('abort', resolve))
      },
    },
  }
  return { ctx, call: (name, payload) => hooks[name]?.(payload) }
}

async function reportsFor(events, { expected = 1, drive = () => {} } = {}) {
  return withStub(async (stub) => {
    const previous = { ...process.env }
    Object.assign(process.env, lichEnv(stub.port))
    let stop
    try {
      const { ctx, call } = fakeContext(events)
      stop = await plugin.setup(ctx)
      await drive(call)
      const deadline = Date.now() + 2000
      while (stub.requests.length < expected && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 10))
      }
      await new Promise((r) => setTimeout(r, 60))
    } finally {
      stop?.()
      for (const key of ['LICH_PORT', 'LICH_TOKEN', 'LICH_SESSION_ID']) delete process.env[key]
      Object.assign(process.env, previous)
    }
    return stub.requests
  })
}

const only = (requests, endpoint) => requests.filter((r) => r.url.startsWith(endpoint + '?'))

test('a run starting reports the session id once, then busy', async () => {
  const started = event('session.execution.started', { sessionID: ROOT_ID })
  const requests = await reportsFor([started, started], { expected: 3 })
  const starts = only(requests, '/session-start')
  assert.equal(starts.length, 1, 'the second prompt of a conversation is not a new session')
  const { body } = assertContractHonoured('/session-start', starts[0])
  assert.equal(body.session_id, LICH_SESSION_ID)
  assert.equal(body.provider, 'opencode')
  assert.equal(body.provider_session_id, ROOT_ID)
  const states = only(requests, '/hook').map((r) => assertContractHonoured('/hook', r).body)
  assert.deepEqual(states.map((b) => b.state), ['busy', 'busy'])
  assert.equal(states[0].provider_session_id, ROOT_ID)
})

for (const word of ['succeeded', 'failed', 'interrupted']) {
  test(`a run that ${word} reports done`, async () => {
    const requests = await reportsFor([event(`session.execution.${word}`, { sessionID: ROOT_ID })])
    const { body } = assertContractHonoured('/hook', requests[0])
    assert.equal(body.state, 'done')
  })
}

test('a rename is the card title', async () => {
  const requests = await reportsFor([
    event('session.renamed', { sessionID: ROOT_ID, title: 'Removing b.txt file' }),
    event('session.renamed', { sessionID: ROOT_ID, title: '  ' }),
  ])
  assert.equal(requests.length, 1)
  assert.equal(assertContractHonoured('/session-title', requests[0]).body.title, 'Removing b.txt file')
})

test('a permission prompt reports waiting and the action it asks for', async () => {
  const requests = await reportsFor([
    event('permission.asked', {
      id: 'per_1984858ad001w48hf9PrTwB53d',
      sessionID: ROOT_ID,
      action: 'shell',
      resources: ['ls'],
      save: ['ls *'],
    }),
  ])
  const { body } = assertContractHonoured('/hook', requests[0])
  assert.equal(body.state, 'waiting')
  assert.equal(body.reason, 'shell')
})

test('a tool call names the tool and what it acts on', async () => {
  const requests = await reportsFor([], {
    drive: (call) =>
      call('execute.before', { tool: 'shell', sessionID: ROOT_ID, agent: 'build', input: { command: 'ls' } }),
  })
  const { body } = assertContractHonoured('/hook', requests[0])
  assert.deepEqual([body.state, body.tool, body.detail], ['busy', 'shell', 'ls'])
})

test('a finished write refreshes the git status, a read does not', async () => {
  const requests = await reportsFor([], {
    drive: (call) => {
      call('execute.after', { tool: 'read', sessionID: ROOT_ID, input: { path: 'a.txt' }, status: 'completed' })
      call('execute.after', { tool: 'write', sessionID: ROOT_ID, input: { path: 'b.txt' }, status: 'error' })
      call('execute.after', { tool: 'write', sessionID: ROOT_ID, input: { path: 'b.txt' }, status: 'completed' })
    },
  })
  assert.equal(requests.length, 1)
  assertContractHonoured('/session-touched', requests[0])
})

test('a sub-session reports nothing for the card', async () => {
  const requests = await reportsFor(
    [
      event('session.execution.started', { sessionID: SUB_ID }),
      event('session.renamed', { sessionID: SUB_ID, title: 'Run ls and report' }),
      event('session.execution.succeeded', { sessionID: SUB_ID }),
    ],
    {
      expected: 0,
      drive: (call) => call('execute.before', { tool: 'shell', sessionID: SUB_ID, input: { command: 'ls' } }),
    },
  )
  assert.equal(requests.length, 0, `a sub-session reached lich: ${requests[0]?.raw}`)
})

test('events with no session, or of no interest, are ignored', async () => {
  const requests = await reportsFor(
    [
      event('session.text.delta', { sessionID: ROOT_ID, delta: 'hi' }),
      event('shell.exited', { id: 'sh_1', exit: 0 }),
      event('session.execution.started', {}),
      { type: 42 },
      null,
    ],
    { expected: 0 },
  )
  assert.equal(requests.length, 0)
})

// 1.x calls `setup()` too, with a context that has neither an event stream nor
// a session lookup (1.18.23 and 1.19.4); 2.x outside lich has both but no lich.
test('setup subscribes to nothing under 1.x or outside lich', async () => {
  const v1ctx = { options: {}, agent: {}, command: {}, plugin: {} }
  assert.equal(await plugin.setup(v1ctx), undefined)
  const previous = { ...process.env }
  for (const key of Object.keys(process.env)) if (key.startsWith('LICH_')) delete process.env[key]
  try {
    let subscribed = false
    const { ctx } = fakeContext([])
    ctx.event.subscribe = () => {
      subscribed = true
      return [][Symbol.iterator]()
    }
    assert.equal(await plugin.setup(ctx), undefined)
    assert.equal(subscribed, false)
  } finally {
    Object.assign(process.env, previous)
  }
})

test('the default export is the 2.x plugin and still the 1.x one through server()', async () => {
  assert.equal(plugin.id, 'lich')
  assert.equal(typeof plugin.setup, 'function')
  const previous = { ...process.env }
  for (const key of Object.keys(process.env)) if (key.startsWith('LICH_')) delete process.env[key]
  try {
    const hooks = await plugin.server({ $: () => {}, directory: '/w' })
    assert.equal(typeof hooks.event, 'function')
    assert.equal(typeof hooks['tool.execute.before'], 'function')
  } finally {
    Object.assign(process.env, previous)
  }
})
