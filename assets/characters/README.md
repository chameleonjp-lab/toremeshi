# キャラクターモデル置き場

ここに相談相手キャラクターの 3D モデルを置きます。

## 期待されるファイル

```
assets/characters/trainer.glb
```

`three-client.js` は起動時にこのパスを読みに行きます。

- **ファイルがある場合**: `GLTFLoader` で読み込み、`AnimationMixer` でアニメーションを再生します。
- **ファイルが無い／壊れている／WebGL が使えない場合**: コード内蔵の簡易キャラクター（プリミティブ製のトレーナー）に自動でフォールバックします。

どちらの場合でも、ゲーム本体（クイズ・スコア・ランキング）は常に通常どおり動作します。3D は補助演出であり、必須機能ではありません。

## モデル条件

| 条件 | 内容 |
| --- | --- |
| 形式 | `.glb` 推奨 |
| 体数 | 1 体 |
| 見た目 | 筋トレ・食事相談の文脈に合う人物 |
| ポリゴン数 | まずは軽量なもの |
| アニメーション | 最低 `idle` は必須。可能なら `thinking` / `happy` / `disappointed` も |
| ライセンス | 商用利用可・再配布条件を確認済みのもの（**ライセンス不明のモデルは使わない**） |

## アニメーションのクリップ名

`three-client.js` は次の候補名でクリップを探します（完全一致 → 大文字小文字無視の部分一致の順）。

| 状態 | クリップ名の候補 |
| --- | --- |
| idle | `idle`, `Idle`, `breathing`, `Breathing Idle` ほか |
| thinking | `thinking`, `Thinking`, `think`, `idea` ほか |
| happy | `happy`, `Happy`, `cheer`, `victory`, `jump` ほか |
| disappointed | `disappointed`, `sad`, `defeat`, `no` ほか |

見つからない状態は自動的に `idle` にフォールバックします。実際のクリップ名は、読み込み時にブラウザの Console へ `[three-client] GLB animation clips: [...]` として出力されるので、それを見て必要なら `three-client.js` の `CLIP_NAME_CANDIDATES` に追記してください。

## 差し替え手順

1. ライセンスを確認した `.glb` を `trainer.glb` という名前でこのフォルダに置く。
2. ブラウザを再読み込みする。
3. Console のクリップ名ログを確認し、必要なら候補名を追記する。
