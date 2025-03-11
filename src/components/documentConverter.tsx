import { useState } from 'react';
import { Document, Packer, Paragraph, HeadingLevel, TextRun, AlignmentType, BorderStyle, Spacing, TableCell, TableRow, Table } from 'docx';
import { DesignInfo } from '@/types/page';

// 変換オプションのインターフェース
interface ConversionOptions {
  format: 'pdf' | 'docx' | 'txt' | 'html' | 'markdown';
  fileName?: string;
  designInfo?: DesignInfo;
  preserveStyles?: boolean; // スタイル保持フラグを追加
}

// デザイン情報からCSSを生成する関数
function generateCssFromDesignInfo(designInfo: DesignInfo): string {
  if (!designInfo || !designInfo.cssRules) return '';

  return designInfo.cssRules.map(rule => 
    `${rule.selector} { ${Object.entries(rule.properties)
      .map(([key, value]) => `${key}: ${value};`)
      .join(' ')} }`
  ).join('\n');
}

// CSSの単位からpxに変換する関数
function convertToPx(value: string): number {
  const num = parseFloat(value);
  if (isNaN(num)) return 0;
  
  if (value.endsWith('px')) return num;
  if (value.endsWith('pt')) return num * 1.33;
  if (value.endsWith('em')) return num * 16;
  if (value.endsWith('rem')) return num * 16;
  if (value.endsWith('mm')) return num * 3.779528;
  
  return num;
}

// 色コードを取得する関数
function extractColor(style: CSSStyleDeclaration, property: string): string {
  const color = style.getPropertyValue(property);
  return color || '';
}

