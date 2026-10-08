import type { On, RenderSurface } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'next-steps',
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
  { label: 'Run the tests', prompt: 'a second suggestion under a label already taken' },
])

const USAGE = {
  input_tokens: 1,
  output_tokens: 1,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
}

// What the person does with each card raised, in order: an option's label or
// free text, `null` to close it, a promise to hold it open until it settles;
// with `hasCard` false the call fails at once, no dialog having shown.
type Answer = string | null | Promise<string | null>
type World = { surface: RenderSurface; hasCard?: false; answers?: readonly Answer[] }

type Sent = {
  fills: string[]
  prompts: string[]
  commands: string[]
  forks: number
  cards: string[][]
  questions: unknown[]
}

// The world beneath the plugin: a fork that answers REPLY, one known command,
// the question card, and a prompt box only the terminal has.
function world(on: On, { surface, hasCard, answers = [] }: World): Sent {
  const sent: Sent = { fills: [], prompts: [], commands: [], forks: 0, cards: [], questions: [] }
  // A card the person saw took them a while to answer; one never shown did not.
  let now = 0
  on('clock.now', () => ({ value: now }))
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
  on('tool.call', { tool: 'AskUserQuestion' }, async (_$, e) => {
    if (hasCard === false) throw new Error('no dialog here')
    const [asked] = e.questions
    if (asked === undefined) throw new Error('a card with no question')
    const pending = answers[sent.cards.length] ?? null
    sent.cards.push(asked.options.map(option => option.label))
    sent.questions = [...e.questions]
    const answer = await pending
    now += 5000
    if (answer === null) return { deny: 'The user closed the card.' }
    return { result: { questions: e.questions, answers: { [asked.question]: answer } } }
  })
  on('prompt.suggest', () => ({ isShown: surface === 'terminal' }))
  on('prompt.fill', (_$, e) => {
    // The engine's own `no_composer` cause is not a hook's to write: bare here.
    if (surface !== 'terminal') return { isFilled: false }
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

// The fork and the card run detached from turn.complete: wait for what they
// lead to.
async function until(what: string, isThere: () => Promise<boolean> | boolean): Promise<void> {
  for (let tries = 0; tries < 200; tries++) {
    if (await isThere()) return
    await Promise.resolve()
  }
  throw new Error(`never happened: ${what}`)
}

const CARD = ['Run the tests', 'Review the diff']

test('the card draws each suggestion with its full prompt under the label', async ($, on) => {
  let pick: (answer: string | null) => void = () => undefined
  const held = new Promise<string | null>(resolve => {
    pick = resolve
  })
  const sent = world(on, { surface: 'desktop', answers: [held] })
  let drawn: unknown[] = []
  on('ui.render', { component: 'AskUserQuestion' }, (_$, e) => {
    drawn = [...e.props.questions]
    return { type: 'engine', ref: 0 }
  })
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await $.turn.complete(TURN)
  await until('the card', () => sent.cards.length === 1)
  const card = await $.ui.mount({
    plugin: 'next-steps',
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
  await card.unmount()
  await band.unmount()
})

test('terminal: the card offers each suggestion once, and a pick fills the prompt box', async ($, on) => {
  const sent = world(on, { surface: 'terminal', answers: ['Run the tests'] })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  await $.turn.complete(TURN)
  await until('the fill', () => sent.fills.length === 1)
  // Neither the unknown command nor the repeated label is offered.
  expect(sent.cards).toEqual([CARD])
  expect(sent.fills).toEqual(['run the tests you just wrote'])
  expect(sent.prompts).toEqual([])
  expect(await ui.find({ type: 'Input' })).toBeUndefined()
  expect(await ui.find({ type: 'Button' })).toBeUndefined()
  await ui.unmount()
})

test('desktop: a pick opens the prompt in the band, and only send submits it', async ($, on) => {
  const sent = world(on, { surface: 'desktop', answers: ['Run the tests', 'Run the tests'] })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await $.turn.complete(TURN)
  await until('the field', async () => (await ui.find({ key: 'draft' })) !== undefined)
  expect(sent.cards).toEqual([CARD])
  expect((await ui.find({ key: 'draft' }))?.props.value).toBe('run the tests you just wrote')
  expect(sent.prompts).toEqual([])

  // Back raises the card again; nothing was sent.
  await ui.press({ key: 'back' })
  await until('the second card', () => sent.cards.length === 2)
  await until('the field again', async () => (await ui.find({ key: 'draft' })) !== undefined)
  expect(sent.prompts).toEqual([])

  // An edit, then the send button: the edited text goes, once.
  await ui.input({ key: 'draft', text: 'run only the settings tests', kind: 'change' })
  await ui.press({ key: 'send' })
  expect(sent.prompts).toEqual(['run only the settings tests'])
  expect(sent.commands).toEqual([])
  expect(await ui.find({ type: 'Input' })).toBeUndefined()
  await ui.unmount()
})

test('desktop: text typed into the card is the draft, and a slash prompt runs its command', async ($, on) => {
  const sent = world(on, { surface: 'desktop', answers: ['/code-review the settings page'] })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await $.turn.complete(TURN)
  await until('the field', async () => (await ui.find({ key: 'draft' })) !== undefined)
  expect((await ui.find({ key: 'draft' }))?.props.value).toBe('/code-review the settings page')
  await ui.input({ key: 'draft', text: '/code-review the settings page' })
  expect(sent.commands).toEqual(['/code-review the settings page'])
  expect(sent.prompts).toEqual([])
  await ui.unmount()
})

test('a subagent turn and a short answer raise no card, and a closed card leaves the band empty', async ($, on) => {
  const sent = world(on, { surface: 'desktop', answers: [null] })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await $.turn.complete({ ...TURN, agentId: 'agent-1' })
  await $.turn.complete({ ...TURN, answer: 'Done.' })
  expect(sent.forks).toBe(0)

  await $.turn.complete(TURN)
  await until('the card', () => sent.cards.length === 1)
  await until('the band to clear', async () => (await ui.find({ type: 'Text' })) === undefined)
  expect(await ui.find({ type: 'Input' })).toBeUndefined()
  expect(await ui.find({ type: 'Button' })).toBeUndefined()
  expect(sent.forks).toBe(1)
  expect(sent.prompts).toEqual([])
  await ui.unmount()
})

test('without the card the band offers the suggestions, and a press goes on to the field', async ($, on) => {
  const sent = world(on, { surface: 'desktop', hasCard: false })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })

  await $.turn.complete(TURN)
  await until('the buttons', async () => (await ui.find({ key: 'pick1' })) !== undefined)
  expect((await ui.findAll({ type: 'Button' })).map(button => button.key)).toEqual([
    'pick1',
    'pick2',
    'dismiss',
  ])
  await ui.press({ key: 'pick2' })
  expect((await ui.find({ key: 'draft' }))?.props.value).toBe('/code-review high')
  expect(sent.prompts).toEqual([])
  await ui.unmount()
})
