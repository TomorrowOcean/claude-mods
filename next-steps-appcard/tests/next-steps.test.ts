import type { On, RenderSurface } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'next-steps-appcard',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const TURN = {
  answer: 'The settings page now validates its fields, and the tests for it are written but not yet run.',
  reason: 'answer',
  durationMs: 1200,
  isAborted: false,
  turnId: 'turn-1',
} as const

const REPLY = JSON.stringify([
  { label: 'Run the tests', prompt: 'run the tests you just wrote' },
  { label: 'Review the diff', prompt: '/code-review high' },
  { label: 'Made-up command', prompt: '/no-such-command now' },
])

const USAGE = {
  input_tokens: 1,
  output_tokens: 1,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
}

// `hasBox`: whether the session's prompt box takes a plugin's fill.
type World = { surface: RenderSurface; hasBox: boolean }

type Sent = { fills: string[]; prompts: string[]; commands: string[]; forks: number; asks: number }

// The world beneath the plugin: a fork that answers REPLY, one known command,
// and a prompt box that takes a fill or does not.
function world(on: On, { surface, hasBox }: World): Sent {
  const sent: Sent = { fills: [], prompts: [], commands: [], forks: 0, asks: 0 }
  on('turn.start', (_$, e) => ({ turnId: e.turnId ?? 'turn-2' }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'engine', ref: 0 }))
  on('session.surfaces', () => ({ value: [surface] }))
  on('command.list', () => ({
    value: [{ name: 'code-review', description: 'Reviews the diff.', source: 'plugin' }],
  }))
  on('model.fork', () => {
    sent.forks += 1
    return { value: { isAnswered: true, text: REPLY, usage: USAGE } }
  })
  // The engine's own question dialog: the card is drawn, never asked.
  on('tool.call', { tool: 'AskUserQuestion' }, () => {
    sent.asks += 1
    return { deny: 'not expected' }
  })
  on('prompt.suggest', () => ({ isShown: hasBox }))
  on('prompt.fill', (_$, e) => {
    // The engine's own `no_composer` cause is not a hook's to write: bare here.
    if (!hasBox) return { isFilled: false }
    sent.fills.push(e.text)
    return { isFilled: true }
  })
  on('prompt.submit', (_$, e) => {
    sent.prompts.push(e.text)
    return { text: e.text }
  })
  on('command.run', (_$, e) => {
    sent.commands.push(`/${e.command} ${e.args}`)
    return { text: '' }
  })
  return sent
}

// The fork runs detached from turn.complete: wait for the card it leads to.
async function offered(ui: { find: (query: { key: string }) => Promise<unknown> }): Promise<void> {
  for (let tries = 0; tries < 200; tries++) {
    if ((await ui.find({ key: 'toggle' })) !== undefined) return
  }
  throw new Error('the card never showed')
}

