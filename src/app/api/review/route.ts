import { NextRequest, NextResponse } from "next/server";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { processFile, reviewTextWithGemini, updateFileWithReviewedText, convertToPdfWithLibreOffice } from "@/lib/file-processor";
import { saveResumeFile } from "@/lib/resumeService";
import { processRestrictedKeywords } from "@/lib/keywordService";

// 一時ディレクトリのパス
const TEMP_DIR = path.join(os.tmpdir(), 'file-processor');

// 一時ディレクトリが存在しない場合は作成
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// ファイルタイプの検証
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "text/plain", // テキストファイルも許可
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "image/jpeg",
  "image/png"
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// リクエストのバリデーション関数
function validateRequest(req: NextRequest) {
  // IPアドレスの制限などを追加できます
  const allowedIPs = process.env.ALLOWED_IPS 
    ? process.env.ALLOWED_IPS.split(',') 
    : [];
  
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

  if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
    console.warn(`未承認のIPアドレスからのアクセス: ${clientIP}`);
    return false;
  }

  return true;
}

// テンポラリファイルのクリーンアップ関数
function cleanupTempFiles() {
  try {
    const now = Date.now();
    const files = fs.readdirSync(TEMP_DIR);
    
    files.forEach(file => {
      const filePath = path.join(TEMP_DIR, file);
      
      const stats = fs.statSync(filePath);
      
      // 24時間以上経過したファイルを削除
      if (now - stats.mtime.getTime() > 24 * 60 * 60 * 1000) {
        try {
          fs.unlinkSync(filePath);
          console.log(`古いテンポラリファイルを削除: ${file}`);
        } catch (deleteError) {
          console.error(`テンポラリファイル削除エラー: ${file}`, deleteError);
        }
      }
    });
  } catch (error) {
    console.error("テンポラリファイルのクリーンアップ中にエラーが発生:", error);
  }
}

// エラーハンドリング関数
function handleError(error: any, context = "一般的なエラー") {
  console.error(`${context}:`, error);
  return {
    success: false,
    error: {
      message: error.message,
      name: error.name,
      context
    }
  };
}

// テンポラリファイルのクリーンアップを定期的に実行（サーバーコンポーネントでのみ動作）
if (typeof window === 'undefined') {
  setInterval(cleanupTempFiles, 24 * 60 * 60 * 1000); // 24時間ごと
}