// スタイル情報を解析する関数
function parseElementStyles(element: HTMLElement): any {
  if (!element) return {};
  
  const computedStyle = window.getComputedStyle(element);
  
  return {
    fontSize: computedStyle.fontSize,
    fontFamily: computedStyle.fontFamily,
    fontWeight: computedStyle.fontWeight,
    color: extractColor(computedStyle, 'color'),
    backgroundColor: extractColor(computedStyle, 'background-color'),
    textAlign: computedStyle.textAlign,
    lineHeight: computedStyle.lineHeight,
    paddingTop: computedStyle.paddingTop,
    paddingRight: computedStyle.paddingRight,
    paddingBottom: computedStyle.paddingBottom,
    paddingLeft: computedStyle.paddingLeft,
    marginTop: computedStyle.marginTop,
    marginRight: computedStyle.marginRight,
    marginBottom: computedStyle.marginBottom,
    marginLeft: computedStyle.marginLeft,
    borderTop: computedStyle.borderTop,
    borderRight: computedStyle.borderRight,
    borderBottom: computedStyle.borderBottom,
    borderLeft: computedStyle.borderLeft,
  };
}
// 文書変換関数
export async function convertCorrectedDocumentToFile(
  correctedDocumentElement: HTMLElement, 
  options: ConversionOptions
): Promise<Blob> {
  // HTML2PDFをクライアントサイドでのみインポート
  let html2pdf: any;
  if (typeof window !== 'undefined') {
    try {
      html2pdf = (await import('html2pdf.js')).default;
    } catch (error) {
      console.error('html2pdf.js のインポートに失敗:', error);
      throw new Error('PDFライブラリの読み込みに失敗しました');
    }
  }

  const { 
    format, 
    fileName = '添削済み文書', 
    designInfo,
    preserveStyles = true // デフォルトでスタイルを保持
  } = options;

  // デザイン情報からCSSを生成
  const additionalStyles = designInfo ? generateCssFromDesignInfo(designInfo) : '';

  // クローンを作成して、差分表示用のspanを元のテキストに戻す
  const cleanedElement = correctedDocumentElement.cloneNode(true) as HTMLElement;
  cleanedElement.querySelectorAll('.diff-added, .diff-removed').forEach(el => {
    // 修正：要素を削除ではなく、テキストノードに置き換え
    const textContent = el.textContent || '';
    const newTextNode = document.createTextNode(textContent);
    el.parentNode?.replaceChild(newTextNode, el);
  });

  // デバッグログ
  console.debug('処理後のHTML:', cleanedElement.innerHTML);
  console.debug('処理後のテキスト:', cleanedElement.textContent);

  // 計算済みスタイルを取得して保存（スタイル保持が有効な場合）
  let elementStyles: Map<HTMLElement, any> = new Map();
  if (preserveStyles) {
    const allElements = cleanedElement.querySelectorAll('*');
    allElements.forEach((el) => {
      elementStyles.set(el as HTMLElement, parseElementStyles(el as HTMLElement));
    });
  }

  // HTML content をラップし、必要なスタイルを追加
  const fullHtmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
        
        body { 
          font-family: 'Noto Sans JP', 'ヒラギノ角ゴ Pro W3', 'Hiragino Kaku Gothic Pro', Osaka, メイリオ, Meiryo, 'ＭＳ Ｐゴシック', 'MS PGothic', sans-serif; 
          line-height: 1.6;
          max-width: 210mm;
          margin: 0 auto;
          padding: 20mm;
        }
        
        /* 基本スタイルを追加 */
        h1, h2, h3, h4, h5, h6 {
          font-weight: bold;
          margin-top: 1em;
          margin-bottom: 0.5em;
        }
        
        h1 { font-size: 1.8em; }
        h2 { font-size: 1.5em; }
        h3 { font-size: 1.3em; }
        
        p { margin-bottom: 1em; }
        
        ul, ol { 
          margin-left: 1.5em;
          margin-bottom: 1em;
        }
        
        table {
          border-collapse: collapse;
          width: 100%;
          margin-bottom: 1em;
        }
        
        th, td {
          border: 1px solid #ccc;
          padding: 0.5em;
        }
        
        th {
          background-color: #f0f0f0;
        }
        
        ${additionalStyles}
      </style>
    </head>
    <body>
      ${cleanedElement.innerHTML}
    </body>
    </html>
  `;
  // PDF変換 - スタイル保持を強化
  const convertToPdf = async (): Promise<Blob> => {
    if (!html2pdf) {
      throw new Error('html2pdf.js がロードされていません');
    }

    // PDF変換のオプションを拡張
    const pdfMargins = designInfo?.layout?.margins || { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' };
    
    return new Promise((resolve, reject) => {
      const opt = {
        margin: [
          convertToPx(pdfMargins.top) / 3.779528, // mmをpdfのポイントに変換
          convertToPx(pdfMargins.right) / 3.779528,
          convertToPx(pdfMargins.bottom) / 3.779528,
          convertToPx(pdfMargins.left) / 3.779528
        ],
        filename: `${fileName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          letterRendering: true,
          // CSSセレクタによる冗長スタイルを保持
          ignoreElements: (element: Element) => {
            return element.classList.contains('diff-removed');
          }
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait',
          // フォント埋め込みを有効化
          putTotalPages: true,
          // PDFのメタデータを設定
          title: fileName,
          compress: true
        },
        // 改ページ設定の改善
        pagebreak: { 
          mode: ['avoid-all', 'css', 'legacy'],
          before: '.page-break-before',
          after: '.page-break-after',
          avoid: '.page-break-avoid'
        }
      };

      try {
        html2pdf()
          .set(opt)
          .from(fullHtmlContent)
          .outputPdf('blob')
          .then((blob: Blob) => {
            resolve(blob);
          })
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  };
  // DOCX変換（修正版）- シンプル化して確実にテキストを含める
 // DOCX変換（段落反映版）
 const convertToDocx = async (): Promise<Blob> => {
  try {
    // HTMLからテキスト内容を安全に抽出
    const htmlContent = cleanedElement.innerHTML;
    
    // テキスト抽出の前にHTML構造をデバッグ
    console.debug('DOCX変換用のHTML:', htmlContent);
    
    // HTMLを解析してDOCX用の段落構造を抽出
    const paragraphStructure = extractParagraphStructure(cleanedElement);
    
    // 抽出した段落をデバッグ
    console.debug('抽出された段落構造:', paragraphStructure);
    
    // セクションとパラグラフを作成
    const docxParagraphs: Paragraph[] = [];
    
    // 各段落要素をDOCX段落に変換
    if (paragraphStructure.length > 0) {
      paragraphStructure.forEach(item => {
        switch (item.type) {
          case 'heading1':
            docxParagraphs.push(
              new Paragraph({
                text: item.text,
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 240, after: 120 }
              })
            );
            break;
          
          case 'heading2':
            docxParagraphs.push(
              new Paragraph({
                text: item.text,
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 100 }
              })
            );
            break;
          
          case 'heading3':
            docxParagraphs.push(
              new Paragraph({
                text: item.text,
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 160, after: 80 }
              })
            );
            break;
          
          case 'paragraph':
          default:
            docxParagraphs.push(
              new Paragraph({
                text: item.text,
                spacing: { before: 120, after: 120 }
              })
            );
            break;
        }
      });
    } else {
      // 段落構造が抽出できない場合は、テキスト全体を一つの段落として処理
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      const extractedText = tempDiv.textContent || '文書の内容を取得できませんでした';
      
      // テキストを空白行で分割して段落を作成
      const paragraphs = extractedText
        .split(/\n\s*\n/)
        .filter(p => p.trim())
        .map(p => p.trim());
      
      if (paragraphs.length > 0) {
        paragraphs.forEach(para => {
          docxParagraphs.push(
            new Paragraph({
              text: para,
              spacing: { before: 120, after: 120 }
            })
          );
        });
      } else {
        docxParagraphs.push(
          new Paragraph({
            text: extractedText,
            spacing: { before: 120, after: 120 }
          })
        );
      }
    }
    
    // DOCXドキュメントを作成
    const doc = new Document({
      title: fileName,
      description: 'Generated document',
      sections: [{
        properties: {},
        children: docxParagraphs
      }]
    });
    
    // DOCXファイルを生成
    return await Packer.toBlob(doc);
  } catch (error) {
    console.error('DOCX変換エラー:', error);
    
    // エラー時は最小限のドキュメントを返す
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            text: '文書の変換中にエラーが発生しました。',
            spacing: { before: 100, after: 100 }
          })
        ]
      }]
    });
    
    return await Packer.toBlob(doc);
  }
};

