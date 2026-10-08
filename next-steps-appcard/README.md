# next-steps-appcard

After each turn, suggests up to three next prompts in a card above the input box.

Its sibling [next-steps-askcard](../next-steps-askcard/README.md) shows the same suggestions in the card Claude asks you questions with, and holds the turn open until you answer. Install one of the two, not both.

```
What next?                          ▾ ✕
╭──────────────────────────────────────╮
│ 1: Run the tests                     │
│ run the tests you just wrote         │
╰──────────────────────────────────────╯
╭──────────────────────────────────────╮
│ 2: Review the diff                   │
│ /code-review high                    │
╰──────────────────────────────────────╯
```

Each small card is one suggestion: a short label you click (or press `1`, `2`, `3` in the terminal) over the prompt it stands for. Only the label is clickable. `✕` closes the card. It sits above the input box and takes nothing over: ignore it and type as usual.

The card starts collapsed to its title row:

```
What next?                          ▸ ✕
```

`▸` expands it and `▾` collapses it. Once you press either, later cards in the same session open the way you left the last one. A new session goes back to the `startCollapsed` option.

The app gives the area above the input box a fixed number of rows (12 in the desktop app) and scrolls what does not fit. To leave as many of them as it can to the prompts, the card has no frame around the whole and no blank rows between the small cards. Three suggestions still come to 13 rows, more when a long prompt wraps, so an expanded card of three scrolls a little.

The card is designed for the desktop app. It should work in the terminal too, but it has not been specially tested there.

This copy is [next-steps](https://github.com/anthropics/claude-plugins-community/tree/main/next-steps) 1.0.0 by Thariq Shihipar (MIT), with the card, the prompt shown under each label, and a subagent's turn skipped.

## After you pick

The prompt is written into the input box as a draft, in the terminal and in the desktop app. Edit it, then send it yourself. The plugin never sends a prompt on its own.

In the terminal the top suggestion also shows as the box's dim ghost text, so Tab takes it.

Where a session has no input box a plugin can write, the draft opens in a field above it instead, with `send` and `back`.

## Why it is not the real question card

The engine has a call that raises the card Claude asks you questions with (`$.ui.ask`), and version 1.2.0 used it (this mod was named next-steps until 1.5.0). The desktop app treats that card as a question asked in the middle of a turn: once it is answered the app shows the session as thinking and waits for the turn to finish. Raised after a turn, there is no turn to finish, so the session stays shown as running until the next message. Drawing the card here avoids that.

## How it works

It is a function-hooks plugin (`hooks/register.tsx`):

- `turn.complete`: forks the session with `$.model.fork` to ask for likely next prompts. The fork shares the session's prompt cache, so it costs about one short reply. A subagent's turn is skipped.
- `$.command.list`: the session's skills and slash commands (plugin, user and MCP ones with their descriptions) go into the fork's question, so a suggestion can be `/skill arguments`. A suggestion that names a command the session does not have is dropped.
- `ui.render` on `AbovePrompt`: draws the card, on the terminal and the desktop app.
- A press on a label calls `$.prompt.fill`; the top suggestion goes to `$.prompt.suggest`.
- Where the fill is refused for want of an input box, the band draws an `Input` with the prompt. Its send calls `$.prompt.submit` with `asUser`, or `$.command.run` for a known command.
- `turn.start`: takes the card down.

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `minAnswerChars` | `80` | Skip suggestions after answers shorter than this |
| `suggestSkills` | `true` | Tell the suggester which skills and slash commands the session has |
| `startCollapsed` | `true` | Show only the title row until you expand the card |

## Tests

```
claude plugin test <this folder>
```
