// Pins the agent-facing text catalog (hooks/prompt-text.js) and that each hook
// renders it in the prompt language lich exports as LICH_PROMPT_LANG. The
// English texts are pinned verbatim by each hook's own suite; this one holds
// the catalogs level with each other and runs one text per hook in pt-BR.
//
// Run: node --test tests/

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { en, ptBR, zhCN, es, ja, ko, ru, say, promptLang } from '../hooks/prompt-text.js'
import { register as registerEditGuard } from '../hooks/edit-guard.js'
import { register as registerSelfCommand } from '../hooks/self-command.js'
import { register as registerModControl } from '../hooks/mod-control.js'

const slots = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

// Names the model or the contract matches on: kept literal in every locale.
const LITERALS = [
  '<lich-notification kind="worker-finished">',
  'send_to_session',
  'wait_for_answer',
  'SendMessage',
  'lich send',
  'mcp__lich__control_session',
  'subagent/',
]

test('every English text has a pt-BR twin and the other way round', () => {
  assert.deepEqual(Object.keys(ptBR).sort(), Object.keys(en).sort())
})

test('a translation fills the same slots as the English text', () => {
  for (const key of Object.keys(en)) assert.deepEqual(slots(ptBR[key]), slots(en[key]), key)
})

test('names that must stay literal are kept in every translation', () => {
  for (const key of Object.keys(en)) {
    for (const literal of LITERALS) {
      if (en[key].includes(literal)) assert.ok(ptBR[key].includes(literal), `${key} lost ${literal}`)
    }
  }
})

test('an unknown or absent language says the English text', () => {
  for (const lang of [undefined, '', 'fr', 'PT-br']) assert.equal(say(lang, 'editNoteAgo', { minutes: 2 }), '2 min ago')
  assert.equal(say('pt-BR', 'editNoteAgo', { minutes: 2 }), 'há 2 min')
})

test('a key no catalog has is an error, not an empty text', () => {
  assert.throws(() => say('en', 'nope'), /no prompt text named "nope"/)
})

test('the language is read from LICH_PROMPT_LANG, English when unset or unknown', async () => {
  const lang = async (value) => promptLang(value)
  assert.equal(await lang('pt-BR'), 'pt-BR')
  assert.equal(await lang('en'), 'en')
  assert.equal(await lang(undefined), 'en')
  assert.equal(await lang('klingon'), 'en')
})

// ------------------------------------------------------------ per hook, pt-BR --

const PT = { LICH_PROMPT_LANG: 'pt-BR' }

function hooksOf(register) {
  const hooks = new Map()
  register((event, ...rest) => {
    const matcher = rest.length > 1 ? rest[0] : {}
    hooks.set(`${event} ${matcher.tool ?? ''}`.trim(), rest.at(-1))
  })
  return hooks
}

const pass = (value) => async () => value
const exits = (code, stdout = '', stderr = '') => ({ exitCode: code, stdout, stderr })

test('edit-guard: the note about another session speaks pt-BR', async () => {
  const MIN = 60_000
  const T0 = Date.parse('2026-10-05T12:00:00.000Z')
  const disk = new Map()
  let now = T0
  const hooks = hooksOf(registerEditGuard)
  const session = (id) => {
    const env = { ...PT, LICH_SESSION_ID: id }
    const $ = {
      env: { get: async (n) => env[n] },
      clock: { now: async () => now, after: () => ({ cancel() {} }) },
      ui: { log() {}, invalidate() {} },
      process: { run: async () => exits(0, '/r/.git\n') },
      fs: {
        exists: async (p) => disk.has(p),
        read: async (p) => disk.get(p),
        write: async (p, t) => void disk.set(p, t),
      },
    }
    return () => hooks.get('tool.call Edit')($, { tool: 'Edit', file_path: '/r/a.js' }, pass({ result: {}, text: 'ok' }))
  }
  await session('lich-a')()
  now = T0 + 3 * MIN
  const result = await session('lich-b')()
  assert.match(result.context[0], /^\/r\/a\.js também foi editado pela sessão lich lich-a em 2026-10-05T12:00:00\.000Z \(há 3 min\)/)
  assert.match(result.context[0], /send_to_session ou lich send/)
})

test('self-command: the tool notes and the queued answers speak pt-BR', async () => {
  const hooks = hooksOf(registerSelfCommand)
  const env = { ...PT, LICH_SESSION_ID: 'lich-1', LICH_BIN: '/lich' }
  const $ = {
    env: { get: async (n) => env[n] },
    clock: { after() {} },
    command: { list: async () => [{ name: 'compact', source: 'builtin' }, { name: 'model', source: 'builtin' }], run: async () => ({}) },
    ui: { toast() {}, invalidate() {} },
    process: { run: async () => exits(0, JSON.stringify({ label: 'x', name: 'y' })) },
  }
  await hooks.get('session.start')($, { isInteractive: true }, async (e) => e)

  const skill = await hooks.get('tool.describe Skill')($, { tool: 'Skill', description: 'base' }, async (e) => e)
  assert.match(skill.description, /^base\n\nNesta sessão um slash command embutido/)
  const control = await hooks.get('tool.describe mcp__lich__control_session')(
    $,
    { tool: 'mcp__lich__control_session', description: 'base' },
    async (e) => e,
  )
  assert.match(control.description, /passe session "lich-1"\./)

  const refused = { isError: true, result: 'compact is a built-in CLI command, not a skill' }
  const queued = await hooks.get('tool.call Skill')($, { tool: 'Skill', skill: 'compact' }, async () => refused)
  assert.equal(queued.context[0], '/compact está na fila e roda quando este turno terminar. Encerre o turno agora.')

  const denied = await hooks.get('tool.call Skill')($, { tool: 'Skill', skill: 'model', args: 'opus' }, async () => refused)
  assert.match(denied.deny, /^\/model executado de dentro da sessão/)
})