export async function POST(req: NextRequest) {
  // タイマーを開始
  const startTime = Date.now();
  console.log("添削プロセス開始");

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    // デザイン情報を抽出するかどうかのフラグ
    const extractDesign = formData.get("extractDesign") === "true";
    
    // 追加のプロンプト（カスタム指示）を取得
    const customPrompt = formData.get("customPrompt") as string || "";
    
    // 直接テキスト入力の場合（ファイルではなくテキストから添削する場合）
    const directText = formData.get("text") as string || "";
    const isDirectText = !!directText;

    // 投稿ユーザー情報（認証を実装する場合に使用）
    const userName = formData.get("userName") as string || "ゲストユーザー";

    // ファイルの検証（直接テキスト入力の場合はスキップ）
    if (!isDirectText) {
      if (!file) {
        return NextResponse.json(
          { error: "ファイルがアップロードされていません" },
          { status: 400 }
        );
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: "無効なファイル形式です。PDF、Word、ODT、Excel、CSV、画像、テキストファイルに対応しています" },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "ファイルサイズが大きすぎます (最大10MB)" },
          { status: 400 }
        );
      }
    }

    let tempFilePath = '';
    let originalText = '';
    let fileType = '';
    let fileName = '';
    let fileSize = 0;

    // 処理開始時間のログ
    console.log(`ファイル処理開始: ${new Date().toISOString()}`);

    if (isDirectText) {
      // 直接テキスト入力の場合
      originalText = directText;
      fileName = "text_input.txt";
      fileType = "text/plain";
      fileSize = Buffer.byteLength(directText, 'utf8');
      
      // 一時ファイルを作成（APIの後続処理のため）
      tempFilePath = path.join(TEMP_DIR, `${uuidv4()}_${fileName}`);
      fs.writeFileSync(tempFilePath, directText);
    } else {
      // ファイルからの場合
      const buffer = Buffer.from(await file.arrayBuffer());
      fileName = file.name;
      fileType = file.type;
      fileSize = file.size;
      
      // ファイルを一時ディレクトリに保存
      tempFilePath = path.join(TEMP_DIR, `${uuidv4()}_${fileName}`);
      fs.writeFileSync(tempFilePath, buffer);
      
      // ファイルからテキストを抽出
      const processedFile = await processFile(tempFilePath, false);
      originalText = processedFile.originalText;
    }

    // キーワードチェック処理
    let processedText = originalText;
    let warnings: any[] = [];

    try {
      // 禁止キーワードのチェックと処理
      const keywordResult = await processRestrictedKeywords(originalText);
      
      if (!keywordResult.success) {
        console.warn("キーワードチェックエラー:", keywordResult.error_message);
        // エラーがあっても処理を継続
      } else if (keywordResult.containsRestricted) {
        // 禁止キーワードが見つかった場合
        processedText = keywordResult.text; // [機密情報] などに置換済みのテキスト
        
        // 添削対象外または要確認のキーワードに関する警告を収集
        for (const [keyword, action] of Object.entries(keywordResult.actions)) {
          warnings.push({
            keyword,
            action,
            message: action === '添削対象外' 
              ? `「${keyword}」は添削対象外として検出されました。該当部分は [${keyword}] に置換されています。` 
              : `「${keyword}」が検出されました。取り扱いにご注意ください。`
          });
        }
        
        console.log(`キーワードチェック: ${warnings.length}件の制限キーワードを検出しました`);
      }
    } catch (keywordError) {
      console.error("キーワード処理中のエラー:", keywordError);
    }

    // カスタムプロンプトのサニタイズ
    let sanitizedCustomPrompt = customPrompt;
    
    if (customPrompt) {
      try {
        const promptKeywordResult = await processRestrictedKeywords(customPrompt);
        if (promptKeywordResult.success && promptKeywordResult.containsRestricted) {
          // カスタムプロンプトから禁止キーワードを削除
          sanitizedCustomPrompt = promptKeywordResult.text;
          
          // 警告にプロンプト関連の情報を追加
          warnings.push({
            keyword: 'カスタムプロンプト',
            action: '自動置換',
            message: 'カスタムプロンプトに制限キーワードが含まれていたため、一部が置換されました。'
          });
          
          console.log("カスタムプロンプトから制限キーワードを削除しました");
        }
      } catch (promptError) {
        console.error("カスタムプロンプト処理中のエラー:", promptError);
      }
    }

    // テキスト添削プロセス
    console.log("テキスト添削を開始します...");
    let correctedText = '';
    let recommendationText = "";
    let designInfo = null;
    let jsonResponse = null;
   
    try {
      const result = await reviewTextWithGemini(
        processedText, // 処理済みのテキストを使用
        extractDesign,
        sanitizedCustomPrompt // 処理済みのカスタムプロンプトを渡す
      );

      // Geminiからの返り値をチェック
      recommendationText = result.recommendationText || "";
      correctedText = result.correctedText || ""; // デフォルト値を設定
      designInfo = result.designInfo;
      jsonResponse = result.jsonResponse; // JSONレスポンスがあれば保存
      if (!recommendationText){
        throw new Error("推薦書作成に失敗しました")
      }
      // correctedText が空文字の場合のエラーチェック
      if (!correctedText) {
        throw new Error("テキストの添削に失敗しました。");
      }
    } catch (reviewError) {
      console.error("テキスト添削中のエラー:", reviewError);
      throw reviewError;
    }

    console.log("テキスト添削が完了しました");

    // 添削されたテキストでファイルを更新
    const processedFile = {
      originalText,
      filePath: tempFilePath,
      fileName,
      fileType: path.extname(fileName),
      designInfo
    };
    
    const reviewedFilePath = await updateFileWithReviewedText(correctedText, processedFile);
    console.log(`添削済みファイルを作成しました: ${path.basename(reviewedFilePath)}`);
    
    // PDF変換処理
    let pdfUrl = null;
    let pdfFilePath = null;
    if (fileType === 'text/plain' || 
        fileType === 'application/msword' || 
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileType === 'application/vnd.oasis.opendocument.text') {
      try {
        pdfFilePath = await convertToPdfWithLibreOffice(reviewedFilePath);
        pdfUrl = `/api/download?file=${encodeURIComponent(path.basename(pdfFilePath))}&type=pdf`;
        console.log(`PDFを生成しました: ${path.basename(pdfFilePath)}`);
      } catch (pdfError) {
        console.warn("PDFへの変換中にエラーが発生しました:", pdfError);
      }
    }

    // 添削結果のファイル名を設定
    const downloadFileName = `reviewed_${fileName}`;
    
    // メタデータを準備
    const metadata = {
      fileType,
      fileSize,
      originalFileName: fileName,
      reviewedFileName: downloadFileName,
      designInfoAvailable: !!designInfo,
      hasPdf: !!pdfFilePath,
      processedAt: new Date().toISOString(),
      customPrompt: sanitizedCustomPrompt || undefined,
      originalText, // 元のテキストもメタデータに保存
      correctedText, // 添削後のテキストもメタデータに保存
      recommendationText,
      localFilePath: path.basename(reviewedFilePath),
      hasWarnings: warnings.length > 0,
      warningsCount: warnings.length,
      pdfUrl,
      warnings: warnings.length > 0 ? warnings : undefined
    };
    
    // データベースに保存
    let saveResult;
    try {
      saveResult = await saveResumeFile(
        downloadFileName,
        path.basename(reviewedFilePath),
        userName,
        metadata
      );

      // 保存結果をログ出力
      console.log("Supabaseへの保存結果:", {
        success: saveResult.success,
        fileId: saveResult.file_id,
        error: saveResult.error
      });
    } catch (saveError) {
      console.error("ファイル保存中の予期せぬエラー:", saveError);
    }

    // 結果を返す
    const response: any = {
      originalText,
      correctedText,
      recommendationText,
      fileType,
      downloadUrl: `/api/download?file=${encodeURIComponent(path.basename(reviewedFilePath))}`,
      downloadFileName,
      reviewedFilePath: path.basename(reviewedFilePath),
      fileSize,
      jsonResponse,
      metadata: {
        warnings,
        pdfUrl
      }
    };
    
    // ファイルIDがある場合は追加
    if (saveResult?.success && saveResult.file_id) {
      response.fileId = saveResult.file_id;
    }
    
    // デザイン情報を抽出した場合はレスポンスに追加
    if (extractDesign && designInfo) {
      response.designInfo = designInfo;
    }
    
    // PDF変換が成功した場合はダウンロードURLを追加
    if (pdfFilePath) {
      response.pdfDownloadUrl = `/api/download?file=${encodeURIComponent(path.basename(pdfFilePath))}&type=pdf`;
    }
      
      console.log(recommendationText)
        // 処理時間のログ
    const endTime = Date.now();
    console.log(`添削プロセス完了 - 総処理時間: ${(endTime - startTime) / 1000}秒`);

    return NextResponse.json(response);
  } catch (error) {
    console.error("予期せぬエラーが発生:", error);
    
    // エラーメッセージをより詳細に
    let errorMessage = "予期せぬエラーが発生しました";
    let errorDetails = {};
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    
    return NextResponse.json({ 
      error: errorMessage, 
      errorDetails 
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const fileParam = url.searchParams.get('file');
    const fileType = url.searchParams.get('type') || 'text';
    
    if (!fileParam) {
      return NextResponse.json({ error: "ファイル名が指定されていません" }, { status: 400 });
    }
    
    // ファイル名にパスが含まれていないことを確認（セキュリティ対策）
    if (fileParam.includes('/') || fileParam.includes('\\')) {
      return NextResponse.json({ error: "無効なファイル名です" }, { status: 400 });
    }
    
    const filePath = path.join(TEMP_DIR, fileParam);
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "ファイルが見つかりません" }, { status: 404 });
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    
    // コンテンツタイプを設定
    let contentType = 'text/plain';
    if (fileType === 'pdf') {
      contentType = 'application/pdf';
    } else if (path.extname(filePath).toLowerCase() === '.docx') {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (path.extname(filePath).toLowerCase() === '.doc') {
      contentType = 'application/msword';
    } else if (path.extname(filePath).toLowerCase() === '.xlsx') {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (path.extname(filePath).toLowerCase() === '.xls') {
      contentType = 'application/vnd.ms-excel';
    } else if (path.extname(filePath).toLowerCase() === '.csv') {
      contentType = 'text/csv';
    }
    
    // レスポンスを作成
    const response = new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileParam)}"`,
      },
    });
    
    return response;
  } catch (error) {
    console.error("Error downloading file:", error);
    return NextResponse.json({ error: "ファイルのダウンロード中にエラーが発生しました" }, { status: 500 });
  }
}