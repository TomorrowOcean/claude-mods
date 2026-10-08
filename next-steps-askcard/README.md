# next-steps-askcard

As each turn ends, suggests up to three next prompts in the question card, the same card Claude asks you questions with.

Its sibling [next-steps-appcard](../next-steps-appcard/README.md) draws the suggestions in a card of its own above the input box, and lets the turn end as usual. Install one of the two, not both.

```
Next steps   What next?

  Run the tests
  run the tests you just wrote

  Review the diff
  /code-review high

  Other…
```

Each option is one suggestion: a short label over the prompt it stands for. Pick one, or type your own under Other. Closing the card drops the suggestions.

It is designed for the desktop app. It should work in the terminal too, but it has not been specially tested there.

This copy is [next-steps](https://github.com/anthropics/claude-plugins-community/tree/main/next-steps) 1.0.0 by Thariq Shihipar (MIT), changed to show the suggestions in the card, with a subagent's turn skipped.

## The turn waits for the card

The card is raised while the turn is still stopping, and the turn ends once you answer or close it. Until then the session shows as running, and a message you type waits its turn.

It is done this way because of how the desktop app treats the card. The app is handed it as a question asked in the middle of a turn: once it is answered the app shows the session as thinking and waits for the turn to finish. An earlier version (next-steps 1.2.0) raised the card after the turn, so there was no turn left to finish and the session stayed shown as running until the next message. Raised before the turn ends, the turn's own end clears it.

next-steps-appcard avoids the same problem another way, by drawing a card of its own above the input box instead of raising the real one. That card is here too, as the fallback below.

## After you pick

At the turn's end the prompt is written into the input box as a draft, in the terminal and in the desktop app. Edit it, then send it yourself. The plugin never sends a prompt on its own.

Where a session has no input box a plugin can write, the draft opens in a field above it instead, with `send` and `back`.

## Where no card can be raised

After the turn the suggestions are drawn as a card above the input box, the one next-steps-appcard draws, and the transcript says so in one dim line:

```
╭──────────────────────────────────────╮
│ What next?                      ▾ ✕  │
│ ╭──────────────────────────────────╮ │
│ │ 1: Run the tests                 │ │
│ │    run the tests you just wrote  │ │
│ ╰──────────────────────────────────╯ │
│ ╭──────────────────────────────────╮ │
│ │ 2: Review the diff               │ │
│ │    /code-review high             │ │
│ ╰──────────────────────────────────╯ │
╰──────────────────────────────────────╯
```

Click a suggestion's label (or press `1`, `2`, `3` in the terminal) to take it; `✕` closes the card. It starts collapsed to its title row: `▸` expands it and `▾` collapses it, and later cards in the same session open the way you left the last one. This card takes nothing over: ignore it and type as usual. In the terminal the top suggestion also shows as the input box's dim ghost text, so Tab takes it.

## When no card is raised at all

- The answer is shorter than `minAnswerChars`.
- The turn stopped with background work still running: that is a pause, and the card waits for the turn that ends it.
- The turn already raised one (a stop hook sent it on and it stopped again).

## How it works

It is a function-hooks plugin (`hooks/register.tsx`):

- `classic.Stop`: as the main turn stops, forks the session with `$.model.fork` to ask for likely next prompts, raises the card with `$.ui.ask`, and only then lets the stop go on. The fork shares the session's prompt cache, so it costs about one short reply.
- `$.command.list`: the session's skills and slash commands (plugin, user and MCP ones with their descriptions) go into the fork's question, so a suggestion can be `/skill arguments`. A suggestion that names a command the session does not have is dropped.
- `ui.render` on `AskUserQuestion`: `$.ui.ask` takes labels alone, so this adds each option's prompt as its description.
- `turn.complete`: the pick goes to `$.prompt.fill`. Where that is refused for want of an input box, a `ui.render` hook on `AbovePrompt` draws an `Input` with the draft; its send calls `$.prompt.submit` with `asUser`, or `$.command.run` for a known command.
- `turn.start`: takes everything down.

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `minAnswerChars` | `80` | Skip suggestions after answers shorter than this |
| `suggestSkills` | `true` | Tell the suggester which skills and slash commands the session has |
| `startCollapsed` | `true` | Where the fallback card is drawn, show only its title row until you expand it |

## Tests

```
claude plugin test <this folder>
```