test('mod-control: the side question is prefaced in pt-BR', async () => {
  const hooks = hooksOf(registerModControl)
  const forks = []
  const env = { ...PT, LICH_PORT: '1', LICH_TOKEN: 't', LICH_SESSION_ID: 's' }
  let served = false
  const $ = {
    env: { get: async (n) => env[n] },
    clock: { after: (ms, fn) => setImmediate(fn) },
    http: {
      fetch: async (url) => {
        if (url.includes('/mod/acks')) return { status: 204, ok: true, headers: {}, text: '' }
        if (served) return new Promise(() => {})
        served = true
        const body = [{ id: 'm1', kind: 'ask', question: 'o que faz?' }]
        return { status: 200, ok: true, headers: {}, text: JSON.stringify(body) }
      },
    },
    model: {
      fork: async (args) => {
        forks.push(args)
        return { isAnswered: true, text: 'a', usage: {} }
      },
    },
  }
  await hooks.get('session.start')($, { isInteractive: true }, async (e) => e)
  for (let i = 0; i < 50 && forks.length === 0; i++) await new Promise((r) => setImmediate(r))
  assert.equal(forks.length, 1)
  assert.match(forks[0].prompt, /^Esta é uma pergunta lateral feita de fora do seu turno/)
  assert.ok(forks[0].prompt.endsWith('Pergunta: o que faz?'))
})

// ---------------------------------------------- zh-CN, es, ja, ko and ru catalogs --

const NEW_LOCALES = { 'zh-CN': zhCN, es, ja, ko, ru }

for (const [tag, catalog] of Object.entries(NEW_LOCALES)) {
  test(`${tag}: same keys, same slots and the literal names as English`, () => {
    assert.deepEqual(Object.keys(catalog).sort(), Object.keys(en).sort())
    for (const key of Object.keys(en)) {
      assert.deepEqual(slots(catalog[key]), slots(en[key]), key)
      for (const literal of LITERALS) {
        if (en[key].includes(literal)) assert.ok(catalog[key].includes(literal), `${key} lost ${literal}`)
      }
    }
  })

  test(`${tag}: LICH_PROMPT_LANG selects the catalog`, () => {
    assert.equal(promptLang(tag), tag)
    assert.notEqual(say(tag, 'editNoteAgo', { minutes: 2 }), '2 min ago')
  })
}

// What each hook renders per locale, one text per hook. The hook is driven the
// way the pt-BR tests above drive it, with only the language swapped.
const EXPECTED = {
  'zh-CN': {
    edit: /^\/r\/a\.js 也被 lich 会话 lich-a 在 2026-10-05T12:00:00\.000Z（3 分钟前）编辑过/,
    skill: /^base\n\n在此会话中，内置斜杠命令/,
    control: /传入 session "lich-1"。/,
    queued: '/compact 已进入队列，将在本回合结束后运行。现在请结束本回合。',
    saved: /^在会话内部运行 \/model/,
    ask: /^这是在你的回合之外/,
  },
  es: {
    edit: /^\/r\/a\.js también fue editado por la sesión lich lich-a en 2026-10-05T12:00:00\.000Z \(hace 3 min\)/,
    skill: /^base\n\nEn esta sesión, un slash command integrado/,
    control: /pasa session "lich-1"\./,
    queued: '/compact está en cola y se ejecuta cuando termine este turno. Termina el turno ahora.',
    saved: /^\/model ejecutado desde dentro de la sesión/,
    ask: /^Esta es una pregunta lateral hecha desde fuera de tu turno/,
  },
  ja: {
    edit: /^\/r\/a\.js は lich セッション lich-a によっても 2026-10-05T12:00:00\.000Z（3 分前）に編集されています/,
    skill: /^base\n\nこのセッションでは、ユーザーが実行を求めたときに、組み込みのスラッシュコマンド/,
    control: /session に "lich-1" を渡してください。/,
    queued: '/compact はキューに入り、このターンが終わると実行されます。今すぐターンを終えてください。',
    saved: /^\/model をセッションの中から実行すると/,
    ask: /^これは、あなたが作業している間にターンの外から尋ねられた横からの質問です/,
  },
  ko: {
    edit: /^\/r\/a\.js은\(는\) lich 세션 lich-a도 2026-10-05T12:00:00\.000Z\(3분 전\)에 수정했습니다/,
    skill: /^base\n\n이 세션에서는 사용자가 실행을 요청하면 내장 슬래시 명령/,
    control: /session에 "lich-1"를 전달하세요\./,
    queued: '/compact이(가) 대기열에 들어갔고 이 턴이 끝나면 실행됩니다. 지금 턴을 끝내세요.',
    saved: /^세션 안에서 \/model을\(를\) 실행하면/,
    ask: /^이것은 당신이 작업하는 동안 턴 밖에서 들어온 곁가지 질문입니다/,
  },
  ru: {
    edit: /^\/r\/a\.js также редактировала сессия lich lich-a в 2026-10-05T12:00:00\.000Z \(3 мин назад\)/,
    skill: /^base\n\nВ этой сессии здесь также можно назвать встроенную slash-команду/,
    control: /передайте session "lich-1"\./,
    queued: '/compact поставлена в очередь и выполнится, когда этот ход закончится. Завершите ход сейчас.',
    saved: /^\/model, запущенная изнутри сессии/,
    ask: /^Это побочный вопрос, заданный вне вашего хода/,
  },
}