const EXPANDED = { options: { startCollapsed: false } }

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: the card starts as its title row, and expands to a pick that fills the prompt box`, async ($, on) => {
    const sent = world(on, { surface, hasBox: true })
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Button' })).toBeUndefined()

    await $.turn.complete(TURN)
    await offered(ui)
    // Collapsed: the title, the toggle and the close button, nothing to pick.
    expect((await ui.findAll({ type: 'Text' })).map(text => text.text)).toEqual(['What next?'])
    expect((await ui.findAll({ type: 'Button' })).map(button => button.key)).toEqual(['toggle', 'close'])

    await ui.press({ key: 'toggle' })
    // Expanded: label over prompt per suggestion. The command the session
    // does not have is not offered.
    expect((await ui.findAll({ type: 'Text' })).map(text => text.text)).toEqual([
      'What next?',
      'run the tests you just wrote',
      '/code-review high',
    ])
    expect((await ui.findAll({ type: 'Button' })).map(button => button.key)).toEqual([
      'toggle',
      'close',
      'pick1',
      'pick2',
    ])
    expect((await ui.find({ key: 'pick1' }))?.props.label).toBe('Run the tests')

    await ui.press({ key: 'pick1' })
    expect(sent.fills).toEqual(['run the tests you just wrote'])
    expect(sent.prompts).toEqual([])
    expect(sent.asks).toBe(0)
    expect(await ui.find({ type: 'Button' })).toBeUndefined()
    await ui.unmount()
  })
}

test('the session keeps the last expand or collapse for its later cards', async ($, on) => {
  world(on, { surface: 'desktop', hasBox: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await $.turn.complete(TURN)
  await offered(ui)
  await ui.press({ key: 'toggle' })
  expect(await ui.find({ key: 'pick1' })).toBeDefined()

  // The next turn's card opens as the last one was left.
  await $.turn.start({ turnId: 'turn-2' })
  expect(await ui.find({ type: 'Button' })).toBeUndefined()
  await $.turn.complete({ ...TURN, turnId: 'turn-2' })
  await offered(ui)
  expect(await ui.find({ key: 'pick1' })).toBeDefined()

  await ui.press({ key: 'toggle' })
  expect(await ui.find({ key: 'pick1' })).toBeUndefined()
  expect(await ui.find({ key: 'toggle' })).toBeDefined()
  await ui.unmount()
})

test('startCollapsed off: the card opens expanded', EXPANDED, async ($, on) => {
  world(on, { surface: 'desktop', hasBox: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await $.turn.complete(TURN)
  await offered(ui)
  expect(await ui.find({ key: 'pick2' })).toBeDefined()
  await ui.unmount()
})

test('with no prompt box to fill, a pick opens the prompt in the band, and only send submits it', EXPANDED, async ($, on) => {
  const sent = world(on, { surface: 'desktop', hasBox: false })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await $.turn.complete(TURN)
  await offered(ui)
  await ui.press({ key: 'pick1' })
  expect(sent.prompts).toEqual([])
  expect((await ui.find({ key: 'draft' }))?.props.value).toBe('run the tests you just wrote')

  // Back returns to the card; nothing was sent.
  await ui.press({ key: 'back' })
  expect(await ui.find({ key: 'pick2' })).toBeDefined()
  expect(sent.prompts).toEqual([])

  // An edit, then the send button: the edited text goes, once.
  await ui.press({ key: 'pick1' })
  await ui.input({ key: 'draft', text: 'run only the settings tests', kind: 'change' })
  await ui.press({ key: 'send' })
  expect(sent.prompts).toEqual(['run only the settings tests'])
  expect(sent.commands).toEqual([])
  expect(await ui.find({ type: 'Button' })).toBeUndefined()
  await ui.unmount()
})

test('with no prompt box to fill, Enter in the field sends, and a slash prompt runs its command', EXPANDED, async ($, on) => {
  const sent = world(on, { surface: 'desktop', hasBox: false })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await $.turn.complete(TURN)
  await offered(ui)
  await ui.press({ key: 'pick2' })
  await ui.input({ key: 'draft', text: '/code-review high' })
  expect(sent.commands).toEqual(['/code-review high'])
  expect(sent.prompts).toEqual([])
  await ui.unmount()
})

test('a subagent turn, a short answer and a close all leave the band empty', async ($, on) => {
  const sent = world(on, { surface: 'desktop', hasBox: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await $.turn.complete({ ...TURN, agentId: 'agent-1' })
  await $.turn.complete({ ...TURN, answer: 'Done.' })
  expect(sent.forks).toBe(0)

  await $.turn.complete(TURN)
  await offered(ui)
  await ui.press({ key: 'close' })
  expect(await ui.find({ type: 'Button' })).toBeUndefined()
  expect(await ui.find({ type: 'Text' })).toBeUndefined()
  expect(sent.forks).toBe(1)
  expect(sent.fills).toEqual([])
  await ui.unmount()
})
