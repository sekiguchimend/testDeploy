import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from "@google/generative-ai";
import os from 'os';
// import pdfParse from 'pdf-parse';
const pdfParse = require('pdf-parse')
import mammoth from 'mammoth';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 環境変数からAPIキーを取得
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// APIキーが設定されていない場合はエラーを投げる
if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY環境変数が設定されていません");
}

// Google Generative AIクライアントを初期化
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// 一時ファイル保存用のディレクトリパス
const TEMP_DIR = path.join(os.tmpdir(), 'file-processor');

// 一時ディレクトリが存在しない場合は作成
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// APIに送信するテキストの最大長
const MAX_TEXT_LENGTH = 30000;

// デザイン情報のインターフェース
export interface DesignInfo {
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
      // その他のCSSプロパティ
    };
  };
  cssRules: Array<{
    selector: string;
    properties: {
      [key: string]: string;
    };
  }>;
}

// Gemini APIからのレスポンスインターフェース
export interface GeminiResponse {
  correctedText: string;
  designInfo?: DesignInfo;
}

// 処理結果のインターフェース
export interface ProcessResult {
  originalText: string;
  correctedText: string;
  designInfo?: DesignInfo;
  jsonResponse?: string; // 追加: 元のJSON文字列
}

// 処理済みファイルの情報を表すインターフェース
interface ProcessedFile {
  originalText: string;
  filePath: string;
  fileName: string;
  fileType: string;
  designInfo?: DesignInfo;
}
/**
 * Gemini APIのレスポンスをパースする関数
 * マークダウンのコードブロックも処理可能
 */
export function parseGeminiResponse(response: string): GeminiResponse {
  try {
    // マークダウンのコードブロックがあるか確認
    const jsonMatch = response.match(/```json\s*({[\s\S]*?})\s*```/) || 
                      response.match(/```\s*({[\s\S]*?})\s*```/) || 
                      response.match(/({[\s\S]*})/);
                            
    let jsonStr = '';
    
    if (jsonMatch && jsonMatch[1]) {
      // コードブロック内のJSONを抽出
      jsonStr = jsonMatch[1].trim();
      console.log("マークダウンコードブロックからJSONを抽出しました");
    } else {
      // コードブロックがない場合はそのまま
      jsonStr = response;
    }
    
    // JSONとしてパース
    const parsedData = JSON.parse(jsonStr);
    
    // 期待する形式かチェック
    if (parsedData && typeof parsedData === 'object') {
      const result = {
        correctedText: parsedData.correctedText || '',
        designInfo: parsedData.designInfo
      };
      
      // 必要なフィールドが揃っているか確認
      if (!result.correctedText) {
        console.warn("警告: レスポンスにcorrectedTextフィールドがありません");
      }
      
      return result;
    }
    
    // 形式が期待と異なる場合
    console.warn("警告: 予期しないレスポンス形式、生のテキストとして使用します");
    return {
      correctedText: response,
      designInfo: undefined
    };
  } catch (error) {
    console.error("JSONパースエラー:", error);
    
    // JSON解析エラーの場合、テキスト全体をそのまま返す
    return {
      correctedText: response,
      designInfo: undefined
    };
  }
}

/**
 * designInfoオブジェクトを文字列に変換する
 */
export function designInfoToString(designInfo: DesignInfo | undefined): string {
  if (!designInfo) {
    return "デザイン情報はありません";
  }
  
  // JSON形式で文字列化
  return JSON.stringify(designInfo, null, 2);
}

/**
 * designInfoオブジェクトを読みやすい形式で文字列に変換する
 */
export function formatDesignInfo(designInfo: DesignInfo | undefined): string {
  if (!designInfo) {
    return "デザイン情報はありません";
  }
  
  // フォント情報
  const fontsStr = designInfo.fonts && designInfo.fonts.length 
    ? `フォント: ${designInfo.fonts.join(', ')}` 
    : "フォント情報なし";
  
  // レイアウト情報
  const layoutStr = designInfo.layout 
    ? `レイアウト: ページ数=${designInfo.layout.pageCount}, マージン(上=${designInfo.layout.margins.top}, 右=${designInfo.layout.margins.right}, 下=${designInfo.layout.margins.bottom}, 左=${designInfo.layout.margins.left})` 
    : "レイアウト情報なし";
  
  // スタイル情報
  let stylesStr = "スタイル:\n";
  if (designInfo.styles) {
    for (const [selector, style] of Object.entries(designInfo.styles)) {
      stylesStr += `  ${selector}: サイズ=${style.fontSize}`;
      if (style.fontFamily) stylesStr += `, フォント=${style.fontFamily}`;
      if (style.fontWeight) stylesStr += `, 太さ=${style.fontWeight}`;
      if (style.color) stylesStr += `, 色=${style.color}`;
      stylesStr += "\n";
    }
  } else {
    stylesStr += "  情報なし";
  }
  
  // CSSルール情報
  let cssRulesStr = "CSSルール:\n";
  if (designInfo.cssRules && designInfo.cssRules.length > 0) {
    designInfo.cssRules.forEach((rule, index) => {
      cssRulesStr += `  [${index + 1}] ${rule.selector} {\n`;
      for (const [prop, value] of Object.entries(rule.properties)) {
        cssRulesStr += `    ${prop}: ${value};\n`;
      }
      cssRulesStr += "  }\n";
    });
  } else {
    cssRulesStr += "  情報なし";
  }
  
  // 結合して返す
  return `${fontsStr}\n${layoutStr}\n${stylesStr}\n${cssRulesStr}`;
}

