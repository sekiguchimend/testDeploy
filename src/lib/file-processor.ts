import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from "@google/generative-ai";
import os from 'os';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { extractDesignInfo } from './design-extractor';
import { exec, spawn } from 'child_process';
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

// 処理済みファイルの情報を表すインターフェース
interface ProcessedFile {
  originalText: string;
  filePath: string;
  fileName: string;
  fileType: string;
  designInfo?: any; // デザイン情報を追加
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
 * Gemini APIでテキストを添削
 */
export async function reviewTextWithGemini(text: string, designInfo?: any): Promise<string> {
  // テキストの長さをチェック
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(`テキストが長すぎます。${MAX_TEXT_LENGTH}文字以下にしてください。`);
  }

  // リトライ回数設定
  const maxRetries = 3;
  let attempts = 0;
  let lastError = null;

  // デザイン情報があれば、プロンプトに追加
  let designPrompt = '';
  if (designInfo) {
    designPrompt = `
    また、以下のデザイン情報を考慮して添削してください：
    - 使用フォント: ${designInfo.fonts.join(', ')}
    - ページ数: ${designInfo.layout.pageCount}
    - レイアウト: ${JSON.stringify(designInfo.layout)}
    - スタイル: 文書で使用されているスタイル情報を考慮してください
    `;
  }

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
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      
      // プロンプトを設定
      const prompt = `
      以下の職務経歴書を添削してください。
      注意点：
      - 元の文章構造は維持してください
      - 具体的な成果や数値を強調してください
      - 曖昧な表現は具体的に修正してください
      - 誤字脱字を修正してください
      - 元の文章と同じか少し多いくらいの文章量にしてください
      ${designPrompt}

      原文:
      ${text}
      `;
      
      // Gemini APIを呼び出し
      const result = await model.generateContent(prompt);
      const response = result.response;
      return response.text();
      
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
  throw new Error(`テキスト添削に失敗しました: ${errorMsg}`);
}

/**
 * ファイルを処理してテキストとデザイン情報を抽出
 */
export async function processFile(filePath: string, extractDesign: boolean = true): Promise<ProcessedFile> {
  try {
    const fileType = path.extname(filePath).toLowerCase();
    let originalText = '';
    let designInfo = null;

    if (fileType === '.txt') {
      originalText = await readTextFile(filePath);
    } else if (fileType === '.pdf') {
      originalText = await readPdfFile(filePath);
      // PDFのデザイン情報を抽出
      if (extractDesign) {
        try {
          designInfo = await extractDesignInfo(filePath);
        } catch (designError) {
          console.warn("デザイン情報の抽出に失敗しました:", designError);
          // デザイン抽出の失敗はプロセス全体を停止させない
        }
      }
    } else if (fileType === '.docx' || fileType === '.doc' || fileType === '.odt') {
      originalText = await readWordFile(filePath);
      // Wordのデザイン情報を抽出
      if (extractDesign) {
        try {
          designInfo = await extractDesignInfo(filePath);
        } catch (designError) {
          console.warn("デザイン情報の抽出に失敗しました:", designError);
          // デザイン抽出の失敗はプロセス全体を停止させない
        }
      }
    } else {
      throw new Error(`サポートされていないファイル形式です: ${fileType}`);
    }

    if (!originalText || originalText.trim() === '') {
      throw new Error('ファイルが空か破損しています');
    }

    return {
      originalText,
      filePath,
      fileName: path.basename(filePath),
      fileType,
      designInfo
    };
  } catch (error) {
    // エラーを再スロー
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
    
    return updatedFilePath;
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("ファイル更新中に不明なエラーが発生しました");
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
    
    // LibreOfficeでPDFに変換
    await execAsync(`soffice --headless --convert-to pdf --outdir "${fileDir}" "${filePath}"`);
    
    // 出力PDFが存在することを確認
    if (!fs.existsSync(outputPdfPath)) {
      throw new Error("PDFの生成に失敗しました");
    }
    
    return outputPdfPath;
  } catch (error) {
    console.error("PDFへの変換中にエラーが発生しました:", error);
    throw error;
  }
}

/**
 * メイン処理関数
 */
export async function processAndReviewFile(filePath: string, extractDesign: boolean = true): Promise<{
  originalText: string;
  reviewedText: string;
  reviewedFilePath: string;
  designInfo?: any;
}> {
  try {
    // ファイル処理
    const fileInfo = await processFile(filePath, extractDesign);
    
    // APIで添削
    const reviewedText = await reviewTextWithGemini(fileInfo.originalText, fileInfo.designInfo);
    
    // 添削済みファイル作成
    const reviewedFilePath = await updateFileWithReviewedText(reviewedText, fileInfo);
    
    return {
      originalText: fileInfo.originalText,
      reviewedText,
      reviewedFilePath,
      designInfo: fileInfo.designInfo
    };
  } catch (error) {
    console.error("エラー:", error instanceof Error ? error.message : "不明なエラー");
    throw error; // エラーを再スロー
  }
}