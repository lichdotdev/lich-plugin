// lich's contract fixtures, and the assertions both clients answer to.
//
// lich owns the endpoints; this repository owns the two clients that build the
// payloads — the hook scripts (Claude Code, Codex, Crush) and the opencode
// module. The fixtures in tests/fixtures/ are lich's, vendored verbatim
// (tests/refresh-fixtures.sh); they are upstream truth and are never edited to
// make a run green.
//
// Everything here is shared by hooks.test.mjs and opencode.test.mjs so both
// clients are held to the same lines.

import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { connect } from 'node:net'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

export const ROOT = path.resolve(HERE, '..')
export const TOKEN = 'test-token'
export const LICH_SESSION_ID = 'lich-session-1'

// The release the manifests name. Every script and module carries its own copy
// of it, and the header assertion below is what keeps those copies in step.
export const PLUGIN_VERSION = JSON.parse(
  readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8'),
).version

// ---------------------------------------------------------------- fixtures --

/** endpoint → fixture file, per lich's docs/hooks/fixtures/README.md. */
export const FIXTURE_OF = {
  '/hook': 'session-state',
  '/session-start': 'session-start',
  '/session-title': 'session-title',
  '/session-touched': 'session-touched',
  '/subagent': 'subagent-cards',
}

const readFixture = (name) =>
  readFileSync(path.join(HERE, 'fixtures', `${name}.jsonl`), 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line))

export const CASES = Object.fromEntries(
  Object.entries(FIXTURE_OF).map(([endpoint, file]) => [endpoint, readFixture(file)]),
)

export const accepted = (endpoint) => CASES[endpoint].filter((c) => c.accept)
export const rejected = (endpoint) => CASES[endpoint].filter((c) => c.reject)

// Enumerations come from the fixtures, not from a copy of them kept here: a
// state or a provider that lich stops accepting stops being accepted below too.
export const STATES = new Set(accepted('/hook').map((c) => c.accept.state))
export const PROVIDERS = new Set(accepted('/session-start').map((c) => c.accept.provider))
export const SUBAGENT_CALLS = new Set(accepted('/subagent').map((c) => c.body.call).filter(Boolean))

/**
 * Providers this plugin already reports for, and lich does not accept yet.
 *
 * A contract moves in lich first — prose, then fixtures, then the endpoint —
 * and only then here, so a client that lands ahead of its endpoint is declared
 * here rather than smuggled in by editing a fixture. lich answers 400 to a
 * provider it has not registered, so what this set really records is a report
 * that does not arrive yet; the plugin side is still held to every other line.
 *
 * Emptying it is the last step of adding a provider, not an optional one: the
 * suites fail the moment a refreshed fixture registers one, so the marker
 * cannot outlive the gap it names. Antigravity was the first entry and is gone
 * from it — lich registered the provider, `refresh-fixtures.sh` brought the
 * fixture down, and the enumerations went back to coming from the fixtures
 * alone. Empty is the resting state.
 */
export const PENDING_UPSTREAM = new Set([])

export const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
export const blank = (v) => typeof v !== 'string' || v.trim() === ''

/**
 * `reject` prose is documentation, not a matcher, so each rejected case is
 * modelled here as a predicate: true means the body is the shape that case
 * describes. A rejected case with no rule fails its own test, so a new one
 * upstream cannot slip through unmodelled.
 */
export const REJECT_RULES = {
  '/hook': {
    'missing session_id': (b) => !('session_id' in b),
    'empty session_id': (b) => b.session_id === '',
    'missing state': (b) => !('state' in b),
    'unknown state': (b) => 'state' in b && !STATES.has(b.state),
    'state is case sensitive': (b) =>
      typeof b.state === 'string' && !STATES.has(b.state) && STATES.has(b.state.toLowerCase()),
    'malformed json': (b, raw) => !isJsonObject(raw),
  },
  '/session-start': {
    'missing session_id': (b) => !('session_id' in b),
    'missing provider_session_id': (b) => !('provider_session_id' in b) && !('claude_session_id' in b),
    'empty provider_session_id': (b) => b.provider_session_id === '',
    'unregistered provider': (b) =>
      'provider' in b && !PROVIDERS.has(b.provider) && !PENDING_UPSTREAM.has(b.provider),
    'malformed json': (b, raw) => !isJsonObject(raw),
  },
  '/session-title': {
    'missing session_id': (b) => !('session_id' in b),
    'missing title': (b) => !('title' in b),
    'empty title': (b) => b.title === '',
    'blank title': (b) => 'title' in b && blank(b.title),
    'malformed json': (b, raw) => !isJsonObject(raw),
  },
  '/session-touched': {
    'missing session_id': (b) => !('session_id' in b),
    'empty session_id': (b) => b.session_id === '',
    'an empty path': (b) => Array.isArray(b.paths) && b.paths.some((p) => p === ''),
    'paths that are not a list': (b) =>
      'paths' in b && !(Array.isArray(b.paths) && b.paths.every((p) => typeof p === 'string')),
    'a collect naming paths': (b) => b.collect === true && 'paths' in b,
    'a collect that holds': (b) => b.collect === true && 'hold' in b,
    'malformed json': (b, raw) => !isJsonObject(raw),
  },
  '/subagent': {
    'no tasks on a spawn': (b) => (b.call ?? 'spawn') === 'spawn' && (b.tasks ?? []).length === 0,
    'a task with no prompt': (b) => b.sealed !== true && (b.tasks ?? []).some((t) => blank(t.prompt)),
    'a wait carrying tasks': (b) => b.call === 'wait' && (b.tasks ?? []).length > 0,
    'an unknown call': (b) => 'call' in b && !SUBAGENT_CALLS.has(b.call),
    'an unknown isolation': (b) => typeof b.isolation === 'string' && !['', 'worktree'].includes(b.isolation.trim()),
    'no session id': (b) => !('session_id' in b),
    'no tool': (b) => blank(b.tool),
    'not JSON': (b, raw) => !isJsonObject(raw),
  },
}

