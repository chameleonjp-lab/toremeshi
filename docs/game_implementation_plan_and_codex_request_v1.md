# トレメシ ゲーム実装計画書・Codex依頼 v1

作成日: 2026-06-16  
対象リポジトリ: `chameleonjp-lab/toremeshi`  
対象ゲーム: `トレメシ`  
公開予定URL: `https://chameleonjp.codeberg.page/toremeshi/`

## 0. この文書の目的

この文書は、トレメシを `index.html` 1ファイルのスマホ向けブラウザゲームとして実装する前に、読み込むデータ、15問出題、解説、スコア、ランキング、Codexへの依頼内容を固定するための計画書です。

この段階では、食品データやプロテインデータの数値を再計算しません。既存のCSV/JSONをそのまま読み込み、まずは「問題文」「4択」「正解」「解説」「問題タイプ」を使って遊べる形にします。

## 1. 実装で使うデータ形式

### 1.1 読み込むファイル

実装では、次の4つを読み込み対象にします。

```text
data/questions_v1_100.csv
data/foods_v1.csv
data/protein_models_v1.csv
data/protein_choice_extras_v1.csv
```

初期実装で主に使うのは `questions_v1_100.csv` です。食品・プロテイン側のCSVは、選択肢IDの存在確認、栄養詳細の補助表示、将来の問題自動生成のために読みます。

### 1.2 `questions_v1_100.csv` の実装用契約

CSV列名は変更しません。実装では、最低限、次の列を使います。

```text
question_id
version
problem_type
question_text
correct_choice_id
correct_choice_name
near_miss_choice_1_id
near_miss_choice_1_name
near_miss_choice_1_reason
near_miss_choice_2_id
near_miss_choice_2_name
near_miss_choice_2_reason
wrong_choice_id
wrong_choice_name
wrong_reason
validation_status
validation_notes
```

ブラウザ内では、1問を次の形へ変換します。

```js
{
  questionId: "Q001",
  version: "v1.0_final",
  problemType: "F01",
  text: "問題文",
  choices: [
    { id: "food_xxx", name: "表示名", role: "correct", reason: "正解理由" },
    { id: "food_yyy", name: "表示名", role: "near_miss", reason: "惜しい理由" },
    { id: "protein_zzz", name: "表示名", role: "near_miss", reason: "惜しい理由" },
    { id: "food_www", name: "表示名", role: "wrong", reason: "不正解理由" }
  ]
}
```

`questions_v1_100.csv` には、惜しい理由と不正解理由は列として入っています。一方で、正解理由専用の列はまだありません。そのため初期実装では、正解理由は次の順で作ります。

1. `problem_type_rules_v1.json` の `explanation_basis` が読める場合は、その内容を短く表示する。
2. 読めない場合は「この条件では、最も目的に合う選択肢です。」と表示する。

### 1.3 食品・プロテインCSVの扱い

`foods_v1.csv`、`protein_models_v1.csv`、`protein_choice_extras_v1.csv` は、初期実装では正解判定の再計算に使いません。

使う目的は次の3つに限定します。

1. `choice_id` が実在するか確認する。
2. 結果や解説で、必要なら栄養素の補助表示を出す。
3. 将来、100問を自動生成する時の材料として残す。

重要な禁止事項は次です。

```text
- CSVの列名を変えない。
- 栄養素の数値を変えない。
- IDを変えない。
- 表示名を勝手に変えない。
- 正解・惜しい・不正解の役割を実装側で再判定しない。
```

### 1.4 CSVパーサー

実装では、簡易的な `split(',')` だけでCSVを処理しないでください。将来、問題文や解説にカンマが入っても壊れないように、ダブルクォート対応のCSVパーサーを `index.html` 内に実装します。

外部ライブラリ、npm、ビルド工程は使いません。

## 2. 15問出題仕様

### 2.1 基本ルール

1プレイは15問です。100問すべてを一度には出しません。

出題対象は次の条件を満たす問題だけです。

```text
version = v1.0_final
validation_status = passed
problem_type = F01〜F09 のいずれか
```

同じ `question_id` は1プレイ中に重複して出しません。

### 2.2 問題タイプの偏り防止

F01〜F09をできるだけ均等に見せます。

15問の内訳は次のルールで作ります。

1. F01〜F09から各1問ずつ、合計9問を先に選ぶ。
2. 残り6問は、F01〜F09全体からランダムに選ぶ。
3. ただし、1プレイ内で同じ問題タイプは最大3問までにする。
4. 同じ問題タイプが連続しないように並び替える。
5. どうしても足りない場合だけ、連続を許す。ただし同じタイプ3連続は禁止する。