/**
 * テキストファイルを読み込む
 */
export async function readTextFile(filePath: string): Promise<string> {
  return fs.promises.readFile(filePath, 'utf-8');
}

/**
 * PDFファイルを読み込んでテキストを抽出
 */
export async function readPdfFile(filePath: string): Promise<string> {
  const fileBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(fileBuffer);
  return data.text;
}

/**
 * Wordファイルを読み込んでテキストを抽出
 */
export async function readWordFile(filePath: string): Promise<string> {
  const fileBuffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer: fileBuffer });
  return result.value;
}

/**
 * CSSルールからCSSスタイルシートテキストを生成する
 */
export function generateCssFromRules(cssRules: Array<{selector: string; properties: {[key: string]: string}}>): string {
  if (!cssRules || !Array.isArray(cssRules) || cssRules.length === 0) {
    return '';
  }
  
  return cssRules.map(rule => {
    const propertiesText = Object.entries(rule.properties)
      .map(([key, value]) => `  ${key}: ${value};`)
      .join('\n');
      
    return `${rule.selector} {\n${propertiesText}\n}`;
  }).join('\n\n');
}
/**
 * Gemini APIを使用してテキストの添削とデザイン情報の抽出を行う
 */
export async function processWithGemini(
  text: string,
  fileType: string,
  extractDesign: boolean = true,
  customPrompt: string = ""
): Promise<ProcessResult> {
  // テキストの長さをチェック
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(`テキストが長すぎます。${MAX_TEXT_LENGTH}文字以下にしてください。`);
  }

  console.log(`Gemini API呼び出し開始 (デザイン抽出: ${extractDesign})`);

  // リトライ回数設定
  const maxRetries = 3;
  let attempts = 0;
  let lastError = null;

  while (attempts < maxRetries) {
    try {
      // リトライ間隔を設定（指数バックオフ）
      if (attempts > 0) {
        const waitTime = Math.pow(2, attempts) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`リトライ ${attempts}/${maxRetries}`);
        }
      }

      attempts++;
      
      // Geminiモデルを取得
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      
      // プロンプト設定
      let prompt;
      
      if (extractDesign) {
        prompt = `
        あなたは文書分析と添削のエキスパートです。以下の${fileType}文書を詳細に分析し、指定されたタスクを実行してください。

        【タスク1: 文書構造とデザイン情報の詳細な抽出】
        まず文書の構造を細かく分析し、以下の情報を抽出してください:

        1. 文書構造の分析:
           - 大見出し (h1)
           - 中見出し (h2)
           - 通常テキスト (paragraph)
           - その他の要素（リスト項目、強調テキストなど）

        2. 各要素ごとの詳細なデザイン情報:
           - フォント情報（フォントファミリー、フォントサイズ）
           - 色情報（テキスト色）
           - 配置情報（テキストの揃え方）
           - その他のスタイル情報（太さ、行間など）

        【タスク2: 職務経歴書の添削】
        以下の点に注意して職務経歴書として添削してください:
        - 元の文章構造は維持する
        - 具体的な成果や数値を強調する
        - 曖昧な表現は具体的に修正する
        - 誤字脱字を修正する
        - 元の文章と同じか少し多いくらいの文章量にする
        ${customPrompt ? `\n【追加の指示】\n${customPrompt}` : ''}

        【出力形式】
        下のようにJSONオブジェクトで出力してくださいcssのスタイルはここにあるやつ以外にも模写するために必要なcssを入れてください
       {
          "correctedText": "添削後のテキスト全文をここに入れてください",
          "designInfo": {
            "fonts": ["フォント名の配列"],
            "layout": {
              "pageCount": ページ数,
              "margins": {
                "top": "上マージン",
                "right": "右マージン",
                "bottom": "下マージン",
                "left": "左マージン"
              }
            },
            "styles": {
              "heading1": {
                "fontSize": "サイズ",
                "fontFamily": "フォント",
                "fontWeight": "太さ",
                "color": "色",
                "textAlign": "配置"
              },
              "heading2": { ... },
              "paragraph": { ... }
            },
            "cssRules": [
              {
                "selector": ".heading1",
                "properties": {
                  "font-size": "サイズ",
                  "font-family": "フォント名",
                  "font-weight": "太さ",
                  "color": "#HEX色コード",
                  "text-align": "位置"
                }
              },
              ...
            ]
          }
        }
        【重要: CSSルールの必須要件】
        1. 必ず以下の3つの要素タイプに対応するCSSルールを含めてください:
           - .heading1: 大見出し (h1) 用
           - .heading2: 中見出し (h2) 用
           - .paragraph: 通常テキスト用
         
        2. これら3つの必須要素のCSSルールには、以下のプロパティを必ず含めてください:
           - font-size: フォントサイズ (px単位で指定)
           - font-family: フォントファミリー
           - color: テキスト色 (#HEX形式で指定)
           - text-align: テキストの配置 (center,left, right, justifyのいずれか)
           - text-alignは一番正確に判定して
        3. 文書の特性に合わせて、追加の要素（リスト項目など）のCSSルールも定義してください。
        
        4. 出力は必ず有効なJSON形式で行ってください。マークダウンのコードブロック（\`\`\`json）や装飾は使用しないでください。

        ${text}
        `;
      } else {
        // デザイン情報が不要な場合のシンプルなプロンプト
        prompt = `
        以下の職務経歴書を添削してください。
        注意点：
        - 元の文章構造は維持してください
        - 具体的な成果や数値を強調してください
        - 曖昧な表現は具体的に修正してください
        - 誤字脱字を修正してください
        - 元の文章と同じか少し多いくらいの文章量にしてください
        ${customPrompt ? `\n【追加の指示】\n${customPrompt}` : ''}

        【出力形式】
        以下の形式のJSONオブジェクトで出力してください:
        
        {
          "correctedText": "添削後のテキスト全文をここに入れてください"
        }

        出力は必ず有効なJSON形式で行ってください。マークダウンのコードブロック（\`\`\`json）や装飾は使用しないでください。

        原文:
        ${text}
        `;
      }
      
      // Gemini APIを呼び出し
      const result = await model.generateContent(prompt);
      const response = result.response.text();
      console.log("APIレスポンス受信完了 (長さ:", response.length, "文字)");
      
      // レスポンスをパース
      try {
        // レスポンスをJSONとしてパース
        const parsedResponse = parseGeminiResponse(response);
        console.log("レスポンスのパース成功");
        
        // designInfoの検証
        if (extractDesign && parsedResponse.designInfo) {
          console.log("デザイン情報検証:");
          console.log(" - フォント情報:", !!parsedResponse.designInfo.fonts);
          console.log(" - レイアウト情報:", !!parsedResponse.designInfo.layout);
          console.log(" - スタイル情報:", !!parsedResponse.designInfo.styles);
          console.log(" - CSSルール:", !!parsedResponse.designInfo.cssRules && 
                     Array.isArray(parsedResponse.designInfo.cssRules));
          
          if (parsedResponse.designInfo.cssRules && Array.isArray(parsedResponse.designInfo.cssRules)) {
            console.log("   - CSSルール数:", parsedResponse.designInfo.cssRules.length);
            
            if (parsedResponse.designInfo.cssRules.length > 0) {
              console.log("   - 最初のルールのサンプル:", 
                        JSON.stringify(parsedResponse.designInfo.cssRules[0], null, 2));
            }
          }
        } else if (extractDesign) {
          console.warn("警告: デザイン情報が要求されましたが取得できませんでした");
        }
        
        return {
          originalText: text,
          correctedText: parsedResponse.correctedText,
          designInfo: parsedResponse.designInfo,
          jsonResponse: response // 元のJSON文字列を保存
        };
      } catch (parseError) {
        console.error("レスポンスのパースに失敗しました:", parseError);
        
        // パースに失敗した場合、レスポンスをそのまま返す
        return {
          originalText: text,
          correctedText: response,
          designInfo: undefined,
          jsonResponse: response
        };
      }
    } catch (error) {
      lastError = error;
      console.error(`API呼び出しエラー (試行 ${attempts}/${maxRetries}):`, error);
      
      // 最後のリトライだった場合
      if (attempts >= maxRetries) {
        break;
      }
    }
  }
  
  // すべてのリトライが失敗した場合
  const errorMsg = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`処理に失敗しました: ${errorMsg}`);
}
/**
 * ファイルからテキストを抽出する
 */
