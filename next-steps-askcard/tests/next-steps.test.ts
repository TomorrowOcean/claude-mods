import type { On, RenderSurface } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'next-steps-askcard',
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

const ANSWER =
  'The settings page now validates its fields, and the tests for it are written but not yet run.'

const STOP = { stop_hook_active: false, last_assistant_message: ANSWER } as const

const TURN = {
  answer: ANSWER,
  reason: 'answer',
  durationMs: 1200,
  isAborted: false,
  turnId: 'turn-1',
} as const

const REPLY = JSON.stringify([
  { label: 'Run the tests', prompt: 'run the tests you just wrote' },
  { label: 'Review the diff', prompt: '/code-review high' },
  { label: 'Made-up command', prompt: '/no-such-command now' },
  { label: 'Run the tests', prompt: 'a second suggestion under a label already taken' },
])

const USAGE = {
  input_tokens: 1,
  output_tokens: 1,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
}

// What the person does with the card: an option's label or free text, `null`
// to close it, a promise to hold it open until it settles. `hasCard` false:
// the call fails at once, no dialog having shown. `hasBox`: whether the
// session's prompt box takes a plugin's fill.
type Answer = string | null | Promise<string | null>
type World = { surface: RenderSurface; hasBox?: boolean; hasCard?: false; answer?: Answer }

type Sent = {
  fills: string[]
  prompts: string[]
  commands: string[]
  forks: number
  cards: string[][]
  questions: unknown[]
  // The card, the stop going on beneath the plugin, and the turn's end, in
  // the order they happened.
  order: string[]
}

// The world beneath the plugin: a fork that answers REPLY, one known command,
// the question card, and a prompt box.
function world(on: On, { surface, hasBox = true, hasCard, answer = null }: World): Sent {
  const sent: Sent = {
    fills: [],
    prompts: [],
    commands: [],
    forks: 0,
    cards: [],
    questions: [],
    order: [],
  }
  // A card the person saw took them a while to answer; one never shown did not.
  let now = 0
  on('clock.now', () => ({ value: now }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId ?? 'turn-2' }))
  on('classic.Stop', () => {
    sent.order.push('stop goes on')
    return {}
  })
  on('turn.complete', (_$, e) => {
    sent.order.push('turn ends')
    return { text: e.answer }
  })
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'engine', ref: 0 }))
  on('session.surfaces', () => ({ value: [surface] }))
  on('command.list', () => ({
    value: [{ name: 'code-review', description: 'Reviews the diff.', source: 'plugin' }],
  }))
  on('model.fork', () => {
    sent.forks += 1
    return { value: { isAnswered: true, text: REPLY, usage: USAGE } }
  })
  on('tool.call', { tool: 'AskUserQuestion' }, async (_$, e) => {
    if (hasCard === false) throw new Error('no dialog here')
    const [asked] = e.questions
    if (asked === undefined) throw new Error('a card with no question')
    sent.cards.push(asked.options.map(option => option.label))
    sent.questions = [...e.questions]
    const given = await answer
    now += 5000
    sent.order.push('card answered')
    if (given === null) return { deny: 'The user closed the card.' }
    return { result: { questions: e.questions, answers: { [asked.question]: given } } }
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

// The draft is written detached from the turn's end: wait for what it leads to.
async function until(what: string, isThere: () => Promise<boolean> | boolean): Promise<void> {
  for (let tries = 0; tries < 200; tries++) {
    if (await isThere()) return
    await Promise.resolve()
  }
  throw new Error(`never happened: ${what}`)
}

const CARD = ['Run the tests', 'Review the diff']

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: the card is answered before the stop goes on, and the pick fills the prompt box at the turn's end`, async ($, on) => {
    const sent = world(on, { surface, answer: 'Run the tests' })
    const ui = await $.ui.mount({ ...BAND, surface })

    await $.classic.Stop(STOP)
    // The turn was still stopping while the card was up: answered first.
    expect(sent.order).toEqual(['card answered', 'stop goes on'])
    // Neither the unknown command nor the repeated label is offered.
    expect(sent.cards).toEqual([CARD])
    // Nothing is written while the turn is still running.
    expect(sent.fills).toEqual([])

    await $.turn.complete(TURN)
    await until('the fill', () => sent.fills.length === 1)
    expect(sent.fills).toEqual(['run the tests you just wrote'])
    expect(sent.prompts).toEqual([])
    expect(await ui.find({ type: 'Button' })).toBeUndefined()
    expect(await ui.find({ type: 'Input' })).toBeUndefined()
    await ui.unmount()
  })
}

test('the card draws each suggestion with its prompt under the label', async ($, on) => {
  let pick: (answer: string | null) => void = () => undefined
  const held = new Promise<string | null>(resolve => {
    pick = resolve
  })
  const sent = world(on, { surface: 'desktop', answer: held })
  let drawn: unknown[] = []
  on('ui.render', { component: 'AskUserQuestion' }, (_$, e) => {
    drawn = [...e.props.questions]
    return { type: 'engine', ref: 0 }
  })
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })

  const stopping = $.classic.Stop(STOP)
  await until('the card', () => sent.cards.length === 1)
  const card = await $.ui.mount({
    plugin: 'next-steps-askcard',
    surface: 'desktop',
    component: 'AskUserQuestion',
    props: { tool: 'AskUserQuestion', questions: sent.questions },
  })
  expect(drawn).toHaveLength(1)
  expect((drawn[0] as { options: unknown }).options).toEqual([
    expect.objectContaining({ label: 'Run the tests', description: 'run the tests you just wrote' }),
    expect.objectContaining({ label: 'Review the diff', description: '/code-review high' }),
  ])
  // While the card is up the band holds nothing of the plugin's.
  expect(await band.find({ type: 'Text' })).toBeUndefined()

  pick(null)
  await stopping
  await card.unmount()
  await band.unmount()
})