// HTML要素から段落構造を抽出する関数
function extractParagraphStructure(element: HTMLElement): Array<{type: string, text: string}> {
  const result: Array<{type: string, text: string}> = [];
  
  // 段落要素を抽出する関数
  function processParagraphElements(el: HTMLElement) {
    // ブロック要素を処理
    Array.from(el.children).forEach(child => {
      const tagName = child.tagName.toLowerCase();
      const text = child.textContent?.trim() || '';
      
      if (!text) return;
      
      // 要素タイプに基づいて段落タイプを決定
      switch (tagName) {
        case 'h1':
          result.push({
            type: 'heading1',
            text: text
          });
          break;
        case 'h2':
          result.push({
            type: 'heading2',
            text: text
          });
          break;
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          result.push({
            type: 'heading3',
            text: text
          });
          break;
        case 'p':
          result.push({
            type: 'paragraph',
            text: text
          });
          break;
        case 'div':
          // divの場合は子要素を再帰的に処理
          processParagraphElements(child as HTMLElement);
          break;
        case 'ul':
        case 'ol':
          // リスト項目を処理
          Array.from(child.querySelectorAll('li')).forEach(li => {
            result.push({
              type: 'paragraph',
              text: `• ${li.textContent?.trim()}`
            });
          });
          break;
        case 'table':
          // テーブルヘッダー
          const headers = Array.from(child.querySelectorAll('th')).map(th => th.textContent?.trim());
          
          // テーブル行
          const rows = child.querySelectorAll('tr');
          if (rows.length > 0) {
            // ヘッダーがある場合はテーブルタイトルとして追加
            if (headers.length > 0 && headers.some(h => h)) {
              result.push({
                type: 'heading3',
                text: 'テーブル'
              });
              
              result.push({
                type: 'paragraph',
                text: headers.join(' | ')
              });
            }
            
            // 各行を処理
            rows.forEach(row => {
              if (row.querySelectorAll('td').length > 0) {
                const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent?.trim());
                
                result.push({
                  type: 'paragraph',
                  text: cells.join(' | ')
                });
              }
            });
          }
          break;
        default:
          // その他のブロック要素も段落として処理
          if (text) {
            result.push({
              type: 'paragraph',
              text: text
            });
          }
          break;
      }
    });
  }
  
  // HTML構造から段落を抽出
  processParagraphElements(element);
  
  // 段落が抽出できない場合は、テキスト全体から段落を生成
  if (result.length === 0) {
    const fullText = element.textContent || '';
    
    // 空行でテキストを分割して段落を作成
    const paragraphs = fullText
      .split(/\n\s*\n/)
      .filter(p => p.trim())
      .map(p => p.trim());
    
    paragraphs.forEach(para => {
      result.push({
        type: 'paragraph',
        text: para
      });
    });
  }
  
  return result;
}
  // TXT変換（修正版）- シンプル化して確実にテキストを含める
 // TXT変換（段落反映版）
 const convertToTxt = (): Blob => {
  try {
    // HTMLからテキスト内容を安全に抽出
    const htmlContent = cleanedElement.innerHTML;
    
    // デバッグログ
    console.debug('TXT変換用のHTML:', htmlContent);
    
    // テキストを整形する
    let formattedText = '';
    
    // HTML構造から段落を抽出
    const paragraphStructure = extractParagraphStructureForTxt(cleanedElement);
    console.debug('抽出された段落構造:', paragraphStructure);
    
    // 段落構造からTXT形式のテキストを生成
    if (paragraphStructure.length > 0) {
      paragraphStructure.forEach(item => {
        switch (item.type) {
          case 'heading1':
            formattedText += item.text.toUpperCase() + '\n';
            formattedText += '='.repeat(item.text.length) + '\n\n';
            break;
          
          case 'heading2':
            formattedText += item.text + '\n';
            formattedText += '-'.repeat(item.text.length) + '\n\n';
            break;
          
          case 'heading3':
            formattedText += item.text + '\n\n';
            break;
          
          case 'paragraph':
          default:
            formattedText += item.text + '\n\n';
            break;
        }
      });
    } else {
      // 段落構造が抽出できない場合は、テキスト全体を段落分けして処理
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      const extractedText = tempDiv.textContent || '文書の内容を取得できませんでした';
      
      // 空行でテキストを分割して段落を作成
      const paragraphs = extractedText
        .split(/\n\s*\n/)
        .filter(p => p.trim())
        .map(p => p.trim());
      
      if (paragraphs.length > 0) {
        formattedText = paragraphs.join('\n\n');
      } else {
        // 改行で分割を試みる
        const lines = extractedText
          .split('\n')
          .filter(line => line.trim())
          .map(line => line.trim());
        
        if (lines.length > 0) {
          // 一定の長さごとに段落を区切る
          const groupedLines: string[] = [];
          let currentGroup = '';
          
          lines.forEach(line => {
            if (line.length < 50 && 
                (line.endsWith('.') || line.endsWith('。') || 
                 line.endsWith('!') || line.endsWith('！') || 
                 line.endsWith('?') || line.endsWith('？'))) {
              // 短い行で文末記号がある場合は段落の区切りと見なす
              currentGroup += line + ' ';
              groupedLines.push(currentGroup.trim());
              currentGroup = '';
            } else {
              currentGroup += line + ' ';
            }
          });
          
          // 残りの行があれば追加
          if (currentGroup.trim()) {
            groupedLines.push(currentGroup.trim());
          }
          
          formattedText = groupedLines.join('\n\n');
        } else {
          formattedText = extractedText;
        }
      }
    }
    
    return new Blob([formattedText], { type: 'text/plain;charset=utf-8' });
  } catch (error) {
    console.error('TXT変換エラー:', error);
    return new Blob(['文書の変換中にエラーが発生しました。'], { type: 'text/plain;charset=utf-8' });
  }
};

