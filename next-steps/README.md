# next-steps

After each turn, suggests up to three next prompts in a card above the input box. The card is drawn to look like the one Claude asks you questions with.

```
╭──────────────────────────────────────╮
│  Next steps  What next?              │
│                                      │
│ 1: Run the tests                     │
│    run the tests you just wrote      │
│                                      │
│ 2: Review the diff                   │
│    /code-review high                 │
│                                      │
│ 0: dismiss                           │
╰──────────────────────────────────────╯
```

Each option is one suggestion: a short label you click (or press `1`, `2`, `3` in the terminal) over the prompt it stands for. `0` or the close mark dismisses the card. It sits above the input box and takes nothing over: ignore it and type as usual.

This copy is [next-steps](https://github.com/anthropics/claude-plugins-community/tree/main/next-steps) 1.0.0 by Thariq Shihipar (MIT), with the card look, the prompt shown under each label, and a subagent's turn skipped.

## After you pick

The prompt is written into the input box as a draft, in the terminal and in the desktop app. Edit it, then send it yourself. The plugin never sends a prompt on its own.

In the terminal the top suggestion also shows as the box's dim ghost text, so Tab takes it.

Where a session has no input box a plugin can write, the draft opens in a field above it instead, with `send` and `back`.

## Why it is not the real question card

The engine has a call that raises the real card (`$.ui.ask`), and version 1.2.0 used it. The desktop app treats that card as a question asked in the middle of a turn: once it is answered the app shows the session as thinking and waits for the turn to finish. Raised after a turn, there is no turn to finish, so the session stays shown as running until the next message. Drawing the card here avoids that.

## How it works

It is a function-hooks plugin (`hooks/register.tsx`):

- `turn.complete`: forks the session with `$.model.fork` to ask for likely next prompts. The fork shares the session's prompt cache, so it costs about one short reply. A subagent's turn is skipped.
- `$.command.list`: the session's skills and slash commands (plugin, user and MCP ones with their descriptions) go into the fork's question, so a suggestion can be `/skill arguments`. A suggestion that names a command the session does not have is dropped.
- `ui.render` on `AbovePrompt`: draws the card, on the terminal and the desktop app.
- A press calls `$.prompt.fill`; the top suggestion goes to `$.prompt.suggest`.
- Where the fill is refused for want of an input box, the band draws an `Input` with the prompt. Its send calls `$.prompt.submit` with `asUser`, or `$.command.run` for a known command.
- `turn.start`: takes the card down.

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `minAnswerChars` | `80` | Skip suggestions after answers shorter than this |
| `suggestSkills` | `true` | Tell the suggester which skills and slash commands the session has |

## Tests

```
claude plugin test <this folder>
```
