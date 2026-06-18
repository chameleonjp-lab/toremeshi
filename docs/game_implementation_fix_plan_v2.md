# トレメシ 実装修正計画書 v2

作成日: 2026-06-18  
対象リポジトリ: `chameleonjp-lab/toremeshi`  
対象ファイル: `index.html`  
前提計画書: `docs/game_implementation_plan_and_codex_request_v1.md`

## 0. この文書の目的

この文書は、更新後の `index.html` を、前回のゲーム実装計画書 v1 とカメレオンJP共通仕様に照らし合わせ、残っている課題を直すための修正計画書です。

今回の修正では、次のデータは変更しません。

```text
data/questions_v1_100.csv
data/foods_v1.csv
data/protein_models_v1.csv
data/protein_choice_extras_v1.csv
data/problem_type_rules_v1.json
data/choice_generation_rules_v1.json
```

CSV/JSONの列名、ID、表示名、栄養素数値、正解・惜しい・不正解の関係は変えません。

## 1. 現在できていること

更新後の `index.html` では、前回の大きな問題はかなり直っています。

```text
- index.html 1ファイルでゲーム本体が作られている
- data/questions_v1_100.csv を読んでいる
- data/foods_v1.csv を読んでいる
- data/protein_models_v1.csv を読んでいる
- data/protein_choice_extras_v1.csv を読んでいる
- data/problem_type_rules_v1.json を読んでいる
- validation_status=passed かつ version=v1.0_final の問題だけ使っている
- 1プレイ15問になっている
- F01〜F09を各1問以上出す作りになっている
- 4択をシャッフルしている
- 正解1、惜しい2、不正解1の構造を保持している
- 回答後に4択の理由を表示している
- スコア式は計画書どおりになっている
- ranking_scores への直接POSTは消えている
- submit_score と get_best_score_ranking を使う形になっている
- Three.js の静的importは消えている
- リタイアボタンは消えている
- 「他のゲームで遊ぶ」のリンク先は実験場トップになっている
```

## 2. 残っている課題

### 課題1. Supabase URLが共通仕様と違う

以前の `index.html` では旧プロジェクトURLを使っていましたが、カメレオンJP共通仕様では次を使う前提です。

```js
const SUPABASE_URL = "https://mlpnjgezrnhdxsxolyzj.supabase.co";
```

このままだと、公開用キーやRPCの向き先がずれ、ランキング送信・取得が失敗する可能性があります。

修正方針:

```text
- SUPABASE_URL を共通仕様の値にそろえる
- Publishable key は共通仕様の値を使う
- secret key / service_role key は絶対に入れない
```

### 課題2. 共通定数が不足している

共通仕様では、ゲーム側に次の定数を置く形です。

```js
const GAME_SLUG = "toremeshi";
const CLIENT_VERSION = "toremeshi_v20260618_01";
const SUPABASE_URL = "https://mlpnjgezrnhdxsxolyzj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "...";
const LAB_URL = "https://chameleonjp.codeberg.page/chameleonjp_lab/";
```

現在は `GAME_SLUG` と `LAB_URL` が定数化されておらず、`toremeshi` や実験場URLが関数内に直接書かれています。

修正方針:

```text
- GAME_SLUG を追加する
- LAB_URL を追加する
- GAME_URL を残す
- CLIENT_VERSION は日付入りにする
- submit_score と get_best_score_ranking は GAME_SLUG を参照する
- 他のゲームで遊ぶリンクは LAB_URL を参照する
```

### 課題3. 名前保存のキーと文字数が共通仕様とずれている

現在は `localStorage` のキーが `toremeshi_player` です。共通仕様では、ゲームごとに分かるキーを使います。

修正方針:

```js
const NAME_STORAGE_KEY = `chameleonjp_${GAME_SLUG}_player_name`;

function normalizeDisplayName(value) {
  return String(value || "").trim().slice(0, 10);
}
```

また、現在は20文字まで入ります。ランキング画面で崩れにくくするため、10文字程度にそろえます。

### 課題4. Supabase連携が共通仕様の実装例と違う

現在は、SupabaseのREST APIへ直接 `fetch` しています。RPC名は正しいですが、共通仕様では `@supabase/supabase-js` を読み込み、`supabaseClient.rpc()` を使う形です。

修正方針は次のどちらかです。

```text
A案: 共通仕様どおり supabase-js を使う
B案: REST直叩きを正式に許可するなら、共通仕様側にもその方針を書く
```

