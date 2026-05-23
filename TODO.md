# choice-two TODO
- [x] T001: src/popup.ts に popup骨格(選択肢カード表示 + 確定表示エリア)を構築
- [x] T1B: 保存は src/storage.ts の store(get/set/remove)経由に統一し、状態・ロジックは src/core/ に chrome.*/DOM 非依存で分離する(将来PWA移植のため)
- [x] T002: 選択肢カードのCRUD(絵文字/ことば、2〜4枚)を chrome.storage.local に保存・読込
- [x] T003: 子供がカードをタップ→大きく表示して確定する演出
- [x] T004: 選択肢セットを複数保存・切替(おやつ/あそび 等)
- [x] T005: 保護者/子供モード切替を簡易PIN(storage.local)で実装
- [x] T006: 起動時に storage.local から全状態を復元
- [x] T007: _locales ja/en を chrome.i18n で全UIに適用
- [x] T008: Premiumゲート(7日トライアル + Stripe Checkout URL)。無料はセット1つ・最大3枚、Premiumでセット無制限・最大6枚
- [x] T009: npm run build を通し ts/lint を解消
- [x] T010: release/choice-two.zip 生成(node_modules除外)
- [x] T011: legal/PRIVACY.md と TERMS.md 作成(外部通信なし・データ収集なし・医療効果を主張しない)

## 改良 v1_1
- [x] U001: 子供向けに見た目を整える(大きな絵文字・角丸・やさしい配色・大きめのタップ領域)
- [x] U002: アクセシビリティ(キーボード操作・十分なコントラスト・色だけに依存しない表現・aria-label)
- [x] U003: 空状態の案内文と、削除など破壊的操作の取り消し/確認を追加
- [x] U004: 状態保存の堅牢化(保存失敗時のフォールバック、壊れたデータの安全な無視)
- [ ] F001: 選んだ後に「きまり!」の確定演出と、もう一回/やりなおしボタン
- [ ] F002: 2択モードと4択モードを分かりやすく切替
- [ ] F003: セットごとに色テーマを設定
- [ ] F004: 選んだ結果を直近だけ振り返れる小さな履歴(任意・クリア可)
