# 共通仕様後続（PR 16）

対象確認: 2026-11-02 JST。旧PR head `41c68545983b9eab43a840bbbbc1ac6dc99dd264` / main `afd9de9b80e4a22c8f0c7119b7f4bb6b76096710` を起点とする。過去の `common-spec-publication.md` は着手時点の記録であり、本書と検証結果が今回の差分を示す。

## 対象・正本・変更しないもの

- 実験場の current active DB / 実表示カードで登録確認済み。2026-11-01 15:44:51 UTC の公開UI証拠はトレメシのタイトルを確認（プレイの実機検証ではない）。公開先: <https://chameleonjp.codeberg.page/toremeshi/>。
- 既存GitHub: <https://github.com/chameleonjp-lab/toremeshi>、作業先: <https://github.com/chameleonjp-lab/toremeshi/pull/16>。新repo・新規登録・公開フラグ変更なし。
- 実カード詳細: <https://chameleonjp-lab.github.io/chameleonjp_lab/ranking.html?game=toremeshi>。`toremeshi`、F01–F09、問題/候補ID、全100問CSV、正解1/惜しい2/不正解1、15問、制限時間なし、採点式は維持。
- 採点: 正解1000 + max(0, 300 − floor(回答秒×20)) + min(連続正解−1,4)×50。不正解/惜しいで連続リセット。解説や言語は正誤判定に使わない。既存の栄養値・安全条件・ゲーム内モデル値を医学的に新規検証したとは扱わない。
- コード正本はGitHub。Codebergへの反映、正式URL切替、実験場DB変更、ランキングSQL適用、PRマージ、本番テスト送信は実施していない。

## 実装単位

### 名前・結果・通信

ホームの名前を任意にし、入力名と記録が公開されること、空欄でも遊べることを明記。名前入力中のIME確定 (`isComposing` / `keyCode=229`) では開始しない。旧 `chameleonjp_toremeshi_player_name` キーを継続し、変更/消去は次の開始へ適用する。

開始時に名前、参加可否、game、client version、submission UUIDを固定。確定結果は別々の `toremeshi:receipts:v1:<UUID>` に全統計を保持する。次のプレイで未送信を切り捨てず、ホームから同UUID/同payloadで再送する。破損エントリは削除せず個別に除外し、別の正常結果を妨げない。保存例外・容量不足は未保存として表示し、再読み込み後も残るとは断言しない。安全なUUIDが作れない場合は公開送信だけ保留する。

normal共通RPC `submit_score_once_shared_v1` のみを使用し、非冪等 `submit_score` へfallbackしない。正本は実験場PR43 commit `b06135ee60006b2ca2c9d177e2497077bcb5fb48` の `docs/chameleonjp-lab/sql/common-score-receipt-v1.sql`。その9列1行応答を検証し、accepted trueのみ送信済みとする。UUIDは再送IDであり、独立した本人識別IDではない。

**未完了・依存**: そのRPCは直近DB確認時点では未適用。本人の承認済みDB作業が完了するまで送信は失敗/保留となり、結果表示/匿名閲覧は継続する。既存name-key識別（同名別人/改名同一人）および独立参加者の厳密な30人集計は未解決。これをフロント側name dedupや新しい採点で代用しない。旧スコア/参加者を初期化・削除・新IDへ勝手に関連付けない。

### ランキング

名前なし/あり両方が結果一覧を取得可能。`get_best_score_ranking(p_game_slug:'toremeshi',p_limit:30)` を維持し、同名行を除去しない。サーバー `rank` / `rank_no` を使用、同点1,1,3を連番へ変更しない。不明の順位や全参加人数を推測しない。取得中/空/失敗/再試行は送信状態とは分離し、古い通信の応答/失敗は新しい取得状態を上書きしない。送信成功後に再取得する。

### 言語・表示

サイノメ `79b1e5733e725cd1148b10fa5699ba846e2bf57d` の15言語IDを参照。ホームから言語を選択し、保存選択→対応ブラウザ言語→英語の順で使用。言語変更はホームに限定し、開始済みの問題抽選・時間・スコア・送信を変えない。全UI、動的テンプレート、エラー、共有、問題100問/選択肢/理由/説明を辞書で表示する。問題の原文ID、CSVや判定は翻訳しない。翻訳の自然さ・難易度同等性の母語/実機受入は未確認。

### 効果音

音源はブラウザ内の短いsine波のみ。初回オン・音量0.18、保存済みオフ/0を尊重。`toremeshi:sound:v1` を使用（着手時に既存音声設定/効果音は見つからなかった）。利用者操作で初期化/再開を試み、失敗しても進行する。hidden/中断/ミュートで声を停止・切断し、復帰時に蓄積音を再生しない。70ms以内の重複を抑制し、同時に一つの短い音だけを鳴らす。