// HTML要素からTXT用の段落構造を抽出する関数
function extractParagraphStructureForTxt(element: HTMLElement): Array<{type: string, text: string}> {
  const result: Array<{type: string, text: string}> = [];
  
  // 段落要素を抽出する関数
  function processParagraphElements(el: HTMLElement) {
    // ブロック要素を処理
    Array.from(el.children).forEach(child => {
      const tagName = child.tagName.toLowerCase();
      const text = child.textContent?.trim() || '';
      
      if (!text) return;
      
      // 要素タイプに基づいて段落タイプを決定
      switch (tagName) {
        case 'h1':
          result.push({
            type: 'heading1',
            text: text
          });
          break;
        case 'h2':
          result.push({
            type: 'heading2',
            text: text
          });
          break;
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
          result.push({
            type: 'heading3',
            text: text
          });
          break;
        case 'p':
          result.push({
            type: 'paragraph',
            text: text
          });
          break;
        case 'div':
          // divの中にテキストが直接ある場合は段落として処理
          if (Array.from(child.childNodes).some(node => 
              node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) {
            
            // テキストノードを抽出
            const textContent = Array.from(child.childNodes)
              .filter(node => node.nodeType === Node.TEXT_NODE)
              .map(node => node.textContent?.trim())
              .filter(text => text)
              .join(' ');
            
            if (textContent) {
              result.push({
                type: 'paragraph',
                text: textContent
              });
            }
          }
          
          // 子要素も処理
          processParagraphElements(child as HTMLElement);
          break;
        case 'ul':
        case 'ol':
          // リスト項目を処理
          Array.from(child.querySelectorAll('li')).forEach((li, index) => {
            const prefix = tagName === 'ol' ? `${index + 1}. ` : '• ';
            result.push({
              type: 'paragraph',
              text: `${prefix}${li.textContent?.trim()}`
            });
          });
          break;
        case 'table':
          // テーブルヘッダー
          const headers = Array.from(child.querySelectorAll('th')).map(th => th.textContent?.trim());
          
          // テーブル行
          const rows = child.querySelectorAll('tr');
          if (rows.length > 0) {
            // ヘッダーがある場合はテーブルタイトルとして追加
            if (headers.length > 0 && headers.some(h => h)) {
              result.push({
                type: 'heading3',
                text: 'テーブル'
              });
              
              // ヘッダー行
              result.push({
                type: 'paragraph',
                text: headers.join('\t')
              });
              
              // 区切り線
              result.push({
                type: 'paragraph',
                text: '-'.repeat(headers.join('\t').length)
              });
            }
            
            // 各行を処理
            rows.forEach(row => {
              if (row.querySelectorAll('td').length > 0) {
                const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent?.trim() || '');
                
                result.push({
                  type: 'paragraph',
                  text: cells.join('\t')
                });
              }
            });
          }
          break;
        case 'br':
          // 改行は無視（段落の区切りとして使用しない）
          break;
        default:
          // その他のブロック要素も段落として処理
          if (text) {
            result.push({
              type: 'paragraph',
              text: text
            });
          }
          
          // 子要素も処理
          if (child.children.length > 0) {
            processParagraphElements(child as HTMLElement);
          }
          break;
      }
    });
  }
  
  // HTML構造から段落を抽出
  processParagraphElements(element);
  
  // 段落が抽出できない場合は、テキスト全体から段落を生成
  if (result.length === 0) {
    const fullText = element.textContent || '';
    
    // 既存の改行や空白行で分割
    const paragraphs = fullText
      .split(/\n\s*\n/)
      .filter(p => p.trim())
      .map(p => p.trim().replace(/\s+/g, ' '));
    
    paragraphs.forEach(para => {
      result.push({
        type: 'paragraph',
        text: para
      });
    });
  }
  
  return result;
}
  
  // TXT形式用のテキスト整形関数
  function formatTextForTxt(text: string): string {
    // 余分な空白と改行を整理
    let formatted = text
      .replace(/\s+/g, ' ')       // 連続する空白を1つにまとめる
      .replace(/\n\s*\n/g, '\n\n') // 空の行を1つの空行にまとめる
      .trim();
    
    // 段落を識別して整形
    const paragraphs = formatted.split(/\n\n+/);
    
    // 整形された段落を結合
    return paragraphs
      .map(para => para.replace(/\s+/g, ' ').trim()) // 各段落内の余分な空白を削除
      .join('\n\n');                                 // 段落間に空行を挿入
  }
  // HTML変換 - スタイル保持を強化
  const convertToHtml = (): Blob => {
    // CSS変数とフォントを追加
    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${fileName}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
          
          :root {
            --text-color: #333333;
            --background-color: #ffffff;
            --link-color: #0066cc;
            --heading-color: #111111;
            --border-color: #cccccc;
          }
          
          html {
            font-size: 16px;
          }
          
          body {
            font-family: 'Noto Sans JP', 'ヒラギノ角ゴ Pro W3', 'Hiragino Kaku Gothic Pro', 'メイリオ', 'Meiryo', sans-serif;
            line-height: 1.6;
            color: var(--text-color);
            background-color: var(--background-color);
            margin: 0 auto;
            padding: 2rem;
            max-width: 800px;
          }
          
          h1, h2, h3, h4, h5, h6 {
            color: var(--heading-color);
            line-height: 1.3;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
          }
          
          h1 { font-size: 1.8rem; }
          h2 { font-size: 1.5rem; }
          h3 { font-size: 1.3rem; }
          
          p {
            margin-bottom: 1rem;
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
          }
          
          ul, ol {
            margin-left: 1.5rem;
            margin-bottom: 1rem;
          }
          
          li {
            margin-bottom: 0.5rem;
          }
          
          table {
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 1rem;
          }
          
          th, td {
            border: 1px solid var(--border-color);
            padding: 0.5rem;
          }
          
          th {
            background-color: #f0f0f0;
            font-weight: bold;
          }
          
          code {
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            background-color: #f5f5f5;
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
            font-size: 0.9rem;
          }
          
          pre {
            background-color: #f5f5f5;
            padding: 1rem;
            border-radius: 5px;
            overflow-x: auto;
          }
          
          pre code {
            padding: 0;
            background-color: transparent;
          }
          
          blockquote {
            border-left: 4px solid #e0e0e0;
            margin-left: 0;
            padding-left: 1rem;
            color: #666;
          }
          
          hr {
            border: none;
            border-top: 1px solid #e0e0e0;
            margin: 2rem 0;
          }
          
          @media print {
            body {
              padding: 0;
            }
            
            @page {
              margin: 2cm;
            }
          }
          
          ${additionalStyles}
        </style>
      </head>
      <body>
        ${cleanedElement.innerHTML}
      </body>
      </html>
    `;
    
    return new Blob([htmlTemplate], { type: 'text/html;charset=utf-8' });
  };
  // Markdown変換 - スタイル情報を適切にコメント化
  const convertToMarkdown = (): Blob => {
    try {
      // HTMLからテキスト内容を安全に抽出（マークダウン変換用）
      const htmlContent = cleanedElement.innerHTML;
      
      // デバッグ用ログ
      console.debug('Markdown変換用のHTML:', htmlContent);
      
      // 基本のマークダウンヘッダー
      let markdown = '';
      
      // Markdownヘッダ情報を追加（YAMLフロントマター）
      markdown += '---\n';
      markdown += `title: ${fileName}\n`;
      markdown += 'lang: ja\n';
      markdown += `date: ${new Date().toISOString().split('T')[0]}\n`;
      
      // フォント情報を追加
      if (designInfo && designInfo.fonts && designInfo.fonts.length > 0) {
        markdown += 'fonts:\n';
        designInfo.fonts.forEach(font => {
          markdown += `  - ${font}\n`;
        });
      }
      
      markdown += '---\n\n';
      
      // CSS情報をHTMLコメントとして追加（HTMLへの変換時に役立つ）
      if (designInfo && designInfo.cssRules && designInfo.cssRules.length > 0) {
        markdown += '<!-- スタイル情報\n';
        markdown += '```css\n';
        markdown += generateCssFromDesignInfo(designInfo);
        markdown += '\n```\n-->\n\n';
      }
      
      // divを使用してテキスト抽出
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      
      // HTMLからMarkdownへの変換を実行
      try {
        // 見出し、段落、リストなどの基本要素を検出
        const extractedMarkdown = simpleHtmlToMarkdown(tempDiv);
        markdown += extractedMarkdown;
      } catch (error) {
        console.error('Markdown変換エラー:', error);
        
        // エラー時はシンプルなテキストを使用
        let extractedText = tempDiv.textContent || '文書の内容を取得できませんでした';
        
        // 段落に分割
        const paragraphs = extractedText.split('\n\n');
        markdown += paragraphs.join('\n\n');
      }
      
      return new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    } catch (error) {
      console.error('Markdown変換エラー:', error);
      const defaultMarkdown = `---\ntitle: ${fileName}\n---\n\n文書の変換中にエラーが発生しました。`;
      return new Blob([defaultMarkdown], { type: 'text/markdown;charset=utf-8' });
    }
  };
  
  // シンプルなHTMLからMarkdownへの変換
  function simpleHtmlToMarkdown(element: HTMLElement): string {
    let markdown = '';
    
    // 子要素を処理
    Array.from(element.childNodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        // テキストノードを処理
        const text = node.textContent?.trim() || '';
        if (text) {
          markdown += text + '\n\n';
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toLowerCase();
        const text = el.textContent?.trim() || '';
        
        if (!text) return;
        
        // 要素タイプに基づいてMarkdownに変換
        switch (tagName) {
          case 'h1':
            markdown += `# ${text}\n\n`;
            break;
          case 'h2':
            markdown += `## ${text}\n\n`;
            break;
          case 'h3':
            markdown += `### ${text}\n\n`;
            break;
          case 'h4':
            markdown += `#### ${text}\n\n`;
            break;
          case 'h5':
            markdown += `##### ${text}\n\n`;
            break;
          case 'h6':
            markdown += `###### ${text}\n\n`;
            break;
          case 'p':
            markdown += `${text}\n\n`;
            break;
          case 'ul':
            Array.from(el.querySelectorAll('li')).forEach(li => {
              markdown += `- ${li.textContent?.trim()}\n`;
            });
            markdown += '\n';
            break;
          case 'ol':
            Array.from(el.querySelectorAll('li')).forEach((li, i) => {
              markdown += `${i + 1}. ${li.textContent?.trim()}\n`;
            });
            markdown += '\n';
            break;
          case 'blockquote':
            markdown += `> ${text.replace(/\n/g, '\n> ')}\n\n`;
            break;
          case 'pre':
            markdown += '```\n' + text + '\n```\n\n';
            break;
          case 'code':
            markdown += '`' + text + '`';
            break;
          case 'strong':
          case 'b':
            markdown += '**' + text + '**';
            break;
          case 'em':
          case 'i':
            markdown += '*' + text + '*';
            break;
          case 'a':
            const href = (el as HTMLAnchorElement).href;
            markdown += `[${text}](${href})`;
            break;
          case 'img':
            const alt = (el as HTMLImageElement).alt || '';
            const src = (el as HTMLImageElement).src;
            markdown += `![${alt}](${src})`;
            break;
          case 'hr':
            markdown += '---\n\n';
            break;
          case 'br':
            markdown += '\n';
            break;
          case 'table':
            // TableをMarkdownに変換
            try {
              const rows = el.querySelectorAll('tr');
              const headers = el.querySelectorAll('th');
              
              if (headers.length > 0) {
                // ヘッダー行
                let headerRow = '| ';
                Array.from(headers).forEach(th => {
                  headerRow += th.textContent?.trim() + ' | ';
                });
                markdown += headerRow + '\n';
                
                // 区切り行
                let dividerRow = '| ';
                Array.from(headers).forEach(() => {
                  dividerRow += '--- | ';
                });
                markdown += dividerRow + '\n';
                
                // データ行
                Array.from(rows).forEach(tr => {
                  if (tr.querySelector('td')) { // ヘッダー行以外
                    let dataRow = '| ';
                    Array.from(tr.querySelectorAll('td')).forEach(td => {
                      dataRow += td.textContent?.trim() + ' | ';
                    });
                    markdown += dataRow + '\n';
                  }
                });
                markdown += '\n';
              }
            } catch (error) {
              console.error('テーブル変換エラー:', error);
              markdown += text + '\n\n';
            }
            break;
          default:
            // 子要素を再帰的に処理
            markdown += simpleHtmlToMarkdown(el);
        }
      }
    });
    
    return markdown;
  }

  // 変換形式に応じた処理
  switch (format) {
    case 'pdf':
      return await convertToPdf();
    
    case 'docx':
      return await convertToDocx();
    
    case 'txt':
      return convertToTxt();
    
    case 'html':
      return convertToHtml();
    
    case 'markdown':
      return convertToMarkdown();
    
    default:
      throw new Error('サポートされていないファイル形式です');
  }
}

// ダウンロード関数
export function downloadBlob(blob: Blob, fileName: string) {
  if (typeof window !== 'undefined') {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}