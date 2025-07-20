# DreamCampus-calendar

iOS ショートカットで抽出した **イベント JSON** から
ブラウザだけで一括 **.ics** ファイルを生成する React + Vite 製アプリです。

## 特徴
| 機能 | 説明 |
|------|------|
| クリップボード読込 | `navigator.clipboard.readText()` 対応。テキストボックスへの貼り付けも可 |
| 欠落補完 UI | 時刻・分類・場所が空欄ならセルを赤枠表示。全部埋めないと生成ボタン非活性 |
| 自動分類 | `DESCRIPTION` 内のキーワードから **対面 / zoom / オンデマ** を推定し、DESCRIPTION を編集すると自動で再判定 |
| LOCATION 抽出 | `/ ○○室 /` パターンを正規表現で抜き出し、DESCRIPTION 変更時にも反映 |
| DESCRIPTION 保持 | 改行をそのままエスケープして ICS の `DESCRIPTION` に反映 |
| 完全 Frontend | **ics-js** を用いてクライアント側で .ics テキストを生成 → Blob → ダウンロード |

## iOS ショートカットの流れ
1. 時間割ページを共有シートからショートカット実行
2. JavaScript がページ上で走り時間割を JSON 化
3. 生成した JSON をクリップボードへ自動コピー
4. 直後に本アプリの URL をブラウザで開く
5. 画面の指示に従い JSON を ⌘V で貼り付け → Web アプリ側で整形

## 使い方
1. iOS ショートカットを実行し、イベント JSON をクリップボードへコピー
2. 本アプリを開いてテキストボックスへ貼り付け（または **ペースト** ボタン）
3. 欠落セルを編集して **ICS 生成** → そのままカレンダーにインポート

## 開発コマンド
```bash
npm i          # 依存解決
npm run dev    # ローカルサーバ
npm run build  # 本番ビルド (dist/)
npm run preview # dist/ 内容を確認
```
