import { NextRequest, NextResponse } from "next/server";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { processFile, reviewTextWithGemini, updateFileWithReviewedText, convertToPdfWithLibreOffice } from "@/lib/file-processor";
import { saveResumeFile } from "@/lib/resumeService";
import { processRestrictedKeywords } from "@/lib/keywordService";
import supabase from "@/lib/supabase";

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

export async function POST(req: NextRequest) {
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

    try {
      // 禁止キーワードのチェックと処理
      const keywordResult = await processRestrictedKeywords(originalText);
      let processedText = originalText;
      let warnings = [];
      
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

      // カスタムプロンプトを準備（禁止キーワードが含まれていないか確認）
      let sanitizedCustomPrompt = customPrompt;
      
      if (customPrompt) {
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
      }

      // テキストの添削とデザイン情報の取得
      console.log("テキスト添削を開始します...");
      const result = await reviewTextWithGemini(
        processedText, // 処理済みのテキストを使用
        extractDesign,
        sanitizedCustomPrompt // 処理済みのカスタムプロンプトを渡す
      );

      // Geminiからの返り値をチェック
      const correctedText = result.correctedText || ""; // デフォルト値を設定
      const designInfo = result.designInfo;
      const jsonResponse = result.jsonResponse; // JSONレスポンスがあれば保存

      // correctedText が空文字の場合のエラーチェック
      if (!correctedText) {
        throw new Error("テキストの添削に失敗しました。");
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
      
      // 結果のダウンロード情報
      let downloadInfo = {
        textFilePath: reviewedFilePath,
        pdfFilePath: null as string | null
      };
      
      // PDFに変換（テキストファイルとWordファイルの場合）
      if (fileType === 'text/plain' || 
          fileType === 'application/msword' || 
          fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          fileType === 'application/vnd.oasis.opendocument.text') {
        try {
          const pdfPath = await convertToPdfWithLibreOffice(reviewedFilePath);
          downloadInfo.pdfFilePath = pdfPath;
        } catch (pdfError) {
          console.warn("PDFへの変換中にエラーが発生しました:", pdfError);
          // PDF変換の失敗はプロセス全体を停止させない
        }
      }

      // 添削結果のファイル名を設定（表示用）
      const downloadFileName = `reviewed_${fileName}`;
      
      // ローカルパスのみを使用し、Supabaseは使用しない
      let fileId: number | undefined;
      let localFilePath = reviewedFilePath;
      
      try {
        // 保存用のメタデータを作成
        const metadata = {
          fileType,
          fileSize,
          originalFileName: fileName,
          reviewedFileName: downloadFileName,
          designInfoAvailable: !!designInfo,
          hasPdf: !!downloadInfo.pdfFilePath,
          processedAt: new Date().toISOString(),
          customPrompt: sanitizedCustomPrompt || undefined,
          originalText, // 元のテキストもメタデータに保存
          correctedText, // 添削後のテキストもメタデータに保存
          localFilePath: path.basename(reviewedFilePath), // ローカルファイルパスを保存
          hasWarnings: warnings.length > 0,
          warningsCount: warnings.length
        };
        
        // データベースに保存（ファイルパスはローカルのパスを使用）
        const saveResult = await saveResumeFile(
          downloadFileName,
          path.basename(reviewedFilePath), // ファイル名のみを保存
          userName,metadata
          
          
        );
        
        if (saveResult.success) {
          fileId = saveResult.file_id;
          console.log(`ファイル情報をデータベースに保存しました。ID: ${fileId}`);
        }
      } catch (dbError) {
        console.error("ファイル情報の保存エラー:", dbError);
        // データベース保存の失敗はプロセス全体を停止させない
      }

      // 結果を返す
      const response: any = {
        originalText: originalText,
        correctedText: correctedText,
        fileType: fileType,
        downloadUrl: `/api/download?file=${encodeURIComponent(path.basename(reviewedFilePath))}`,
        downloadFileName: downloadFileName,
        reviewedFilePath: path.basename(reviewedFilePath),
        fileSize: fileSize,
        jsonResponse: jsonResponse
      };
      
      // 警告がある場合はレスポンスに追加
      if (warnings.length > 0) {
        response.warnings = warnings;
      }
      
      // ファイルIDがある場合は追加
      if (fileId) {
        response.fileId = fileId;
      }
      
      // デザイン情報を抽出した場合はレスポンスに追加
      if (extractDesign && designInfo) {
        response.designInfo = designInfo;
      }
      
      // PDF変換が成功した場合はダウンロードURLを追加
      if (downloadInfo.pdfFilePath) {
        response.pdfDownloadUrl = `/api/download?file=${encodeURIComponent(path.basename(downloadInfo.pdfFilePath))}&type=pdf`;
      }

      return NextResponse.json(response);
    } catch (processError) {
      // 一時ファイルを削除（エラー処理）
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (cleanupError) {
        console.error("一時ファイル削除中にエラーが発生:", cleanupError);
      }

      throw processError; // 元のエラーを再スロー
    }
  } catch (error) {
    console.error("Error processing file:", error);
    
    // エラーメッセージをより詳細に
    let errorMessage = "予期せぬエラーが発生しました";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// 添削結果ファイルのダウンロード用のエンドポイント
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