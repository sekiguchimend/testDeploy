import { useState } from 'react';
import { Document, Packer, Paragraph, HeadingLevel } from 'docx';

// デザイン情報のインターフェース
interface DesignInfo {
  fonts: string[];
  layout: {
    pageCount: number;
    margins: {
      top: string;
      right: string;
      bottom: string;
      left: string;
    };
  };
  styles: {
    [key: string]: {
      fontSize: string;
      fontFamily?: string;
      fontWeight?: string;
      color?: string;
      lineHeight?: string;
      textAlign?: string;
    };
  };
  cssRules: Array<{
    selector: string;
    properties: { [key: string]: string };
  }>;
}

// 変換オプションのインターフェース
interface ConversionOptions {
  format: 'pdf' | 'docx' | 'txt' | 'html' | 'markdown';
  fileName?: string;
  designInfo?: DesignInfo;
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
    designInfo 
  } = options;

  // デザイン情報からCSSを生成
  const additionalStyles = designInfo ? generateCssFromDesignInfo(designInfo) : '';

  // クローンを作成して、差分表示用のspanを元のテキストに戻す
  const cleanedElement = correctedDocumentElement.cloneNode(true) as HTMLElement;
  cleanedElement.querySelectorAll('.diff-added, .diff-removed').forEach(el => {
    el.outerHTML = el.textContent || '';
  });

  // HTML content をラップし、必要なスタイルを追加
  const fullHtmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { 
          font-family: 'ヒラギノ角ゴ Pro W3', 'Hiragino Kaku Gothic Pro', Osaka, メイリオ, Meiryo, 'ＭＳ Ｐゴシック', 'MS PGothic', sans-serif; 
          line-height: 1.6;
          max-width: 210mm;
          margin: 0 auto;
          padding: 20mm;
        }
        ${additionalStyles}
      </style>
    </head>
    <body>
      ${cleanedElement.innerHTML}
    </body>
    </html>
  `;

  // PDF変換
  const convertToPdf = async (): Promise<Blob> => {
    if (!html2pdf) {
      throw new Error('html2pdf.js がロードされていません');
    }

    return new Promise((resolve, reject) => {
      const opt = {
        margin: 10,
        filename: `${fileName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true 
        },
        jsPDF: { 
          unit: 'mm', 
          format: 'a4', 
          orientation: 'portrait' 
        },
        pagebreak: { mode: 'avoid-all' }
      };

      try {
        html2pdf()
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

  // DOCX変換
  const convertToDocx = async (): Promise<Blob> => {
    const extractTextAndType = (element: Element): { text: string; type?: typeof HeadingLevel[keyof typeof HeadingLevel] }[] => {
      const result: { text: string; type?: typeof HeadingLevel[keyof typeof HeadingLevel] }[] = [];
    
      const processElement = (el: Element) => {
        const text = el.textContent?.trim() || '';
        let type: typeof HeadingLevel[keyof typeof HeadingLevel] | undefined;
    
        if (el.tagName === 'H1') type = HeadingLevel.TITLE;
        else if (el.tagName === 'H2') type = HeadingLevel.HEADING_1;
        else if (el.tagName === 'H3') type = HeadingLevel.HEADING_2;
    
        if (text) {
          result.push({ text, type });
        }
    
        el.childNodes.forEach(child => {
          if (child.nodeType === Node.ELEMENT_NODE) {
            processElement(child as Element);
          }
        });
      };
    
      processElement(element);
      return result;
    };

    const extractedContent = extractTextAndType(cleanedElement);
    
    const doc = new Document({
      sections: [{
        children: extractedContent.map(item => 
          new Paragraph({
            text: item.text,
            heading: item.type
          })
        )
      }]
    });

    return await Packer.toBlob(doc);
  };

  // テキストファイル変換
  const convertToTxt = (): Blob => {
    const plainText = cleanedElement.textContent || '';
    return new Blob([plainText], { type: 'text/plain;charset=utf-8' });
  };

  // HTML変換
  const convertToHtml = (): Blob => {
    return new Blob([fullHtmlContent], { type: 'text/html;charset=utf-8' });
  };

  // Markdown変換
  const convertToMarkdown = (): Blob => {
    const htmlToMarkdown = (element: HTMLElement): string => {
      let markdown = '';
      
      const processElement = (el: Element) => {
        const text = el.textContent || '';
        
        switch (el.tagName) {
          case 'H1':
            markdown += `# ${text}\n\n`;
            break;
          case 'H2':
            markdown += `## ${text}\n\n`;
            break;
          case 'H3':
            markdown += `### ${text}\n\n`;
            break;
          case 'P':
            markdown += `${text}\n\n`;
            break;
          case 'UL':
            el.querySelectorAll('li').forEach(li => {
              markdown += `- ${li.textContent}\n`;
            });
            markdown += '\n';
            break;
          case 'OL':
            el.querySelectorAll('li').forEach((li, index) => {
              markdown += `${index + 1}. ${li.textContent}\n`;
            });
            markdown += '\n';
            break;
        }
      };
      
      Array.from(cleanedElement.children).forEach(processElement);
      
      return markdown;
    };
    
    const markdownContent = htmlToMarkdown(cleanedElement);
    return new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
  };

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