これにより、毎回15問でもF01〜F09が一通り出ます。

### 2.3 選択肢の表示順

各問題の4択は、出題時に毎回シャッフルします。

ただし、内部データでは必ず次の役割を保持します。

```text
correct: 1つ
near_miss: 2つ
wrong: 1つ
```

画面上では、正解の位置が毎回同じにならないようにします。

### 2.4 画面の進行

画面状態は次の順で進めます。

```text
タイトル画面
↓
名前入力
↓
3.2.1 カウント
↓
問題画面 1/15
↓
回答後の解説画面
↓
次の問題
↓
結果画面
↓
ランキング表示
```

名前は開始前に必須です。ゲーム終了時は自動でスコアを送信します。ランキング登録ボタンは置きません。

## 3. 回答後の解説表示仕様

### 3.1 解説の目的

トレメシの価値は、正解を当てることだけではなく、惜しい選択肢がなぜ惜しいか、不正解がなぜ違うかを理解できることです。

そのため、回答直後に必ず解説を表示します。

### 3.2 表示内容

回答後は、次の内容を出します。

```text
- 正解 / 不正解
- 正解の選択肢名
- 自分が選んだ選択肢名
- 問題タイプ（F01〜F09）
- 正解理由
- 惜しい選択肢2つの理由
- 不正解選択肢の理由
- 次へボタン
```

### 3.3 解説文の出し方

各選択肢には、役割ラベルを付けます。

```text
正解: この条件では最も合う
惜しい: 一部は合うが、主条件が足りない
不正解: 今回の目的と明確に合わない
```

画面では、色だけで判別させません。必ず「正解」「惜しい」「不正解」という文字も表示します。

### 3.4 回答後の操作制限

回答後は、同じ問題の選択肢を押せないようにします。

次の問題へ進むには、解説画面の「次へ」を押します。15問目の後は結果画面へ進みます。

## 4. スコア・ランキング仕様

### 4.1 スコアの考え方

スコアは、次の3つで作ります。

```text
正解数
回答速度
連続正解
```

栄養クイズなので、速度だけで勝てる設計にはしません。正解数を最優先にします。

### 4.2 点数式

1問ごとに、正解した場合だけ点数を加算します。

```text
正解基本点: 1000点
速度ボーナス: 0〜300点
連続正解ボーナス: 0〜200点
```

速度ボーナスは次の式にします。

```text
速度ボーナス = max(0, 300 - floor(回答秒数 × 20))
```

例です。

```text
3秒で正解: 240点
10秒で正解: 100点
15秒以上で正解: 0点
```

連続正解ボーナスは次の式にします。

```text
連続正解ボーナス = min(連続正解数 - 1, 4) × 50
```

例です。

```text
1問目の連続正解: 0点
2問連続: 50点
3問連続: 100点
4問連続: 150点
5問連続以上: 200点
```

不正解の場合は、その問題の点数は0点です。連続正解数も0に戻します。

### 4.3 結果画面で表示するもの

結果画面では、次を表示します。

```text
- スコア
- 正解数 / 15
- 正答率
- 合計回答時間
- 最大連続正解数
- 問題タイプ別の正誤
- ひとこと評価
- シェアボタン
- 他のゲームで遊ぶリンク
- ランキング
```

### 4.4 ランキング登録仕様

Supabase登録用の固定値は次の通りです。

```text
game_slug: toremeshi
title: トレメシ
game_url: https://chameleonjp.codeberg.page/toremeshi/
top_ranking_type: best
score_order: desc
score_unit: 点
score_scale: 1
score_decimals: 0
score_label: スコア
first_score_label: 初回スコア
best_score_label: 最高スコア
```

登録はゲーム終了時に1回だけ自動で行います。

使ってよいのは Supabase の公開用キーだけです。secret、service_role は使いません。`public.scores` は使いません。

## 5. 実装範囲

### 5.1 今回やること

```text
- index.html 1ファイルでゲーム画面を作る
- data/questions_v1_100.csv を読み込む
- data/foods_v1.csv を読み込む
- data/protein_models_v1.csv を読み込む
- data/protein_choice_extras_v1.csv を読み込む
- F01〜F09が偏りすぎない15問抽選を作る
- 回答後の解説画面を作る
- スコア計算を入れる
- 結果画面を作る
- Supabaseランキング送信と取得を入れる
- iPhone SE幅で横スクロールしないようにする
- シェア文の末尾にゲームURLを付ける
- 他のゲームで遊ぶリンクを置く
```

### 5.2 今回やらないこと

