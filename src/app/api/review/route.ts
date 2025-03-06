import { NextRequest, NextResponse } from "next/server";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { processFile, reviewTextWithGemini, updateFileWithReviewedText, convertToPdfWithLibreOffice } from "@/lib/file-processor";

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
  "text/plain" // テキストファイルも許可
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    // デザイン情報を抽出するかどうかのフラグ
    const extractDesign = formData.get("extractDesign") === "true";

    // ファイルの検証
    if (!file) {
      return NextResponse.json(
        { error: "ファイルがアップロードされていません" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "無効なファイル形式です。PDF、Word、ODT、テキストファイルのみ対応しています" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "ファイルサイズが大きすぎます (最大10MB)" },
        { status: 400 }
      );
    }

    // ファイルを一時ディレクトリに保存
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name;
    const tempFilePath = path.join(TEMP_DIR, `${uuidv4()}_${fileName}`);
    fs.writeFileSync(tempFilePath, buffer);

    try {
      // ファイルを処理
      const processedFile = await processFile(tempFilePath, false); // extractDesign フラグは不要になった

      // テキストの添削とデザイン情報の取得（Geminiから一緒に返される）
      console.log("テキスト添削を開始します...");
      const result = await reviewTextWithGemini(
        processedFile.originalText, 
        extractDesign
      );
      const correctedText = result.correctedText || result;
      const designInfo = result.designInfo;
      console.log("テキスト添削が完了しました");

      // 添削されたテキストでファイルを更新
      const reviewedFilePath = await updateFileWithReviewedText(correctedText, processedFile);
      
      // 結果のダウンロード情報
      let downloadInfo = {
        textFilePath: reviewedFilePath,
        pdfFilePath: null as string | null
      };
      
      // PDFに変換（テキストファイルとWordファイルの場合）
      if (file.type === 'text/plain' || 
          file.type === 'application/msword' || 
          file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          file.type === 'application/vnd.oasis.opendocument.text') {
        try {
          const pdfPath = await convertToPdfWithLibreOffice(reviewedFilePath);
          downloadInfo.pdfFilePath = pdfPath;
        } catch (pdfError) {
          console.warn("PDFへの変換中にエラーが発生しました:", pdfError);
          // PDF変換の失敗はプロセス全体を停止させない
        }
      }

      // 結果を返す
      const downloadFileName = `reviewed_${fileName}`;
      const response: any = {
        originalText: processedFile.originalText,
        correctedText: correctedText,
        fileType: processedFile.fileType.replace('.', ''),
        downloadUrl: `/api/download?file=${encodeURIComponent(path.basename(reviewedFilePath))}`,
        downloadFileName: downloadFileName
      };
      
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
    }
    
    // レスポンスを作成
    const response = new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileParam}"`,
      },
    });
    
    return response;
  } catch (error) {
    console.error("Error downloading file:", error);
    return NextResponse.json({ error: "ファイルのダウンロード中にエラーが発生しました" }, { status: 500 });
  }
}