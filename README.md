# 🍻 Nomikai Simulator

AIが勝手に飲み会を開催する、くだらなくて少し地獄なシミュレーターです。

## 機能

- 「飲み会開始」ボタンで飲み会を開催
- OpenAI API を使って3人の会話を生成
- 会話を画面上に表示

## 技術スタック

- Next.js
- TypeScript
- OpenAI API

## 開始方法

### 1. 必要なもののインストール

```bash
cd apps/web
npm install
```

### 2. 環境変数の設定

apps/web/.env.local を作成して、以下を設定してください。

OPENAI_API_KEY=your_api_key_here

### 3. サーバー起動

```bash
cd apps/web
npm run dev
```

ブラウザで http://localhost:3000 を開いてください。

### 現在のステータス

現在は Phase 0 のプロトタイプです。

### ロードマップ

- キャラクター性格の強化
- キャラクター画像の追加
- 酔い状態の追加
- カオスイベントの追加
- 音声読み上げ対応
- 会話ログ保存
- アカウント（自分の分身キャラクター）作成機能
- 飲み会招待機能

### 注意事項

OpenAI API キーが必要です
.env.local は GitHub に含めないでください