|イベント|役割/条件|重複抑止/実装|
|---|---|---|
|開始|homeの明示開始操作|`startGame`前のstart音|
|カウントダウン|各実カウント|`countdown`、hidden無音|
|正解/惜しい/不正解|確定したroleの区別|`answer`のstate guard、先に判定されたroleのみ|
|次の相談|実際の遷移操作|`exitNext`、同frame抑止|
|結果|15問終了|`renderResult`、結果表示が正本|
|戻る|introからhome|cancel、音量オフなら無音|

音だけで正解を知らせず既存の結果テキストも保持する。実音量の聴感確認、iPhone音復帰の実機確認は未実施。

## 13項目対応表

|項目|区分と残件|
|---|---|
|1 対象判定|現登録/Codeberg公開UI確認済み。GitHub公開切替は未実施|
|2 既存維持|原CSV/ID/判定/採点維持。全15問固定dataテストあり|
|3 GitHub正式化|既PR公開workflowあり。新公開URL/同一機能の本番確認と導線切替は未完、Codeberg維持|
|4 多言語|15言語（UI179＋問題/説明136キー）を実装・全辞書統合済。母語品質/難易度の実機受入未確認|
|5 任意名/再送|開始snapshot・guest公開0・保存再送を実装。独立参加者ID/本番RPCは未完|
|6 ランキング|匿名取得/詳細導線/読取状態/同点順位を実装。独立30人はbackend依存未完|
|7 X共有|既PRの黒白・本人intent・コピー代替を継承、共有文も翻訳。勝手な名前/順位なし|
|8 効果音|実イベントのみ新実装。実音の聴感評価未確認|
|9 設定維持|初回on/保存off0・hidden/interrupted停止の自動検査。iPhone実機未確認|
|10 文言/画面|任意名告知・home設定・長文wrap/IME対応。実機表示受入未確認|
|11 自動公開|既PRのPR非deploy/merge同commit検証後deployを維持、公開allowlistに必要module追加。Pages設定/本番確認未完|
|12 検証|mock/ローカル自動/CIは下欄。実機/翻訳自然さ/本番を実施済みにしない|
|13 成果物|同じDraft PR16へ統合予定。ユーザーがmerge、適用順・rollbackは下記|

## 適用順・復元・実機確認

1. このDraft PRのレビュー/CI結果を確認する。関連DB receipt契約の適用は別の本人承認作業。identity方針も別判断。
2. Settings → Pages → Source: GitHub Actions、github-pages環境のmain許可などは既存設定を本人が確認する。既存保護/承認を解除しない。
3. 本人がPRをmainへmerge。検証/ビルド成功した同一commitのみ既存workflowで配信。こちらはmerge/deployを実行しない。
4. 実際のPages page_urlとbuild-info.json commit、全必要fileの配信、名前なし/あり、X/ランキング、設定保持を確認してから、実験場/Codeberg案内の切替用変更を別途適用する。確認前のURL推測/強制転送は不可。
5. 別originのlocalStorageは自動で引き継がれない。旧originのname/設定/未送信結果は削除せず、本人が確認できる移行案を別作業として保持する。
6. 不具合時は本人がPR commitをrevertする通常PRを作り、旧Codeberg導線を維持する。スコア/端末保存を一括削除しない。新receiptを旧非冪等経路へ再送しない。

iPhone 17 Pro Safariで: 縦/横/キーボード表示中に任意名と設定/開始を確認→日本語変換確定で開始しない→guest15問→結果/共有キャンセル/ランキング→再挑戦→初回音と保存off/0→X/画面ロックから復帰し古い音が出ない→長い翻訳/名前/30行一覧をスクロール可能、を確認する。ブラウザengine自動テストは実機受入の代わりではない。

## 最終検証

2026-11-02 03:01 JST ローカル検査:
- `npm test`: 42件成功。各15言語で実100問データから15問を通し、全正解22000点不変/匿名公開0を確認（DOM stub。実ブラウザではない）。
- `python scripts/test-pages.py`: 8件成功（壊れたsyntaxのnegative fixtureは意図した失敗を検査）。
- `python scripts/prepare-pages.py`: 明示allowlistの13 runtime filesを検証・stage。`git diff --check` 成功。
- 全15辞書は各UI179/data136キー、非空、placeholder、HTMLヘッダ構造を照合。`locales.mjs` 321690 bytes / SHA-256 `c16e8c45c5a5aef64965a13182a7b14adf8184db90208985acaa714f466b8a5e`。
- 旧data10ファイルは全byte不変。固有ID・数値・CSV内容を変更していない。
- ネット/保存/音と用語ラベルの独立レビュー実施、音disconnect例外/不正ランキング応答を修正・回帰追加。
- ローカルPlaywrightはChromium executable未存在で起動前に停止。`--list`でChromium/WebKit計32シナリオの収集は確認。ブラウザ実行はPR CIの別ゲートであり、収集成功を動作成功とは扱わない。全外部通信を遮断しSupabase importだけmockへ置換するテストで、本番スコアは送らない。

PR CIの最終結果はPRのexact head checkを参照。本書時点では本番公開/実機/母語品質/独立参加者契約まで完了したとは扱わない。