for (const [tag, want] of Object.entries(EXPECTED)) {
  const LANG = { LICH_PROMPT_LANG: tag }

  test(`${tag}: edit-guard renders the note about another session`, async () => {
    const T0 = Date.parse('2026-10-05T12:00:00.000Z')
    const disk = new Map()
    let now = T0
    const hooks = hooksOf(registerEditGuard)
    const session = (id) => {
      const env = { ...LANG, LICH_SESSION_ID: id }
      const $ = {
        env: { get: async (n) => env[n] },
        clock: { now: async () => now, after: () => ({ cancel() {} }) },
        ui: { log() {}, invalidate() {} },
        process: { run: async () => exits(0, '/r/.git\n') },
        fs: {
          exists: async (p) => disk.has(p),
          read: async (p) => disk.get(p),
          write: async (p, t) => void disk.set(p, t),
        },
      }
      return () => hooks.get('tool.call Edit')($, { tool: 'Edit', file_path: '/r/a.js' }, pass({ result: {}, text: 'ok' }))
    }
    await session('lich-a')()
    now = T0 + 3 * 60_000
    const result = await session('lich-b')()
    assert.match(result.context[0], want.edit)
    assert.match(result.context[0], /send_to_session( o| 或| または|이나| или) lich send/)
  })

  test(`${tag}: self-command renders the tool notes and the queued answer`, async () => {
    const hooks = hooksOf(registerSelfCommand)
    const env = { ...LANG, LICH_SESSION_ID: 'lich-1', LICH_BIN: '/lich' }
    const $ = {
      env: { get: async (n) => env[n] },
      clock: { after() {} },
      command: { list: async () => [{ name: 'compact', source: 'builtin' }, { name: 'model', source: 'builtin' }], run: async () => ({}) },
      ui: { toast() {}, invalidate() {} },
      process: { run: async () => exits(0, JSON.stringify({ label: 'x', name: 'y' })) },
    }
    await hooks.get('session.start')($, { isInteractive: true }, async (e) => e)

    const skill = await hooks.get('tool.describe Skill')($, { tool: 'Skill', description: 'base' }, async (e) => e)
    assert.match(skill.description, want.skill)
    const control = await hooks.get('tool.describe mcp__lich__control_session')(
      $,
      { tool: 'mcp__lich__control_session', description: 'base' },
      async (e) => e,
    )
    assert.match(control.description, want.control)

    const refused = { isError: true, result: 'compact is a built-in CLI command, not a skill' }
    const queued = await hooks.get('tool.call Skill')($, { tool: 'Skill', skill: 'compact' }, async () => refused)
    assert.equal(queued.context[0], want.queued)
    const denied = await hooks.get('tool.call Skill')($, { tool: 'Skill', skill: 'model', args: 'opus' }, async () => refused)
    assert.match(denied.deny, want.saved)
  })

  test(`${tag}: mod-control prefaces the side question`, async () => {
    const hooks = hooksOf(registerModControl)
    const forks = []
    const env = { ...LANG, LICH_PORT: '1', LICH_TOKEN: 't', LICH_SESSION_ID: 's' }
    let served = false
    const $ = {
      env: { get: async (n) => env[n] },
      clock: { after: (ms, fn) => setImmediate(fn) },
      http: {
        fetch: async (url) => {
          if (url.includes('/mod/acks')) return { status: 204, ok: true, headers: {}, text: '' }
          if (served) return new Promise(() => {})
          served = true
          return { status: 200, ok: true, headers: {}, text: JSON.stringify([{ id: 'm1', kind: 'ask', question: 'q?' }]) }
        },
      },
      model: { fork: async (args) => (forks.push(args), { isAnswered: true, text: 'a', usage: {} }) },
    }
    await hooks.get('session.start')($, { isInteractive: true }, async (e) => e)
    for (let i = 0; i < 50 && forks.length === 0; i++) await new Promise((r) => setImmediate(r))
    assert.equal(forks.length, 1)
    assert.match(forks[0].prompt, want.ask)
    assert.ok(forks[0].prompt.endsWith('q?'))
  })
}