export function isJsonObject(raw) {
  try {
    return isObject(JSON.parse(raw))
  } catch {
    return false
  }
}

/**
 * Compares a sent body against every `accept` case's `body` for the endpoint:
 * same key set, and each value of the same class (a non-blank string stays a
 * non-blank string). Values themselves are dynamic — session ids and titles are
 * whatever the session happens to hold — so only shape is asserted here;
 * enumerated values are pinned by the reject rules.
 *
 * Returns the name of the case it matches, or null.
 */
export function matchingAcceptCase(endpoint, body) {
  const free = FREE_TEXT[endpoint] ?? []
  const field = (o, k) =>
    free.includes(k) ? `${k}:${typeof o[k]}` : `${k}:${blank(o[k]) ? typeof o[k] + '(blank)' : typeof o[k]}`
  const shape = (o) => Object.keys(o).sort().map((k) => field(o, k)).join(',')
  const rest = { ...body }
  for (const k of ANY_SHAPE[endpoint] ?? []) {
    if (!(k in rest)) continue
    if (!accepted(endpoint).some((c) => c.body && k in c.body && field(c.body, k) === field(rest, k))) return null
    delete rest[k]
  }
  const sent = shape(rest)
  return accepted(endpoint).find((c) => c.body && shape(c.body) === sent)?.name ?? null
}

/**
 * Fields the contract makes optional on every report to an endpoint, so they
 * ride any accepted shape rather than the one case that shows them; the value
 * must still match that case's. session-state.md: `provider_session_id` names
 * the conversation on any state report, and one without it is taken as before.
 */
const ANY_SHAPE = { '/hook': ['provider_session_id'] }

/**
 * Fields whose value is whatever the provider gave, blank included, so only
 * their type is the shape. subagent-cards.md: `tool_use_id` is empty when the
 * provider gives none, `model` and `isolation` when the call asks for none, and
 * the conversation is the provider's to name.
 */
const FREE_TEXT = { '/subagent': ['provider_session_id', 'tool_use_id', 'model', 'isolation'] }

export function assertContractHonoured(endpoint, request) {
  assert.equal(
    request.url,
    `${endpoint}?token=${TOKEN}`,
    `posted to ${request.url}, expected ${endpoint}?token=${TOKEN}`,
  )
  return assertReportHonoured(endpoint, request)
}

/** Everything a report owes the contract except how its token travels. */
export function assertReportHonoured(endpoint, request) {
  assert.equal(request.method, 'POST')
  assert.match(request.headers['content-type'] ?? '', /application\/json/)
  assert.equal(
    request.headers['x-lich-plugin'],
    PLUGIN_VERSION,
    'every report names the release it ships in, as the manifest does',
  )

  assert.ok(isJsonObject(request.raw), `body is not a JSON object: ${request.raw}`)
  const body = JSON.parse(request.raw)

  // claude_session_id is a deprecated alias lich still folds for plugins
  // released before v0.3.0. Nothing shipping today emits it.
  assert.ok(!('claude_session_id' in body), `body still sends claude_session_id: ${request.raw}`)

  const match = matchingAcceptCase(endpoint, body)
  assert.ok(match, `body matches no accepted shape for ${endpoint}: ${request.raw}`)

  for (const [name, violates] of Object.entries(REJECT_RULES[endpoint])) {
    assert.ok(!violates(body, request.raw), `body is the rejected shape "${name}": ${request.raw}`)
  }
  return { body, match }
}

// ------------------------------------------------------------------ harness --

const liveStubs = new Set()

/**
 * Resolves once every live stub has read each connection made to it so far.
 *
 * A hook exiting does not mean its report was read. When the stub's process is
 * starved past curl's --max-time, curl gives up with the request already in the
 * socket, and the child's exit can reach the event loop before that connection
 * is even accepted. Connecting once more and waiting to accept it drains the
 * listen queue, which is FIFO; each accepted socket closing means its request
 * was read. Call it after a hook exits and before asserting on `requests`.
 */
export const settleStubs = () => Promise.all([...liveStubs].map((stub) => stub.settle()))

/**
 * `status` is the answer to every request, or a function of the request.
 * `body`, when given, is the JSON text answered with it; `hang` never answers.
 */
export async function startStub({ status = 204, body, hang = false } = {}) {
  const requests = []
  const sockets = new Set()
  const server = createServer((req, res) => {
    let raw = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      requests.push({ method: req.method, url: req.url, headers: req.headers, raw })
      if (hang) return
      const code = typeof status === 'function' ? status(req) : status
      if (body === undefined) res.writeHead(code).end()
      else res.writeHead(code, { 'content-type': 'application/json' }).end(body)
    })
  })
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port

  const settle = async () => {
    const probe = connect(port, '127.0.0.1')
    await once(probe, 'connect')
    const accepted = () => [...sockets].some((s) => s.remotePort === probe.localPort)
    while (!accepted()) await once(server, 'connection')
    probe.destroy()
    await Promise.all([...sockets].map((s) => once(s, 'close')))
  }

  const stub = {
    requests,
    port,
    settle,
    close: () => {
      liveStubs.delete(stub)
      return new Promise((resolve) => server.close(resolve))
    },
  }
  liveStubs.add(stub)
  return stub
}

export async function withStub(fn, options) {
  const stub = await startStub(options)
  try {
    return await fn(stub)
  } finally {
    await stub.close()
  }
}

export const lichEnv = (port) => ({
  LICH_PORT: String(port),
  LICH_TOKEN: TOKEN,
  LICH_SESSION_ID,
})