今回は共通仕様へ合わせるため、A案を採用します。

ただし、Supabaseライブラリの読み込みに失敗しても、ゲーム本体は遊べるようにします。失敗するのはランキング送信だけにします。

### 課題5. ランキング送信状態の表示が弱い

共通仕様では、結果画面に「送信中」「成功」「失敗」を表示します。現在は、送信開始時に画面がすぐ「ランキング送信中...」へ更新されません。

また、送信は成功したがランキング取得だけ失敗した場合でも、「ランキング送信または取得に失敗しました」と表示される作りです。これだと、実際に記録が入ったのか分かりにくくなります。

修正方針:

```text
- submit_score 開始時に「ランキング送信中...」を表示する
- submit_score 成功時に「ランキングへ送信しました。」を表示する
- get_best_score_ranking 失敗時は「送信は成功しましたが、ランキング取得に失敗しました。」のように分ける
- 結果画面はSupabaseエラーでも消さない
```

### 課題6. `choice_generation_rules_v1.json` を読んでいない

前回の計画書では、Codexに必ず読むファイルとして `data/choice_generation_rules_v1.json` を指定しています。現在の `index.html` はこのファイルを読み込んでいません。

初期実装では、このファイルを正解判定に使う必要はありません。ただし、計画書の「必ず読む」に合わせるなら、読み込み対象へ入れ、開発用検証やコメントで使えるようにします。

修正方針:

```text
- FILES に choiceRules を追加する
- loadData で data/choice_generation_rules_v1.json を読み込む
- validation_required の count 情報が読める場合は、開発用確認に使う
- 正解・惜しい・不正解の役割を再判定する処理は入れない
```

### 課題7. 解説画面で「自分の回答」が分かりにくい

計画書では、回答後に「正解の選択肢名」と「自分が選んだ選択肢名」を表示します。現在は正解名は表示されていますが、自分が選んだ選択肢名が明確な見出しとして出ていません。

修正方針:

```text
- 「あなたの回答: 〇〇」を出す
- 「正解: 〇〇」を出す
- 選んだ選択肢にも見た目上の印を付ける
```

### 課題8. 4択ごとの役割ラベルが色に寄りすぎている

計画書では、色だけでなく「正解」「惜しい」「不正解」という文字も表示するように決めています。現在はボタンの色と理由文で分かる形ですが、各選択肢に役割ラベルが明確に付いていません。

修正方針:

```text
- 4択すべての理由リストで、各行の先頭に「正解」「惜しい」「不正解」を付ける
- 例: 「正解: 鶏むね肉＋ごはん — 理由...」
- 色だけに頼らない
```

### 課題9. 結果画面に「ゲーム終了」ボタンがない

共通仕様では、結果画面に「もう一度」「結果をシェア」「ゲーム終了」「他のゲームで遊ぶ」を置く形です。現在は「結果をシェア」「他のゲームで遊ぶ」「もう一度プレイ」はありますが、「ゲーム終了」がありません。

修正方針:

```text
- 「ゲーム終了」ボタンを追加する
- 押すとホーム画面へ戻す
- ランキング送信は二重送信しない
```

### 課題10. スマホ操作対策が少し足りない

現在も横スクロール対策は入っています。ただし、共通仕様では、`maximum-scale=1`、`user-scalable=no`、`overscroll-behavior`、`button, a` の `touch-action` なども入れる形です。

修正方針:

```text
- viewport を共通仕様に寄せる
- button だけでなく a にも touch-action: manipulation を付ける
- html, body に -webkit-text-size-adjust と overscroll-behavior を追加する
- 端末幅320px〜390pxで横スクロールしないことを確認する
```

### 課題11. 実験場と詳細ランキングへの登録確認が残っている

ゲーム本体だけでは公開完了ではありません。共通仕様では、Supabase `public.games` に登録し、実験場トップと詳細ランキングで表示されることまで確認します。

修正方針:

```text
- public.games に game_slug=toremeshi の登録があるか確認する
- なければ登録用SQLをチャットに出す
- 実験場トップにカードが出ることを確認する
- ranking.html?game=toremeshi が開くことを確認する
- 1回プレイ後、トップランキングと詳細ランキングに出ることを確認する
```

SQLは、ファイルではなくチャットにコピペできる形で出します。

## 3. 修正優先度

### 優先度A: 公開前に必ず直す