```text
- 食品データの数値変更
- プロテインデータの数値変更
- CSV列名変更
- 100問の再生成
- 栄養判定ロジックの再計算
- 医療・診断領域の助言
- ユーザーごとの食事指導
- ログイン機能
- 永続セーブ
- 複数ファイルのJavaScript分割
- npm / Node / build工程
```

## 6. 実装チェック項目

Codexは実装後、次を必ず確認します。

```text
- index.html が存在する
- data/questions_v1_100.csv の列名を変更していない
- data/foods_v1.csv の数値を変更していない
- data/protein_models_v1.csv の数値を変更していない
- data/protein_choice_extras_v1.csv の内容を変更していない
- 15問で終了する
- F01〜F09が1回以上出る
- 同じ question_id が1プレイ内で重複しない
- 4択が毎回表示される
- 正解1、惜しい2、不正解1の構造が壊れていない
- 回答後に4択すべての理由が出る
- 正解数、速度、連続正解からスコアが出る
- 終了時にランキング登録が1回だけ呼ばれる
- ランキング登録ボタンがない
- iPhone SE幅で横スクロールしない
- 3.2.1 カウントがある
- 他のゲームで遊ぶリンクがある
- シェア文末に https://chameleonjp.codeberg.page/toremeshi/ が入る
```

## 7. Codex向け実装依頼

以下をCodexに渡してください。

```text
あなたは、スマホ向けブラウザゲーム「トレメシ」の実装担当です。

対象リポジトリ:
https://github.com/chameleonjp-lab/toremeshi

目的:
既存のデータを壊さず、index.html 1ファイルで、筋トレ後の栄養クイズゲームを実装してください。

最重要:
今回、食品データ・プロテインデータ・100問データの再生成はしません。
CSV/JSONは既存データを正本として読み込みます。
データの列名、ID、表示名、栄養素数値、正解/惜しい/不正解の関係を勝手に変更しないでください。

必ず読むファイル:
- docs/game_implementation_plan_and_codex_request_v1.md
- data/questions_v1_100.csv
- data/foods_v1.csv
- data/protein_models_v1.csv
- data/protein_choice_extras_v1.csv
- data/problem_type_rules_v1.json
- data/choice_generation_rules_v1.json

実装するもの:
1. index.html 1ファイルでゲーム本体を作る。
2. data/questions_v1_100.csv を読み込み、validation_status=passed、version=v1.0_final の問題だけを使う。
3. 1プレイ15問にする。
4. F01〜F09を各1問以上出し、残り6問はランダムにする。
5. 同じ question_id は1プレイ内で重複させない。
6. 各問題の4択は毎回シャッフルする。
7. 回答後、正解・惜しい2つ・不正解1つの理由をすべて表示する。
8. 正解数、回答速度、連続正解からスコアを出す。
9. ゲーム終了時にSupabaseへスコアを1回だけ自動送信する。
10. ランキング登録ボタンは置かない。
11. 結果画面にランキング、シェア、他のゲームで遊ぶリンクを置く。
12. iPhone SE幅で横スクロールしない。
13. 3.2.1 カウントを入れる。

スコア仕様:
- 正解基本点: 1000点
- 速度ボーナス: max(0, 300 - floor(回答秒数 × 20))
- 連続正解ボーナス: min(連続正解数 - 1, 4) × 50
- 不正解は0点、連続正解数を0に戻す

Supabase登録用固定値:
- game_slug: toremeshi
- title: トレメシ
- game_url: https://chameleonjp.codeberg.page/toremeshi/
- top_ranking_type: best
- score_order: desc
- score_unit: 点
- score_scale: 1
- score_decimals: 0
- score_label: スコア
- first_score_label: 初回スコア
- best_score_label: 最高スコア

禁止事項:
- data/*.csv の列名変更
- data/*.csv の栄養素数値変更
- data/questions_v1_100.csv の正解関係変更
- npm / Node / build工程の追加
- JavaScriptファイル分割
- public.scores の利用
- secret key / service_role key の利用
- ランキング登録ボタンの追加
- 医療・診断の助言表示

実装前にやること:
- 現在のブランチと最新SHAを確認してください。
- 対象ファイルを読み、差分がない状態から始めてください。
- 既存データを変更しない方針を明記したうえで作業してください。

実装後に必ず報告すること:
- 変更したファイル一覧
- 実行した確認内容
- grep確認結果
- 15問抽選の確認結果
- CSV/JSONを変更していないこと
- コミットSHA

特に注意:
「対応した」と書くだけで、mainに反映されていない状態を避けてください。
必ず git status、git diff --stat、対象ファイルのgrep結果、コミットSHAを報告してください。
```
