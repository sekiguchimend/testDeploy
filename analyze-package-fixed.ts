// analyze-package.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

// 利用可能なモデルを表示する関数
async function listAvailableModels() {
  try {
    const API_KEY = process.env.GEMINI_API_KEY;
    
    if (!API_KEY) {
      console.error("GEMINI_API_KEY環境変数が設定されていません");
      return;
    }
    
    console.log("@google/generative-ai ライブラリを使用中");
    
    // 標準の初期化方法
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    // 利用可能なモデルを確認
    console.log("利用可能なモデルを確認しています...");
    
    try {
      const modelInfo = genAI.getGenerativeModel({ model: "gemini-pro" });
      console.log("モデル 'gemini-pro' のインスタンスを作成しました");
      
      // シンプルな生成テスト
      const result = await modelInfo.generateContent("テスト");
      console.log("生成テスト結果:", result ? "成功" : "失敗");
    } catch (modelError: any) {
      console.error("gemini-pro モデル取得エラー:", modelError?.message || "不明なエラー");
    }
    
  } catch (error: any) {
    console.error("エラーが発生しました:", error?.message || "不明なエラー");
  }
}

// 実行
listAvailableModels();