```text
1. Supabase URLを共通仕様にそろえる
2. GAME_SLUG / LAB_URL / NAME_STORAGE_KEY を追加する
3. Supabase連携を共通仕様の形にそろえる
4. ランキング送信状態を送信中・成功・取得失敗に分ける
5. 解説画面に「あなたの回答」と選択肢ごとの役割ラベルを出す
6. public.games 登録と実験場表示を確認する
```

### 優先度B: できれば同時に直す

```text
1. choice_generation_rules_v1.json を読み込む
2. 結果画面に「ゲーム終了」ボタンを追加する
3. スマホ操作対策を共通仕様に寄せる
4. CLIENT_VERSION を日付入りにする
```

### 優先度C: 検証で確認する

```text
1. 15問抽選を複数回実行し、F01〜F09が必ず出ることを確認する
2. 同じ question_id が重複しないことを確認する
3. 同じ problem_type が3連続しないことを確認する
4. 正解1、惜しい2、不正解1の構造が崩れないことを確認する
5. CSV/JSONの差分がないことを確認する
```

## 4. Codex向け修正依頼

以下をCodexに渡してください。

```text
対象リポジトリ:
https://github.com/chameleonjp-lab/toremeshi

まず次のファイルを読んでください。

- docs/game_implementation_plan_and_codex_request_v1.md
- docs/game_implementation_fix_plan_v2.md
- data/questions_v1_100.csv
- data/foods_v1.csv
- data/protein_models_v1.csv
- data/protein_choice_extras_v1.csv
- data/problem_type_rules_v1.json
- data/choice_generation_rules_v1.json

目的:
更新後の index.html は大枠では動いていますが、共通仕様と照合するとまだ修正点があります。CSV/JSONを壊さず、index.html を修正してください。

最重要:
- data/*.csv を変更しない
- data/*.json を変更しない
- CSV列名、ID、表示名、栄養素数値を変更しない
- 正解・惜しい・不正解の関係を変更しない
- public.scores を使わない
- ranking_scores を使わない
- secret key / service_role key を使わない
- ランキング登録ボタンを置かない

修正内容:
1. SUPABASE_URL を共通仕様の `https://mlpnjgezrnhdxsxolyzj.supabase.co` にそろえる。
2. GAME_SLUG、LAB_URL、NAME_STORAGE_KEY、normalizeDisplayName を追加する。
3. CLIENT_VERSION を `toremeshi_v20260618_01` のような日付入りにする。
4. Supabase連携を共通仕様に合わせる。submit_score と get_best_score_ranking を使う。
5. 送信中、送信成功、ランキング取得失敗を分けて結果画面に出す。
6. data/choice_generation_rules_v1.json も読み込む。ただし、正解判定の再計算には使わない。
7. 解説画面に「あなたの回答: 〇〇」と「正解: 〇〇」を明確に出す。
8. 4択すべての理由に「正解」「惜しい」「不正解」の文字ラベルを付ける。
9. 結果画面に「ゲーム終了」ボタンを追加する。
10. viewport とCSSのスマホ操作対策を共通仕様へ寄せる。
11. 15問抽選の検証結果を報告する。
12. CSV/JSONに差分がないことを報告する。

実装後に必ず報告してください。

- 変更したファイル一覧
- git diff --stat
- grep -n "SUPABASE_URL\|GAME_SLUG\|NAME_STORAGE_KEY\|submit_score\|get_best_score_ranking\|ranking_scores\|public.scores\|choice_generation_rules\|あなたの回答\|ゲーム終了\|service_role" index.html の結果
- 15問抽選の確認結果
- CSV/JSONを変更していないこと
- public.games 登録の有無
- 実験場トップ表示の確認結果
- 詳細ランキング表示の確認結果
- 最新コミットSHA
```

## 5. 完了条件

この修正は、次がすべて満たされた時に完了です。

```text
- index.html だけが修正されている
- CSV/JSONに差分がない
- Supabase URLが共通仕様と一致している
- GAME_SLUG=toremeshi が定数化されている
- submit_score で終了時に1回だけ自動送信する
- get_best_score_ranking でランキングを取得する
- 送信中・成功・失敗が結果画面に出る
- 解説画面で自分の回答と正解が明確に分かる
- 4択すべてに役割ラベルと理由が出る
- 15問で終了する
- F01〜F09が必ず1回以上出る
- 同じ question_id が重複しない
- iPhone SE級の幅で横スクロールしない
- public.games に登録されている
- 実験場トップと詳細ランキングでトレメシが表示される
```
