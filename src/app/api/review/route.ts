import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { z } from "zod";

// 環境変数の検証
const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
});

const env = envSchema.safeParse({
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
});

if (!env.success) {
  throw new Error("Missing or invalid environment variables");
}

const genAI = new GoogleGenerativeAI(env.data.GEMINI_API_KEY);

// ファイルタイプの検証
const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
] as const;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

class FileProcessingError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = "FileProcessingError";
  }
}

// Wordファイルからテキストと形式情報を抽出
async function extractWordContent(buffer: Buffer) {
  try {
    // テキストの抽出
    const textResult = await mammoth.extractRawText({ buffer });
    // HTMLの抽出（スタイル情報を含む）
    const htmlResult = await mammoth.convertToHtml({ buffer });
    
    return {
      text: textResult.value,
      html: htmlResult.value,
      // 元のドキュメント構造も保持
      originalBuffer: buffer,
    };
  } catch (error) {
    throw new FileProcessingError("Wordファイルの解析に失敗しました", 500);
  }
}

// PDFからテキストを抽出
async function extractPdfContent(buffer: Buffer) {
  try {
    const pdfData = await pdfParse(buffer);
    return {
      text: pdfData.text,
      originalBuffer: buffer,
    };
  } catch (error) {
    throw new FileProcessingError("PDFファイルの解析に失敗しました", 500);
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    // ファイルの検証
    if (!file) {
      throw new FileProcessingError("ファイルがアップロードされていません");
    }

    if (!ALLOWED_TYPES.includes(file.type as any)) {
      throw new FileProcessingError("無効なファイル形式です。PDFまたはWordファイルをアップロードしてください");
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new FileProcessingError("ファイルサイズが大きすぎます (最大10MB)");
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    let content;

    // ファイルタイプに応じた処理
    if (file.type === "application/pdf") {
      content = await extractPdfContent(fileBuffer);
    } else {
      content = await extractWordContent(fileBuffer);
    }

    if (!content.text.trim()) {
      throw new FileProcessingError("ファイルからテキストを抽出できませんでした");
    }

    // AIによる添削
    const prompt = `以下の職務経歴書を添削してください。
    注意点：
    - 元の文章構造は維持してください
    - 具体的な成果や数値を強調してください
    - 曖昧な表現は具体的に修正してください
    - 誤字脱字を修正してください
    - 元の文章と同じか少し多いくらいの文章量にしてください
    
    原文:
    ${content.text}`;

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const correctedText = response.text();

      // Wordファイルの場合
      if ('html' in content) {
        return NextResponse.json({
          originalText: content.html, // 元のHTML形式を保持
          correctedText: correctedText, // 添削されたテキスト
          fileType: "word",
        });
      } 
      // PDFの場合
      else {
        return NextResponse.json({
          originalText: content.text,
          correctedText: correctedText,
          fileType: "pdf",
        });
      }

    } catch (error) {
      throw new FileProcessingError("AI処理中にエラーが発生しました", 500);
    }
  } catch (error) {
    console.error("Error processing file:", error);
    
    if (error instanceof FileProcessingError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: "予期せぬエラーが発生しました" },
      { status: 500 }
    );
  }
}