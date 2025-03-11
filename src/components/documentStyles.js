// documentStyles.js
// 文書変換用のスタイル設定を集約したファイル - 複数ページ対応強化

export const styles = {
    // PDF形式用のスタイル - 複数ページ対応強化
    pdfStyles: `
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
      
      body { 
        font-family: 'Noto Sans JP', 'ヒラギノ角ゴ Pro W3', 'Hiragino Kaku Gothic Pro', Osaka, メイリオ, Meiryo, 'ＭＳ Ｐゴシック', 'MS PGothic', sans-serif; 
        line-height: 1.6;
        /* 固定サイズ文書 */
        width: 210mm;
        margin: 0 auto;
        padding: 10mm;
        box-sizing: border-box;
        /* 自動的な高さ計算を許可 */
        height: auto !important;
        min-height: 297mm;
      }
      
      h1, h2, h3, h4, h5, h6 {
        font-weight: bold;
        margin-top: 16px;
        margin-bottom: 8px;
        page-break-after: avoid; /* 見出しの後で改ページしない */
      }
      
      h1 { 
        font-size: 24px;
        page-break-before: always; /* 新しいh1では常に改ページ */
        counter-reset: section;    /* セクション番号をリセット */
      }
      
      h1:first-of-type {
        page-break-before: avoid; /* 最初のh1は改ページしない */
      }
      
      h2 { 
        font-size: 20px;
        counter-reset: subsection; /* サブセクション番号をリセット */
      }
      
      h3 { font-size: 18px; }
      
      p { 
        margin-bottom: 16px; 
        orphans: 3; /* 段落の先頭に最低3行を残す */
        widows: 3;  /* 段落の末尾に最低3行を残す */
      }
      
      ul, ol { 
        margin-left: 24px;
        margin-bottom: 16px;
        page-break-inside: avoid; /* リスト内で改ページしない */
      }
      
      li {
        page-break-inside: avoid; /* リスト項目内で改ページしない */
      }
      
      table {
        border-collapse: collapse;
        width: 100%;
        margin-bottom: 16px;
        page-break-inside: avoid; /* テーブル内で改ページしない */
      }
      
      th, td {
        border: 1px solid #ccc;
        padding: 8px;
      }
      
      th {
        background-color: #f0f0f0;
      }
      
      img {
        max-width: 100%;
        height: auto;
        page-break-inside: avoid; /* 画像内で改ページしない */
      }
      
      pre, blockquote {
        page-break-inside: avoid; /* コードブロックと引用内で改ページしない */
      }
      
      /* 明示的な改ページ制御 */
      .page-break-before {
        page-break-before: always;
      }
      
      .page-break-after {
        page-break-after: always;
      }
      
      .page-break-avoid {
        page-break-inside: avoid;
      }
      
      /* 人為的な改ページ挿入用 */
      .page-break {
        display: block;
        height: 0;
        page-break-after: always;
        margin: 0;
        border: 0;
      }
      
      /* PDFヘッダーフッター用のスタイル */
      @page {
        size: A4;
        margin: 10mm;
      }
      
      /* モバイルでの表示用 */
      @media screen and (max-width: 900px) {
        body {
          width: 210mm;
          padding: 20mm;
          margin: 0 auto;
          min-width: 210mm;
          overflow-x: auto;
        }
      }
    `,
  
    // HTML出力用のスタイル - 複数ページ対応強化
    htmlStyles: `
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
      
      :root {
        --text-color: #333333;
        --background-color: #ffffff;
        --link-color: #0066cc;
        --heading-color: #111111;
        --border-color: #cccccc;
        --page-width: 800px;
        --page-padding: 40px;
        --page-margin: 0 auto;
      }
      
      html {
        font-size: 16px;
      }
      
      body {
        font-family: 'Noto Sans JP', 'ヒラギノ角ゴ Pro W3', 'Hiragino Kaku Gothic Pro', 'メイリオ', 'Meiryo', sans-serif;
        line-height: 1.6;
        color: var(--text-color);
        background-color: var(--background-color);
        margin: var(--page-margin);
        padding: var(--page-padding);
        width: var(--page-width);
        box-sizing: border-box;
      }
      
      /* モバイルデバイスでも固定レイアウトを保持 - 余白を増やす */
      @media screen and (max-width: 900px) {
        body {
          width: var(--page-width);
          padding: 60px;  /* スマホでの余白を増加 */
          margin: var(--page-margin);
          min-width: var(--page-width);
          overflow-x: auto;
        }
      }
      
      h1, h2, h3, h4, h5, h6 {
        color: var(--heading-color);
        line-height: 1.3;
        margin-top: 24px;
        margin-bottom: 12px;
        page-break-after: avoid; /* 見出しの後で改ページしない */
      }
      
      h1 { 
        font-size: 28px;
        page-break-before: always; /* 新しいh1では常に改ページ */
      }
      
      h1:first-of-type {
        page-break-before: avoid; /* 最初のh1は改ページしない */
      }
      
      h2 { font-size: 24px; }
      h3 { font-size: 20px; }
      
      p {
        margin-bottom: 16px;
        orphans: 3; /* 段落の先頭に最低3行を残す */
        widows: 3;  /* 段落の末尾に最低3行を残す */
      }
      
      a {
        color: var(--link-color);
        text-decoration: none;
      }
      
      a:hover {
        text-decoration: underline;
      }
      
      img {
        max-width: 100%;
        height: auto;
        page-break-inside: avoid; /* 画像内で改ページしない */
      }
      
      ul, ol {
        margin-left: 24px;
        margin-bottom: 16px;
        page-break-inside: avoid; /* リスト内で改ページしない */
      }
      
      li {
        margin-bottom: 8px;
        page-break-inside: avoid; /* リスト項目内で改ページしない */
      }
      
      table {
        border-collapse: collapse;
        width: 100%;
        margin-bottom: 16px;
        page-break-inside: avoid; /* テーブル内で改ページしない */
      }
      
      th, td {
        border: 1px solid var(--border-color);
        padding: 8px;
      }
      
      th {
        background-color: #f0f0f0;
        font-weight: bold;
      }
      
      code {
        font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
        background-color: #f5f5f5;
        padding: 3px 6px;
        border-radius: 3px;
        font-size: 14px;
      }
      
      pre {
        background-color: #f5f5f5;
        padding: 16px;
        border-radius: 5px;
        overflow-x: auto;
        page-break-inside: avoid; /* コードブロック内で改ページしない */
      }
      
      pre code {
        padding: 0;
        background-color: transparent;
      }
      
      blockquote {
        border-left: 4px solid #e0e0e0;
        margin-left: 0;
        padding-left: 16px;
        color: #666;
        page-break-inside: avoid; /* 引用内で改ページしない */
      }
      
      hr {
        border: none;
        border-top: 1px solid #e0e0e0;
        margin: 32px 0;
      }
      
      /* 明示的な改ページ制御 */
      .page-break-before {
        page-break-before: always;
      }
      
      .page-break-after {
        page-break-after: always;
      }
      
      .page-break-avoid {
        page-break-inside: avoid;
      }
      
      /* 人為的な改ページ挿入用 */
      .page-break {
        display: block;
        height: 0;
        page-break-after: always;
        margin: 0;
        border: 0;
      }
      
      /* 固定印刷設定 */
      @media print {
        body {
          width: 100%;
          padding: 0;
        }
        
        @page {
          margin: 20mm;
          size: A4;
        }
      }
    `,
  
    // ベーススタイル - 他のスタイルにインポートされる
    baseStyles: `
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
      
      :root {
        --text-color: #333333;
        --background-color: #ffffff;
        --link-color: #0066cc;
        --heading-color: #111111;
        --border-color: #cccccc;
        --page-width: 800px;          /* 固定幅 */
        --page-padding: 40px;         /* 固定パディング */
        --page-margin: 0 auto;        /* コンテンツを中央揃え */
      }
      
      html {
        font-size: 16px;
      }
      
      body { 
        font-family: 'Noto Sans JP', 'ヒラギノ角ゴ Pro W3', 'Hiragino Kaku Gothic Pro', 'メイリオ', 'Meiryo', sans-serif; 
        line-height: 1.6;
        color: var(--text-color);
        background-color: var(--background-color);
        margin: var(--page-margin);
        padding: var(--page-padding);
        width: var(--page-width);
        box-sizing: border-box;
      }
      
      /* モバイルでもレスポンシブ調整を防止 - 余白を増やす */
      @media screen and (max-width: 900px) {
        body {
          width: var(--page-width);
          padding: 60px;  /* スマホでの余白を増加 */
          margin: var(--page-margin);
          min-width: var(--page-width);
          overflow-x: auto;
        }
      }
      
      /* 基本スタイルを追加 - 固定単位を使用 */
      h1, h2, h3, h4, h5, h6 {
        font-weight: bold;
        margin-top: 24px;
        margin-bottom: 12px;
        page-break-after: avoid; /* 見出しの後で改ページしない */
      }
      
      h1 { 
        font-size: 28px;
        page-break-before: always; /* 新しいh1では常に改ページ */
      }
      
      h1:first-of-type {
        page-break-before: avoid; /* 最初のh1は改ページしない */
      }
      
      h2 { font-size: 24px; }
      h3 { font-size: 20px; }
      
      p { 
        margin-bottom: 16px; 
        orphans: 3; /* 段落の先頭に最低3行を残す */
        widows: 3;  /* 段落の末尾に最低3行を残す */
      }
      
      ul, ol { 
        margin-left: 24px;
        margin-bottom: 16px;
        page-break-inside: avoid; /* リスト内で改ページしない */
      }
      
      li {
        page-break-inside: avoid; /* リスト項目内で改ページしない */
      }
      
      table {
        border-collapse: collapse;
        width: 100%;
        margin-bottom: 16px;
        page-break-inside: avoid; /* テーブル内で改ページしない */
      }
      
      th, td {
        border: 1px solid #ccc;
        padding: 8px;
      }
      
      th {
        background-color: #f0f0f0;
      }
      
      /* 明示的な改ページ制御 */
      .page-break-before {
        page-break-before: always;
      }
      
      .page-break-after {
        page-break-after: always;
      }
      
      .page-break-avoid {
        page-break-inside: avoid;
      }
      
      /* 人為的な改ページ挿入用 */
      .page-break {
        display: block;
        height: 0;
        page-break-after: always;
        margin: 0;
        border: 0;
      }
    `
  };