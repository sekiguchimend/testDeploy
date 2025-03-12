import React, { useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';
import * as docx from 'docx';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import { Loader2 } from "lucide-react";
const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;

interface RecommendationDisplayProps {
  recommendationText: string;
  jobTitle?: string;
  industry?: string;
  businessType?: string;
}

/**
 * シンプルで提出用に適した推薦書表示コンポーネント
 */
const RecommendationDisplay: React.FC<RecommendationDisplayProps> = ({ 
  recommendationText,
  jobTitle,
  industry,
  businessType
}) => {
  const [exportFormat, setExportFormat] = useState<'pdf' | 'docx' | 'html'>('pdf');
  const [isExporting, setIsExporting] = useState(false);
  
  // 推薦書の内容を構造化して解析する関数
  const parseRecommendationContent = () => {
    const result = {
      summary: "",
      points: [] as { title: string; content: string }[],
      reason: ""
    };
    
    // 求職者概要を抽出
    const summaryMatch = recommendationText.match(/■求職者概要([\s\S]*?)(?=◎|$)/);
    if (summaryMatch) {
      result.summary = summaryMatch[1].trim();
    }
    
    // 推薦ポイントを抽出
    const pointsRegex = /◎\s*([^\n]+)[\s\n]+([\s\S]*?)(?=◎|<推薦理由>|$)/g;
    let pointMatch;
    
    while ((pointMatch = pointsRegex.exec(recommendationText)) !== null) {
      const title = pointMatch[1].trim();
      const content = pointMatch[2].trim();
      result.points.push({ title, content });
    }
    
    // 推薦理由を抽出
    const reasonMatch = recommendationText.match(/<推薦理由>([\s\S]*?)(?=$)/);
    if (reasonMatch) {
      result.reason = reasonMatch[1].trim();
    }
    
    return result;
  };
  
  const { summary, points, reason } = parseRecommendationContent();
  const hasStructuredContent = summary || points.length > 0 || reason;

  // HTMLコンテンツを生成する関数
  const generateHTMLContent = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>推薦書</title>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Noto Sans JP', sans-serif;
            color: #000;
            line-height: 1.5;
            padding: 15px;
            max-width: 800px;
            margin: 0 auto;
          }
          h1 {
            font-size: 22px;
            margin-bottom: 12px;
            text-align: center;
            font-weight: 500;
          }
          .condition {
            margin-bottom: 15px;
            padding: 8px;
            border: 1px solid #ccc;
            background-color: #f9f9f9;
          }
          .condition h2 {
            font-size: 16px;
            margin-top: 0;
            margin-bottom: 8px;
            font-weight: 500;
          }
          .condition-item {
            margin-bottom: 4px;
          }
          .summary {
            margin-bottom: 15px;
          }
          .summary h3 {
            font-size: 16px;
            margin-bottom: 6px;
            font-weight: 500;
          }
          .summary p {
            padding: 0 5px;
          }
          .point {
            margin-bottom: 12px;
          }
          .point h3 {
            font-size: 16px;
            margin-bottom: 4px;
            font-weight: 500;
          }
          .point p {
            margin: 0;
            padding: 0 5px;
          }
          .reason {
            margin-top: 15px;
            margin-bottom: 15px;
          }
          .reason h3 {
            font-size: 16px;
            margin-bottom: 6px;
            font-weight: 500;
          }
          .reason p {
            padding: 0 5px;
          }
          p {
            margin-top: 0;
            margin-bottom: 0.7em;
          }
        </style>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
      </head>
      <body>
        <h1>推薦書</h1>
        
        ${(jobTitle || industry || businessType) ? `
        <div class="condition">
          <h2>応募条件</h2>
          ${jobTitle ? `<div class="condition-item"><strong>職種：</strong>${jobTitle}</div>` : ''}
          ${industry ? `<div class="condition-item"><strong>業種：</strong>${industry}</div>` : ''}
          ${businessType ? `<div class="condition-item"><strong>業界：</strong>${businessType}</div>` : ''}
        </div>
        ` : ''}
        
        <div class="recommendation-content">
          ${hasStructuredContent ? `
            ${summary ? `
              <div class="summary">
                <h3>■求職者概要</h3>
                <p>${summary.replace(/\n/g, '<br>')}</p>
              </div>
            ` : ''}
            
            ${points.map(point => `
              <div class="point">
                <h3>◎ ${point.title}</h3>
                <p>${point.content.replace(/\n/g, '<br>')}</p>
              </div>
            `).join('')}
            
            ${reason ? `
              <div class="reason">
                <h3>&lt;推薦理由&gt;</h3>
                <p>${reason.replace(/\n/g, '<br>')}</p>
              </div>
            ` : ''}
          ` : `<div>${recommendationText.replace(/\n/g, '<br>')}</div>`}
        </div>
      </body>
      </html>
    `;
  };

  // HTMLファイルをダウンロードする関数
  const downloadAsHTML = () => {
    const htmlContent = generateHTMLContent();
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    saveAs(blob, "推薦書.html");
  };

  // PDFファイルをダウンロードする関数
  const downloadAsPDF = async () => {
    try {
      // 非表示の要素を作成してHTMLを挿入
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      container.style.width = '800px';  // 固定幅を設定
      
      // メタデータ情報を含むヘッダーを追加
      const currentDate = new Date().toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      // レスポンシブデザインに対応するモバイルメディアクエリを追加
      const mobileCSS = `
      @media screen and (max-width: 600px) {
        body {
          padding: 8px;
        }
        h1 {
          font-size: 18px;
        }
        .condition h2, .summary h3, .point h3, .reason h3 {
          font-size: 14px;
        }
        p {
          font-size: 13px;
        }
      }
      `;
      
      container.innerHTML = generateHTMLContent() + 
        `<div style="text-align: right; margin-top: 20px; font-size: 12px; color: #666;">
          作成日: ${currentDate}
        </div>
        <style>${mobileCSS}</style>`;
      document.body.appendChild(container);
      
      // コンテンツが読み込まれるのを待つ
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // html2canvasでキャプチャ
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 800,
        height: container.offsetHeight
      });
      
      // 不要になった要素を削除
      document.body.removeChild(container);
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      
      // PDFの設定
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      
      // PDFのマージンを適度に設定
      const margin = 8;
      const pdfWidth = 210 - (margin * 2);
      const pdfHeight = 297 - (margin * 2);
      
      // キャンバスの比率を保持
      const canvasRatio = canvas.height / canvas.width;
      const imgWidth = pdfWidth;
      const imgHeight = pdfWidth * canvasRatio;
      
      // 1ページに収まる場合
      if (imgHeight <= pdfHeight) {
        pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight);
      } else {
        // 複数ページに分割する必要がある場合
        let heightLeft = imgHeight;
        let position = 0;
        
        // 最初のページ
        pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
        
        // 残りのページ
        while (heightLeft > 0) {
          position += pdfHeight;
          pdf.addPage();
          pdf.addImage(
            imgData, 
            'JPEG', 
            margin, 
            margin - position, 
            imgWidth, 
            imgHeight
          );
          heightLeft -= pdfHeight;
        }
      }
      
      pdf.save('推薦書.pdf');
    } catch (error) {
      console.error('PDF生成エラー:', error);
      alert('PDFの生成に失敗しました。');
    }
  };

  // Word文書をダウンロードする関数
  const downloadAsDocx = () => {
    try {
      // ドキュメントの作成
      const doc = new Document({
        styles: {
          paragraphStyles: [
            {
              id: "Normal",
              run: {
                size: 24,              // 12pt
                font: "Noto Sans JP"
              },
              paragraph: {
                spacing: {
                  before: 0,           // 段落前のスペースを削除
                  after: 120,          // 段落後のスペースを適度に
                  line: 280            // 行間を少し広く
                }
              }
            },
            {
              id: "Heading1",
              run: {
                size: 32,              // 16pt
                bold: true,
                font: "Noto Sans JP"
              },
              paragraph: {
                spacing: {
                  before: 120,
                  after: 120
                }
              }
            },
            {
              id: "Heading2",
              run: {
                size: 28,              // 14pt
                bold: true,
                font: "Noto Sans JP"
              },
              paragraph: {
                spacing: {
                  before: 120,
                  after: 100
                }
              }
            }
          ]
        },
        sections: [
          {
            properties: {
              page: {
                margin: {
                  top: 850,            // 上マージン(twip)
                  right: 850,          // 右マージン
                  bottom: 850,         // 下マージン
                  left: 850            // 左マージン
                }
              }
            },
            children: [
              new Paragraph({
                text: "推薦書",
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
              }),
              
              // 応募条件（存在する場合）
              ...(jobTitle || industry || businessType ? [
                new Paragraph({
                  text: "応募条件",
                  heading: HeadingLevel.HEADING_2,
                }),
                ...(jobTitle ? [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "職種：", bold: true }),
                      new TextRun({ text: jobTitle }),
                    ],
                  }),
                ] : []),
                ...(industry ? [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "業種：", bold: true }),
                      new TextRun({ text: industry }),
                    ],
                  }),
                ] : []),
                ...(businessType ? [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "業界：", bold: true }),
                      new TextRun({ text: businessType }),
                    ],
                  }),
                ] : []),
              ] : []),
              
              // 求職者概要（存在する場合）
              ...(summary ? [
                new Paragraph({
                  text: "■求職者概要",
                  heading: HeadingLevel.HEADING_2,
                }),
                ...summary.split('\n').map(line => 
                  new Paragraph({ text: line })
                ),
              ] : []),
              
              // 推薦ポイント
              ...points.flatMap(point => [
                new Paragraph({
                  text: `◎ ${point.title}`,
                  heading: HeadingLevel.HEADING_2,
                }),
                ...point.content.split('\n').map(line => 
                  new Paragraph({ text: line })
                ),
              ]),
              
              // 推薦理由（存在する場合）
              ...(reason ? [
                new Paragraph({
                  text: "<推薦理由>",
                  heading: HeadingLevel.HEADING_2,
                }),
                ...reason.split('\n').map(line => 
                  new Paragraph({ text: line })
                ),
              ] : []),
            ],
          },
        ],
      });

      // Word文書を生成してダウンロード
      docx.Packer.toBlob(doc).then(blob => {
        saveAs(blob, "推薦書.docx");
      });
    } catch (error) {
      console.error('Word文書生成エラー:', error);
      alert('Word文書の生成に失敗しました。');
    }
  };

  // ダウンロード処理を実行する関数
  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      switch (exportFormat) {
        case 'pdf':
          await downloadAsPDF();
          break;
        case 'docx':
          await downloadAsDocx();
          break;
        case 'html':
          downloadAsHTML();
          break;
        default:
          await downloadAsPDF();
      }
    } catch (error) {
      console.error('エクスポートエラー:', error);
      alert(`${exportFormat}形式への変換中にエラーが発生しました。`);
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <div className="recommendation-display mt-4 sm:mt-8 mb-6 print:p-0" style={{ fontFamily: "'Noto Sans JP', sans-serif", color: '#000' }}>
      <div className="bg-white border border-gray-300 p-3 sm:p-6 rounded shadow-sm print:shadow-none print:border-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
          <h3 className="text-xl font-medium">推薦書</h3>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
            <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as 'pdf' | 'docx' | 'html')} disabled={isExporting}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="フォーマット選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="docx">Word (.docx)</SelectItem>
                <SelectItem value="html">HTML</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              onClick={handleExport} 
              disabled={isExporting}
              variant="default"
              className="flex items-center justify-center gap-1 w-full sm:w-auto"
            >
              {isExporting ? (
                <>
                  <Loader2 size={16} className="mr-1 animate-spin" />
                  処理中...
                </>
              ) : (
                <>
                  <Download size={16} />
                  ダウンロード
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* 条件情報（存在する場合） */}
        {(jobTitle || industry || businessType) && (
          <div className="mb-4 p-2 sm:p-3 bg-gray-50 border border-gray-200 rounded text-sm sm:text-base">
            <h4 className="font-medium mb-1">応募条件</h4>
            <ul className="space-y-0.5">
              {jobTitle && <li><span className="font-medium">職種：</span>{jobTitle}</li>}
              {industry && <li><span className="font-medium">業種：</span>{industry}</li>}
              {businessType && <li><span className="font-medium">業界：</span>{businessType}</li>}
            </ul>
          </div>
        )}
        
        {hasStructuredContent ? (
          <div className="recommendation-structured text-sm sm:text-base">
            {/* 求職者概要セクション */}
            {summary && (
              <div className="mb-4">
                <h4 className="text-base sm:text-lg font-medium mb-1">■求職者概要</h4>
                <p className="whitespace-pre-line leading-relaxed">{summary}</p>
              </div>
            )}
            
            {/* 推薦ポイントセクション */}
            {points.length > 0 && (
              <div className="recommendation-points space-y-4">
                {points.map((point, index) => (
                  <div key={index} className="recommendation-point">
                    <h4 className="text-base sm:text-lg font-medium mb-1">◎ {point.title}</h4>
                    <p className="whitespace-pre-line leading-relaxed">{point.content}</p>
                  </div>
                ))}
              </div>
            )}
            
            {/* 推薦理由セクション */}
            {reason && (
              <div className="mt-4">
                <h4 className="text-base sm:text-lg font-medium mb-1">&lt;推薦理由&gt;</h4>
                <p className="whitespace-pre-line leading-relaxed">{reason}</p>
              </div>
            )}
          </div>
        ) : (
          // 構造化されていない場合はそのまま表示
          <div className="recommendation-text whitespace-pre-line leading-relaxed text-sm sm:text-base">
            {recommendationText}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecommendationDisplay;