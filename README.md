# DreamCampus to Calendar

iOS ショートカット経由で受け取った **イベント JSON** から
ブラウザだけで一括 **.ics** ファイルを生成する React + Vite 製アプリです。
受け渡しに失敗したり内容を調整したい場合は、Web UI 上で貼り付け・編集してから出力できます。

## 特徴
| 機能 | 説明 |
|------|------|
| クリップボード読込 | `navigator.clipboard.readText()` 対応。テキストボックスへの貼り付けも可 |
| URL 渡し | `?data=` クエリに UTF-8 Base64 文字列を入れると自動読込 |
| 欠落補完 UI | 日付と時刻、科目名が必須。その他が空欄なら黄色で警告しつつ ICS 生成可 |
| 自動分類 | `DESCRIPTION` 内のキーワードから **対面 / zoom / オンデマ** を推定し、DESCRIPTION を編集すると自動で再判定 |
| LOCATION 抽出 | `/ ○○室 /` パターンを正規表現で抜き出し、DESCRIPTION 変更時にも反映 |
| DESCRIPTION 保持 | 改行をそのままエスケープして ICS の `DESCRIPTION` に反映 |
| 完全 Frontend | **ics-js** を用いてクライアント側で .ics テキストを生成 → Blob → ダウンロード |
| 場所未入力許可 | 対面でも場所が空の場合は黄色で警告。空欄のままでも ICS 作成可能 |
| 編集内容反映 | テーブルで補った予定もそのまま ICS に反映 |
| 補完後も有効 | JSON で欠けていた項目を後から入力しても出力に反映 |
| 追加 | JSON に無い予定をテーブルから新規に追加可能 |
| ローカル保存 | 編集内容を自動保存し、次回アクセス時に復元 |

## iOS ショートカットの流れ
1. 時間割ページを共有シートから [ショートカット](https://www.icloud.com/shortcuts/7f518145f2c14b918b009dae2c71463e) を実行
2. JavaScript がページ上で走り時間割を JSON 化
3. 生成した JSON を UTF-8 で Base64 化し、URL エンコードして `?data=` 付きで本アプリを開く
   (例: `encodeURIComponent(btoa(unescape(encodeURIComponent(json))))`)
4. ページ読み込み時に `data` パラメータを自動解析。無い場合はクリップボードを読込

## 使い方
1. [iOS ショートカット](https://www.icloud.com/shortcuts/7f518145f2c14b918b009dae2c71463e) を実行すると本アプリが自動で開き、予定が入力されます
2. そのまま **カレンダーに追加** を押せますが、受け渡しに失敗したり内容を調整したい場合は Web UI で貼り付け・編集してください
3. 予定を確認したら **カレンダーに追加** ボタンで .ics を取得できます。編集内容は自動保存されます

## ショートカットキー
| キー | 動作 |
|------|------|
| `Ctrl`/`⌘` + `Shift` + `V` | クリップボード読込 |
| `Ctrl`/`⌘` + `N` | 行を追加 |
| `Ctrl`/`⌘` + `Enter` | カレンダーに追加 |
| `Ctrl`/`⌘` + `Shift` + `D` | 全データ削除 |
| `Esc` | 編集画面を閉じる |

## 開発コマンド
```bash
npm i          # 依存解決
npm run dev    # ローカルサーバ
npm run build  # 本番ビルド (dist/)
npm run preview # dist/ 内容を確認
```
