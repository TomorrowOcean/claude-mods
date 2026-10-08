# claude-mods

我自己在用的 Claude Code mod，整理成一個 plugin marketplace 方便分享。

## 內容

兩個 mod 做的是同一件事：每一輪回覆結束後，建議最多三個下一步 prompt，選一個會寫進輸入框成為可編輯的草稿，不會自動送出。差別在建議用哪一種卡片顯示。請擇一安裝。

| Mod | 說明 |
| --- | --- |
| [next-steps-appcard](next-steps-appcard/README.md) | 在輸入框上方畫一張自己的卡片，可收合，預設只佔一列。回合照常結束，不理它也能直接打字。 |
| [next-steps-askcard](next-steps-askcard/README.md) | 用 Claude 向你提問時的那張原生卡片顯示。回合會等你回答或關掉卡片才結束。 |

## 選哪一個

| | next-steps-appcard | next-steps-askcard |
| --- | --- | --- |
| 卡片 | mod 自己畫的，可收合，預設只佔一列 | Claude 提問時用的原生卡片 |
| 可點範圍 | 只有每個建議的標題列 | 整個選項 |
| 自行輸入 | 沒有，直接在輸入框打字 | 有 `Other…` |
| 回合結束 | 正常結束，建議在之後幾秒出現 | 等你回答或關掉卡片才結束 |
| 等待期間 | 可以不理它，照常打字送出 | 對話顯示執行中，你打的訊息要排隊 |
| 完成通知 | 準時 | 延到你回答卡片之後 |
| 背景工作進行中 | 照常建議 | 不跳卡片，等該工作結束的回合 |
| 終端機 | 應該能用；設計給桌面版 App，沒特別測試 | 應該能用；設計給桌面版 App，沒特別測試 |

- 想要不打擾、可以忽略的建議，選 **next-steps-appcard**。
- 想要跟 Claude 提問一樣的卡片，而且每一輪都會處理它，選 **next-steps-askcard**。

兩個不要同時安裝，否則每一輪會算兩次建議、出現兩張卡片。

next-steps-askcard 在叫不出原生卡片的環境會改畫 next-steps-appcard 的那張卡片。

## 安裝

以下以 Claude 桌面版 App 為例，直接請 Claude 幫你裝。請先把 App 更新到最新版，這兩個 mod 需要較新的版本才能載入。

1. 用上面的比較表選好要裝哪一個，複製它的資料夾連結：
   - next-steps-appcard：`https://github.com/TomorrowOcean/claude-mods/tree/main/next-steps-appcard`
   - next-steps-askcard：`https://github.com/TomorrowOcean/claude-mods/tree/main/next-steps-askcard`
2. 打開桌面版 App 的 Code 分頁，開一個新對話，選哪個資料夾都可以。
3. 貼上下面的提示詞，把最後一行換成你選的連結，然後送出。
4. Claude 執行安裝指令前會請你確認，按允許。
5. 裝好之後再開一個新對話，mod 從新對話開始生效。

提示詞參考：

```text
幫我安裝這個 Claude Code mod：
https://github.com/TomorrowOcean/claude-mods/tree/main/next-steps-appcard
```

怎麼確認有生效：在新對話裡等 Claude 回覆完一則較長的訊息。裝 next-steps-appcard 的話，輸入框上方會出現一列 `What next?`，點 `▸` 展開；裝 next-steps-askcard 的話，回覆結束時會跳出提問卡片。

之後想換成另一個，請 Claude 先移除目前這個，再照同樣的方式安裝另一個。

## 授權

MIT，見 [LICENSE](LICENSE)。

兩個 mod 都改自 Thariq Shihipar 的 [next-steps](https://github.com/anthropics/claude-plugins-community/tree/main/next-steps) 1.0.0（MIT），改成用卡片顯示建議、在每個標籤下顯示完整 prompt，並略過 subagent 的回合。
