# next-steps

After each turn, suggests up to three next prompts in a question card, the same card Claude asks you questions with.

```
Next steps   What next?

  Run the tests
  run the tests you just wrote

  Review the diff
  /code-review high

  Other…
```

Each option is one suggestion: a short label over the full prompt. Pick one, or type your own under Other. Closing the card drops the suggestions.

This copy is [next-steps](https://github.com/anthropics/claude-plugins-community/tree/main/next-steps) 1.0.0 by Thariq Shihipar (MIT), changed to show the suggestions in the card and to work in the desktop app. The upstream version draws buttons above the prompt box and fills the terminal's prompt box, which the desktop app does not have.

## After you pick

The pick becomes a draft. It is never sent as picked.

- **In the terminal** it is written into the prompt box. Edit it, then press Enter yourself. The top suggestion also shows as the box's dim ghost text, so Tab takes it.
- **In the desktop app** the prompt box is the app's own, which a plugin cannot write, so the draft opens in a field above it:

  ```
  Next (edit, then send):
    [ run the tests you just wrote          ]
    [ send ]  [ back ]
  ```

  Edit it there, then press Enter in the field or click `send`. `back` raises the card again. A prompt that starts with a skill or slash command the session has (`/code-review high`) runs that command.

## Where no card can be raised

The suggestions fall back to buttons above the prompt box (`1`, `2`, `3`, and `0` or the close mark to dismiss), and the transcript says so in one dim line.

## How it works

It is a function-hooks plugin (`hooks/register.tsx`):

- `turn.complete`: forks the session with `$.model.fork` to ask for likely next prompts. The fork shares the session's prompt cache, so it costs about one short reply. A subagent's turn is skipped.
- `$.command.list`: the session's skills and slash commands (plugin, user and MCP ones with their descriptions) go into the fork's question, so a suggestion can be `/skill arguments`. A suggestion that names a command the session does not have is dropped.
- `$.ui.ask`: raises the card with the suggestions' labels. A plugin may not call the AskUserQuestion tool itself, and `$.ui.ask` takes labels alone, so a `ui.render` hook on `AskUserQuestion` adds each option's full prompt as its description.
- The answer goes to `$.prompt.fill`. Where that is refused for want of a prompt box, a `ui.render` hook on `AbovePrompt` draws an `Input` with the draft; its send calls `$.prompt.submit` with `asUser`, or `$.command.run` for a known command.
- `turn.start`: takes the suggestions down.

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `minAnswerChars` | `80` | Skip suggestions after answers shorter than this |
| `suggestSkills` | `true` | Tell the suggester which skills and slash commands the session has |

## Tests

```
claude plugin test <this folder>
```
