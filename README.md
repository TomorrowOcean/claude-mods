# claude-mods

我自己在用的 Claude Code mod，整理成一個 plugin marketplace 方便分享。

## 內容

| Mod | 說明 |
| --- | --- |
| [next-steps](next-steps/README.md) | 每一輪回覆結束後，在輸入框上方用一張仿提問卡片的卡片建議最多三個下一步 prompt。點一個（終端機可按 1、2、3）會寫進輸入框成為可編輯的草稿，終端機和桌面 app 都能用。 |

## 安裝

在終端機執行：

```bash
claude plugin marketplace add TomorrowOcean/claude-mods
```

```bash
claude plugin install next-steps@tomorrowocean-mods
```

也可以在 Claude Code 裡用 `/plugin marketplace add TomorrowOcean/claude-mods`，再從 `/plugin` 選單安裝 `next-steps`。

next-steps 是 function-hooks plugin，需要支援 function hooks 的較新版 Claude Code。

## 更新

```bash
claude plugin marketplace update tomorrowocean-mods
```

```bash
claude plugin update next-steps@tomorrowocean-mods
```

## 授權

MIT，見 [LICENSE](LICENSE)。

next-steps 改自 Thariq Shihipar 的 [next-steps](https://github.com/anthropics/claude-plugins-community/tree/main/next-steps) 1.0.0（MIT）。這份改成卡片外觀、在每個標籤下顯示完整 prompt，並略過 subagent 的回合。
