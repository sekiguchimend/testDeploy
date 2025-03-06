"use client";

import { useState } from "react";
import { FileUpload } from "@/components/FileUpload";
import  ComparisonView  from "@/components/ComparisonView";
import { DownloadDialog } from "@/components/DownloadDialog";

const Index = () => {
  const [originalText, setOriginalText] = useState<string>("");
  const [correctedText, setCorrectedText] = useState<string>("");
  const [designInfo, setDesignInfo] = useState<any>(null);
  const [downloadUrl, setDownloadUrl] = useState<string>("");
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState<string>("");
  const [showComparison, setShowComparison] = useState<boolean>(false);

  // ファイル処理後にオリジナルと添削後のテキストをセットする
  const handleFileProcessed = (data: any) => {
    setOriginalText(data.originalText);
    setCorrectedText(data.correctedText);
    setDesignInfo(data.designInfo);
    setDownloadUrl(data.downloadUrl);
    if (data.pdfDownloadUrl) {
      setPdfDownloadUrl(data.pdfDownloadUrl);
    }
    if(data.designInfo){
      console.log("あるよ")
    }else{
      console.log("ない")
    }
    setShowComparison(true); // 比較表示を有効にする
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <h1 className="text-lg font-semibold text-gray-900">
            履歴書レビュープラットフォーム
          </h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              プロフェッショナルな履歴書添削
            </h2>
            <p className="mt-2 text-xl text-gray-600">
              あなたの履歴書を魅力的に
            </p>
            <p className="mt-4 text-gray-500 max-w-2xl mx-auto">
              履歴書をアップロードして、プロフェッショナルなフィードバックを受け取りましょう。
              リアルタイムで変更を確認し、改善された履歴書をダウンロードできます。
            </p>
          </div>

          {/* ファイルアップロードコンポーネント */}
          <FileUpload onFileProcessed={handleFileProcessed} />

          {/* 比較表示 */}
          {showComparison && (
            <div className="mt-8">
              <ComparisonView
                originalText={originalText}
                correctedText={correctedText}
                designInfo={designInfo}
              />
            </div>
            
          )}

          {/* ダウンロードダイアログ */}
          {showComparison && (
            <div className="mt-8">
              <DownloadDialog 
                downloadUrl={downloadUrl}
                pdfDownloadUrl={pdfDownloadUrl}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;