export async function extractTextFromFile(filePath: string): Promise<{
  text: string;
  fileType: string;
}> {
  try {
    const fileExt = path.extname(filePath).toLowerCase();
    let text = '';
    let fileType = '';

    if (fileExt === '.txt') {
      fileType = 'テキスト';
      text = await readTextFile(filePath);
    } else if (fileExt === '.pdf') {
      fileType = 'PDF';
      text = await readPdfFile(filePath);
    } else if (fileExt === '.docx' || fileExt === '.doc') {
      fileType = 'Word';
      text = await readWordFile(filePath);
    } else if (fileExt === '.odt') {
      fileType = 'ODT';
      text = await readWordFile(filePath);
    } else {
      throw new Error(`サポートされていないファイル形式です: ${fileExt}`);
    }

    if (!text || text.trim() === '') {
      throw new Error('ファイルが空か破損しています');
    }

    return { text, fileType };
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("テキスト抽出中に不明なエラーが発生しました");
  }
}

/**
 * ファイルを処理してテキストとデザイン情報を抽出する統合関数
 */
export async function processFile(filePath: string, extractDesign: boolean = true): Promise<ProcessedFile> {
  try {
    // ファイルからテキストを抽出
    const { text } = await extractTextFromFile(filePath);
    
    // テキストと設定だけを返す（添削は行わない）
    console.log(`ファイル処理: ${path.basename(filePath)} (デザイン抽出: ${extractDesign})`);
    
    return {
      originalText: text,
      filePath,
      fileName: path.basename(filePath),
      fileType: path.extname(filePath).toLowerCase(),
      designInfo: undefined // processAndReviewFile で Gemini API を呼び出す時に設定される
    };
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("ファイル処理中に不明なエラーが発生しました");
  }
}