test('text typed into the card is the draft', async ($, on) => {
  const sent = world(on, { surface: 'desktop', answer: 'run only the settings tests' })

  await $.classic.Stop(STOP)
  await $.turn.complete(TURN)
  await until('the fill', () => sent.fills.length === 1)
  expect(sent.fills).toEqual(['run only the settings tests'])
})

test("a pick is delivered from the stop where the turn's end was reported first", async ($, on) => {
  const sent = world(on, { surface: 'desktop', answer: 'Review the diff' })

  await $.turn.complete(TURN)
  await $.classic.Stop(STOP)
  await until('the fill', () => sent.fills.length === 1)
  expect(sent.fills).toEqual(['/code-review high'])
})

test('a closed card leaves nothing, and the turn goes on to its end', async ($, on) => {
  const sent = world(on, { surface: 'desktop', answer: null })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await $.classic.Stop(STOP)
  await $.turn.complete(TURN)
  expect(sent.order).toEqual(['card answered', 'stop goes on', 'turn ends'])
  expect(sent.fills).toEqual([])
  expect(await ui.find({ type: 'Button' })).toBeUndefined()
  expect(await ui.find({ type: 'Text' })).toBeUndefined()
  await ui.unmount()
})

test('a short answer, a pause on background work and a second stop raise no card', async ($, on) => {
  const sent = world(on, { surface: 'desktop', answer: null })

  await $.classic.Stop({ ...STOP, last_assistant_message: 'Done.' })
  await $.classic.Stop({
    ...STOP,
    background_tasks: [{ id: 'b1', type: 'shell', status: 'running', description: 'build' }],
  })
  expect(sent.forks).toBe(0)

  // One card a turn: a stop hook sent the turn on and it stopped again.
  await $.classic.Stop(STOP)
  await $.classic.Stop(STOP)
  expect(sent.forks).toBe(1)
  expect(sent.cards).toHaveLength(1)

  // A subagent's turn ending inside the person's own changes nothing.
  await $.turn.complete({ ...TURN, agentId: 'agent-1' })
  await $.classic.Stop(STOP)
  expect(sent.forks).toBe(1)
  await $.turn.complete(TURN)
  await $.classic.Stop(STOP)
  expect(sent.forks).toBe(2)
})

test('with no prompt box to fill, the pick opens in the band, and only send submits it', async ($, on) => {
  const sent = world(on, { surface: 'desktop', hasBox: false, answer: 'Run the tests' })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await $.classic.Stop(STOP)
  await $.turn.complete(TURN)
  await until('the field', async () => (await ui.find({ key: 'draft' })) !== undefined)
  expect((await ui.find({ key: 'draft' }))?.props.value).toBe('run the tests you just wrote')
  expect(sent.prompts).toEqual([])

  // An edit, then the send button: the edited text goes, once.
  await ui.input({ key: 'draft', text: 'run only the settings tests', kind: 'change' })
  await ui.press({ key: 'send' })
  expect(sent.prompts).toEqual(['run only the settings tests'])
  expect(sent.commands).toEqual([])
  expect(await ui.find({ type: 'Input' })).toBeUndefined()
  await ui.unmount()
})

test('with no prompt box to fill, Enter in the field sends, and a slash prompt runs its command', async ($, on) => {
  const sent = world(on, { surface: 'desktop', hasBox: false, answer: 'Review the diff' })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await $.classic.Stop(STOP)
  await $.turn.complete(TURN)
  await until('the field', async () => (await ui.find({ key: 'draft' })) !== undefined)
  await ui.input({ key: 'draft', text: '/code-review high' })
  expect(sent.commands).toEqual(['/code-review high'])
  expect(sent.prompts).toEqual([])
  await ui.unmount()
})

test('without the card the band draws one after the turn, collapsed, and an expanded pick fills the prompt box', async ($, on) => {
  const sent = world(on, { surface: 'desktop', hasCard: false })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await $.classic.Stop(STOP)
  expect(await ui.find({ type: 'Button' })).toBeUndefined()
  await $.turn.complete(TURN)
  // Collapsed: the title, the toggle and the close button, nothing to pick.
  expect((await ui.findAll({ type: 'Text' })).map(text => text.text)).toEqual(['What next?'])
  expect((await ui.findAll({ type: 'Button' })).map(button => button.key)).toEqual(['toggle', 'close'])

  await ui.press({ key: 'toggle' })
  // Expanded: label over prompt per suggestion.
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
  expect(await ui.find({ type: 'Button' })).toBeUndefined()
  await ui.unmount()
})

test("startCollapsed off: the band's card opens expanded, and its close button takes it down", { options: { startCollapsed: false } }, async ($, on) => {
  const sent = world(on, { surface: 'desktop', hasCard: false })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await $.classic.Stop(STOP)
  await $.turn.complete(TURN)
  expect(await ui.find({ key: 'pick2' })).toBeDefined()

  await ui.press({ key: 'close' })
  expect(await ui.find({ type: 'Button' })).toBeUndefined()
  expect(sent.fills).toEqual([])
  await ui.unmount()
})
