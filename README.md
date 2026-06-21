# トレメシ

「トレメシ」は、筋トレ後や減量中などの相談内容に合わせて、CSVデータに基づく食事・プロテイン候補を選ぶブラウザゲームです。

## 公開 URL

- ゲーム: <https://chameleonjp.codeberg.page/toremeshi/>
- 他のゲーム: <https://chameleonjp.codeberg.page/chameleonjp_lab/>

## 実装状況

- `index.html` にブラウザゲーム本体を実装済みです。
- 出題データは相談文形式の `data/questions_v2_100.csv` を読み込みます（旧 `data/questions_v1_100.csv` は参考として残置）。
- 開始時に世界観イントロ画面を表示し、その後に 3 秒カウントダウンを表示します。
- 15 問出題し、正解・惜しい・不正解、回答時間、連続正解数からスコアを計算します。
- Supabase の共通 RPC `submit_score` / `get_best_score_ranking` を使用してランキングを送受信します。
- Supabase URL は共通仕様の `https://mlpnjgezrnhdxsxolyzj.supabase.co` を使用します。
- ランキング送信 payload は `p_display_name`, `p_game_slug`, `p_score`, `p_client_version` を使用します。

## データファイル

```text
data/
  questions_v2_100.csv  # 現行ロード対象（相談文形式）
  questions_v1_100.csv  # 旧版（参考用に残置）
  foods_v1.csv
  protein_models_v1.csv
  protein_choice_extras_v1.csv
  problem_type_rules_v1.json
  choice_generation_rules_v1.json
  references_v1.json
docs/
  source_policy.md
  game_implementation_plan_and_codex_request_v1.md
  game_implementation_fix_plan_v2.md
```

## 判定方針

プロのトレーナー試験にも使えるように、ゲームとしての分かりやすさより、根拠の正しさを優先します。

正解判定は、次の順で見ます。

1. 安全条件
2. 問題タイプごとの正解条件
3. 1食分の栄養素数値
4. 食品タグ
5. 解説できるかどうか

タグだけで正解にしません。
たとえば「ホエイだから正解」「ソイだから不正解」のようには扱いません。

## 重要な注意

`data/foods_v1.csv` の栄養素数値は、現時点では標準モデル値を含むドラフトです。

試験で使う前に、次を必ず行います。

1. 文部科学省の食品成分データベースで単品食品を確認する
2. 加工食品・外食風セットは標準モデル値として出典と計算式を残す
3. プロテインは実在ブランドではなく、問題文に出す標準モデル値だけで判定する
4. `nutrition_value_status` を `final_verified` に変えてから正解根拠に使う

## このリポジトリで扱わないこと

鉄欠乏の診断、摂食障害、低エネルギー利用可能性の診断、疾患別の栄養指導、サプリメント処方は扱いません。
必要な場合は、医師または管理栄養士への相談を促す問題文にします。