/**
 * 添削済みテキストで新しいファイルを作成
 */
export async function updateFileWithReviewedText(
  reviewedText: string, 
  fileInfo: ProcessedFile
): Promise<string> {
  try {
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const updatedFilePath = path.join(
      TEMP_DIR, 
      `reviewed_${timestamp}_${fileInfo.fileName}`
    );
    
    await fs.promises.writeFile(updatedFilePath, reviewedText, 'utf-8');
    console.log(`添削済みファイルを作成しました: ${path.basename(updatedFilePath)}`);
    
    return updatedFilePath;
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("ファイル更新中に不明なエラーが発生しました");
  }
}

/**
 * CSSファイルを作成
 */
export async function createCssFile(
  designInfo: DesignInfo | undefined, 
  baseName: string
): Promise<string | null> {
  if (!designInfo || !designInfo.cssRules || !Array.isArray(designInfo.cssRules) || designInfo.cssRules.length === 0) {
    console.log("CSSファイル作成をスキップします: 有効なデザイン情報がありません");
    return null;
  }
  
  try {
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const cssFilePath = path.join(
      TEMP_DIR, 
      `styles_${timestamp}_${baseName}.css`
    );
    
    const cssContent = generateCssFromRules(designInfo.cssRules);
    await fs.promises.writeFile(cssFilePath, cssContent, 'utf-8');
    
    console.log(`CSSファイルを作成しました: ${path.basename(cssFilePath)}`);
    console.log(`CSSファイル内容サンプル:\n${cssContent.substring(0, 200)}...`);
    
    return cssFilePath;
  } catch (error) {
    console.error("CSSファイル作成中にエラーが発生しました:", error);
    return null;
  }
}

/**
 * LibreOfficeを使ってテキストファイルからPDFを生成
 */
export async function convertToPdfWithLibreOffice(filePath: string): Promise<string> {
  try {
    const fileDir = path.dirname(filePath);
    const fileName = path.basename(filePath, path.extname(filePath));
    const outputPdfPath = path.join(fileDir, `${fileName}.pdf`);
    
    console.log(`PDFに変換中: ${path.basename(filePath)}`);
    
    // LibreOfficeでPDFに変換
    await execAsync(`soffice --headless --convert-to pdf --outdir "${fileDir}" "${filePath}"`);
    
    // 出力PDFが存在することを確認
    if (!fs.existsSync(outputPdfPath)) {
      throw new Error("PDFの生成に失敗しました");
    }
    
    console.log(`PDFに変換完了: ${path.basename(outputPdfPath)}`);
    return outputPdfPath;
  } catch (error) {
    console.error("PDFへの変換中にエラーが発生しました:", error);
    throw error;
  }
}
/**
 * メイン処理関数 - API呼び出しを1回に統合
 */
