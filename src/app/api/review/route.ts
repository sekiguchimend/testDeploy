import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PDFDocument } from "pdf-lib";
import { Document, Packer, Paragraph, TextRun } from "docx";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

// Google Generative AI の設定
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY が設定されていません。");
}
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: Request) {
  try {
    // FormData を取得
    const formData = await req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return NextResponse.json({ error: "ファイルがありません" }, { status: 400 });
    }
    
    const fileType = file.type;
    // ファイルバッファを取得（Buffer に変換）
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    let text: string;
    
    // ファイルタイプに応じたテキスト抽出
    if (fileType === "application/pdf") {
      const pdfData = await pdfParse(fileBuffer);
      text = pdfData.text.trim();
      if (!text) {
        throw new Error("PDFからテキストを抽出できませんでした");
      }
    } else if (
      fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileType === "application/msword"
    ) {
      const extractedText = await mammoth.extractRawText({ buffer: fileBuffer });
      text = extractedText.value.trim();
      if (!text) {
        throw new Error("Wordファイルからテキストを抽出できませんでした");
      }
    } else {
      return NextResponse.json(
        { error: "PDFまたはWordファイルをアップロードしてください" },
        { status: 400 }
      );
    }
    
    // Gemini API で添削（プロンプトを生成してリクエスト）
    const prompt = `次の文章を添削してください。添削結果はファイル形式で返してください:\n\n${text}`;
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);

    // Gemini APIのレスポンスをログに出力
    console.log("Gemini API response:", result.response);

    // レスポンスが空の場合
    if (!result.response || Object.keys(result.response).length === 0) {
      console.error("Gemini APIからのレスポンスが空です");
      return NextResponse.json(
        { error: "Gemini APIからのレスポンスが空です" },
        { status: 500 }
      );
    }

    // Gemini API が返した結果がファイル形式であることを確認
    if (result.response?.file) {
      // 修正されたファイル（バイナリデータ）を取得
      const correctedFileBuffer = result.response.file;

      // ファイルタイプに応じた出力
      if (fileType === "application/pdf") {
        return new NextResponse(correctedFileBuffer, {
          headers: {
            "Content-Disposition": "attachment; filename=\"corrected_document.pdf\"",
            "Content-Type": "application/pdf",
          },
        });
      } else if (fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || fileType === "application/msword") {
        return new NextResponse(correctedFileBuffer, {
          headers: {
            "Content-Disposition": "attachment; filename=\"corrected_document.docx\"",
            "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
        });
      }
    } else if (typeof result.response?.text === "function") {
      // `text`が関数の場合、その関数を実行して結果を取得
      const correctedText = await result.response.text();
      return NextResponse.json({ text: correctedText });
    } else {
      console.error("添削結果がファイル形式でも文字列でもありません");
      throw new Error("添削結果がファイル形式でも文字列でもありません");
    }

  } catch (error) {
    console.error("Server Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
