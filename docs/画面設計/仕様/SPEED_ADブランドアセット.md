# SPEED AD ブランドアセット

## 表示ルール

- 白背景では、カラーエンブレムと黒ワードマークを使用する。
- 暗背景では、白シルエットエンブレムと白ワードマークを使用する。
- ヘッダーとフッターは1行ワードマークを使用する。
- ログインLPのヒーローは、決定済み1文字SVGのパスから生成した専用Webフォントを2行で使用する。表示文字は実テキストとし、`SPEED AD`として選択・コピーできる状態を維持する。
- ヒーローの文字サイズはデスクトップで最大140px（画面幅に応じて可変）とし、公式字形を維持したまま文字間を光学調整する。タブレットとモバイルは専用のレスポンシブ値を使用する。
- ヒーロー用Webフォントは公式パスと送り幅を維持し、各グリフの未使用幅を左右のサイドベアリングへ均等に配分する。文字選択時も輪郭が選択範囲の中央に見える状態を保つ。
- 文字ペアごとの光学調整はOpenType GPOSの`kern`機能へ収録する。CSSの一律な`letter-spacing`には依存せず、生成時に1行目の折返し幅を`speed-ad-wordmark.css`へ同時出力する。
- ヒーローでは、フォントメトリクスから算出したブロック全体の補正と1行目だけのインデントを使用し、`SPEED`、`AD`、後続コピーの見える左端を揃える。文字列を1文字単位のHTML要素には分割しない。
- faviconはカラーエンブレムを使用する。
- ロゴの比率、パス、配色を変更しない。影、縁取り、グラデーションは追加しない。

## 配信アセット

| 用途 | ファイル名 |
| --- | --- |
| カラーエンブレム | `speed-ad-emblem-color.svg` |
| 白エンブレム | `speed-ad-emblem-white.svg` |
| 黒・1行ワードマーク | `speed-ad-wordmark-horizontal-black.svg` |
| 白・1行ワードマーク | `speed-ad-wordmark-horizontal-white.svg` |
| 黒・2行ワードマーク | `speed-ad-wordmark-stacked-black.svg` |
| 白・2行ワードマーク | `speed-ad-wordmark-stacked-white.svg` |
| 選択可能なヒーロー用ワードマークフォント | `fonts/speed-ad-wordmark.woff2` |
| favicon | `speed-ad-favicon.svg` |

配信単位が異なるため、同一内容を次の3ディレクトリに配置する。

- `img/brand/`
- `02_dashboard/assets/svg/brand/`
- `05_support/assets/img/brand/`

## 更新方法

最新SVGフォルダーを引数に指定し、次を実行する。

```powershell
node scripts/sync-brand-assets.mjs "<最新SVGフォルダー>"
```

スクリプトは指定フォルダー直下の決定済み4ファイルのみを読み込み、ワードマークの白背景 `rect` を除去して透過版を作成する。実行時に、3配信領域のハッシュ一致も検証する。実行時のネットワーク共有参照は行わない。

ヒーロー用Webフォントを更新する場合は、ビルド専用依存関係を用意してから同じ最新SVGフォルダーを指定する。

```powershell
python -m pip install "fonttools[woff]"
python scripts/build-brand-font.py --source-dir "<最新SVGフォルダー>" --output fonts/speed-ad-wordmark.woff2
```

フォント生成では、最新SVGフォルダー配下の `決定フォント_１文字ごと【07.基本】ブラックスタイル` にある決定済みA・D・E・P・Sのパスだけを使用する。フォントにはブランド名の描画に必要な5文字と空白のみを収録し、本文やボタンなどのUIフォントには使用しない。生成物は固定タイムスタンプを持ち、同じ正本から同一ハッシュで再生成できる。