export async function processAndReviewFile(
  filePath: string, 
  extractDesign: boolean = true,
  customPrompt: string = ""
): Promise<{
  originalText: string;
  reviewedText: string;
  reviewedFilePath: string;
  cssFilePath?: string | null;
  designInfo?: DesignInfo;
  designInfoString?: string;
  jsonResponse?: string; // 元のJSON文字列
}> {
  try {
    console.log(`処理開始: ${path.basename(filePath)}, デザイン抽出: ${extractDesign}`);
    
    // ファイルからテキストを抽出
    const { text, fileType } = await extractTextFromFile(filePath);
    
    // Gemini APIでテキストの添削とデザイン情報の抽出を1回で行う
    const result = await processWithGemini(text, fileType, extractDesign, customPrompt);
    
    // デザイン情報の有無をコンソールに表示
    if (extractDesign && result.designInfo) {
      console.log("デザイン情報取得成功");
      
      if (result.designInfo.cssRules && Array.isArray(result.designInfo.cssRules)) {
        console.log(" - CSSルール数:", result.designInfo.cssRules.length);
      } else {
        console.log("警告: CSSルールがないか、適切な形式ではありません");
      }
    } else if (extractDesign) {
      console.log("警告: デザイン情報を要求しましたが取得できませんでした");
    }
    
    // ファイル情報を構築
    const fileInfo: ProcessedFile = {
      originalText: text,
      filePath,
      fileName: path.basename(filePath),
      fileType: path.extname(filePath).toLowerCase(),
      designInfo: result.designInfo
    };
    
    // 添削済みファイル作成
    const reviewedFilePath = await updateFileWithReviewedText(result.correctedText, fileInfo);
    
    // CSSファイル作成（デザイン情報がある場合）
    let cssFilePath: string | null = null;
    if (extractDesign && result.designInfo) {
      cssFilePath = await createCssFile(result.designInfo, path.basename(filePath, path.extname(filePath)));
    }
    
    // デザイン情報を文字列に変換
    const designInfoString = extractDesign && result.designInfo 
      ? formatDesignInfo(result.designInfo)
      : "デザイン情報はありません";
    
    console.log(`処理完了: ${path.basename(filePath)}`);
    
    return {
      originalText: text,
      reviewedText: result.correctedText,
      reviewedFilePath,
      cssFilePath,
      designInfo: result.designInfo,
      designInfoString,
      jsonResponse: result.jsonResponse // 元のJSON文字列を返す
    };
  } catch (error) {
    console.error("エラー:", error instanceof Error ? error.message : "不明なエラー");
    throw error; // エラーを再スロー
  }
}

/**
 * 既存の関数との互換性を保つためのエイリアス
 * デザイン情報が必要な場合は extractDesign パラメータを必ず true にする
 */
export const reviewTextWithGemini = async (
  text: string, 
  extractDesign: boolean = false,
  customPrompt: string = ""
): Promise<{
  correctedText: string;
  designInfo?: DesignInfo;
  designInfoString?: string;
  jsonResponse?: string; // 追加: 元のJSON文字列
}> => {
  try {
    const fileType = "テキスト"; // デフォルトファイルタイプ
    console.log(`reviewTextWithGemini 呼び出し (デザイン抽出: ${extractDesign})`);
    
    // カスタムプロンプトがある場合はログに出力
    if (customPrompt) {
      console.log("カスタムプロンプトが指定されています:", customPrompt.substring(0, 100) + (customPrompt.length > 100 ? "..." : ""));
    }
    
    const result = await processWithGemini(text, fileType, extractDesign, customPrompt);
    
    // デザイン情報を文字列に変換（存在する場合）
    let designInfoString: string | undefined = undefined;
    
    if (extractDesign) {
      if (result.designInfo?.cssRules && Array.isArray(result.designInfo.cssRules)) {
        console.log("CSSルールが正常に取得されました:", result.designInfo.cssRules.length, "個のルール");
        designInfoString = formatDesignInfo(result.designInfo);
      } else {
        console.log("警告: デザイン情報が要求されましたが、CSSルールが取得できませんでした");
        designInfoString = "デザイン情報はありません";
      }
    }
    
    return {
      correctedText: result.correctedText,
      designInfo: result.designInfo,
      designInfoString,
      jsonResponse: result.jsonResponse // 元のJSON文字列を返す
    };
  } catch (error) {
    throw error;
  }
};