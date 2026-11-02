# トレメシ 固定SNS画像と共有確認

## 画像
- `assets/social-card.png`: 1200×630、125588 bytes、SHA-256 `6cf073adc876df0305d082b21270edf6ee08b5b438ba01dfbd12807b3e9283dd`。
- 匿名開始した実際の相談文・4択と、既存の相談相手3D表示を等比配置し、紹介題字だけを追加した固定画像。問題、選択肢、栄養値、正解、3Dモデルを新作・改変していない。プレイヤー名・個別記録は含めない。
- 相談相手は、現リポジトリに任意のtrainer.glbが無いため、ゲームが元から備えるプリミティブのフォールバック。実素材の待機文を本出題と取り違えないよう、回答可能になった後の画面を採用した。
- 素材はcommit `5dfb9c47e5c213d43284ca6f28ad2667fbdf3c72`、[CI41424877867](https://github.com/chameleonjp-lab/toremeshi/actions/runs/41424877867)、artifact13131237378。Chromiumで通常のカウントダウン・登場待ち後に取得し、時計を書き換えていない。

## 共有・保存
- 15言語のホーム/結果の共有文末は `#トレメシ #ゲーム制作`。既本文・今回の得点/正解数・正式URLを維持する。
- 通常画面にコピー専用ボタンは元から無い。Xを開けない場合のコピーdialogは維持する。
- OG/Twitterは同じ画像と正式Codeberg URLを参照。公開allowlistに画像1点のみ追加し、開発用テスト・素材原本・組版SVGは公開しない。
- 問題データ、採点、参加者ID、既存記録、音・名前・言語の保存は不変更。

## 確認
- 既存unit53件に画像/タグ/公開allowlist3件と可視geometry6件を追加。画像・タグ等は未実装時3失敗から成功へ。公開ステージ内の全runtimeファイルも元bytesと一致検査する。
- 最終共有検査は全15言語縦＋ja/en/de横、Chromium/WebKitでホーム/結果を実際にタップする。黒白、44px、全rect/祖先clip/透明/中心hit、1タップ1intent、共有本文、今回の得点保持を確認する。代表24PNGを保存して実見する。最終CI結果はPRに記録する。
- 検査用画面は全通信をローカル応答/拒否し、WSとSWも遮断。匿名で15問の実ルールを通る。最終共有テストでは既存e2eと同様に待ち時間を短縮するため、所要時間や実機性能の受入ではない。素材撮影はこの短縮を使わない。
- 素材取得成功だけで最終製品CI成功とはしない。iPhone Safari実機、正式ページへの配信、X本番カードのキャッシュは別確認。

## 適用順と戻し方
1. 本人がDraftの現在headを確認し、mainへマージする。PR/作業branchでは検査のみ。既mainだけが従来のPages upload/deploy対象で、一時作業branchのpush対象はDraft前に外す。
2. OG/Twitter画像URLだけは既に配信を確認済みのGitHub Pages `https://chameleonjp-lab.github.io/toremeshi/assets/social-card.png` を指定する。既indexは2026-11-02 03:41 UTC時点HTTP200、main `5d995c2e207212be6ea9c18a3ab4454711d9fc7e` と全文一致、実配備run41373041493の環境URLでも確認。新しい画像は本人マージ後の配信待ちであり、現時点で到達済みとはしない。canonical/共有URL/登録は変更しない。
3. 正式URL `https://chameleonjp.codeberg.page/toremeshi/` でHTML/画像の配信を別途確認する。GitHubマージだけでCodebergへ届くとは断定しない。登録切替や公開設定変更はこの変更に含めない。
4. iPhone Safariでホーム/結果のX、戻った後の結果保持を確認する。X投稿は本人が確定する。
5. 戻す場合はこのPR差分をrevertし既存の公開手順で扱う。記録・設定・DBを消去しない。

結果は必要に応じてスクロールして共有へ到達する受入で、結果全体が一画面に収まるとの保証ではない。
