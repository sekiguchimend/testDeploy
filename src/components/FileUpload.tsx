"use client";

import { useState, useCallback } from "react";
import { FileText, Upload, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ComparisonView } from "./ComparisonView";

export const FileUpload = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState("");
  const [progress, setProgress] = useState(0);
  const [processedData, setProcessedData] = useState<{
    originalText: string;
    correctedText: string;
    downloadUrl?: string;
    downloadFileName?: string;
  } | null>(null);
  
  const { toast } = useToast();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  }, []);

  const simulateProgress = () => {
    setProgress(0);
    let currentProgress = 0;
    
    const stages = [
      "ファイルをアップロード中...",
      "テキストを抽出中...",
      "デザインデータを解析中...",
      "AI添削を実行中...",
      "ドキュメントを再構成中..."
    ];
    
    const interval = setInterval(() => {
      currentProgress += 2;
      setProgress(currentProgress);
      
      // ステージ変更
      const stageIndex = Math.floor(currentProgress / 20);
      if (stageIndex < stages.length) {
        setProcessingStage(stages[stageIndex]);
      }
      
      if (currentProgress >= 100) {
        clearInterval(interval);
      }
    }, 200);
    
    return () => clearInterval(interval);
  };

  const handleFile = async (file: File) => {
    if (
      file.type === "application/pdf" ||
      file.type === "application/msword" ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append("file", file);

      // 進捗シミュレーション開始
      const stopSimulation = simulateProgress();

      try {
        const res = await fetch("/api/review", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          throw new Error(`HTTP エラー: ${res.status}`);
        }

        const data = await res.json();
        
        if (data.error) {
          throw new Error(data.error);
        }

        setProcessedData({
          originalText: data.originalText,
          correctedText: data.correctedText,
          downloadUrl: data.downloadUrl,
          downloadFileName: data.downloadFileName
        });

        // 進捗を100%に設定
        setProgress(100);
        setProcessingStage("処理完了");

        toast({
          title: "ファイルの処理が完了しました",
          description: "テキストの添削が完了しました。",
        });
      } catch (error) {
        console.error("ファイル処理中にエラーが発生しました:", error);
        toast({
          title: "処理エラー",
          description: error instanceof Error ? error.message : "ファイルの処理中に問題が発生しました。",
          variant: "destructive",
        });
      } finally {
        // 進捗シミュレーションを停止
        stopSimulation();
        setIsProcessing(false);
      }
    } else {
      toast({
        title: "対応していないファイル形式",
        description: "PDFまたはWord形式のファイルをアップロードしてください。",
        variant: "destructive",
      });
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, []);

  const handleReset = () => {
    setProcessedData(null);
    setProgress(0);
    setProcessingStage("");
  };

  const handleDownload = () => {
    if (processedData?.downloadUrl) {
      window.location.href = processedData.downloadUrl;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 animate-fadeIn">
      {processedData ? (
        <div className="space-y-6">
          <ComparisonView 
            originalText={processedData.originalText} 
            correctedText={processedData.correctedText} 
          />
          
          <div className="flex justify-center space-x-4 mt-8">
            {processedData.downloadUrl && (
              <Button 
                onClick={handleDownload}
                className="flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>添削済みファイルをダウンロード</span>
              </Button>
            )}
            
            <Button 
              variant="outline" 
              onClick={handleReset}
              className="flex items-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>別のファイルをアップロード</span>
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="w-full"
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div
            className={`relative p-12 rounded-lg border-2 border-dashed transition-all duration-200 ease-in-out
              ${isDragging ? "border-primary bg-primary/5" : "border-gray-200 hover:border-primary/50"}
              ${isProcessing ? "opacity-90" : ""}
            `}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center space-y-6">
                <div className="p-4 rounded-full bg-primary/5">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
                <div className="text-center space-y-4 w-full max-w-md">
                  <h3 className="text-lg font-semibold">{processingStage}</h3>
                  <Progress value={progress} className="h-2 w-full" />
                  <p className="text-sm text-gray-500">
                    しばらくお待ちください...
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="p-4 rounded-full bg-primary/5">
                  {isDragging ? (
                    <FileText className="w-8 h-8 text-primary animate-bounce" />
                  ) : (
                    <Upload className="w-8 h-8 text-primary" />
                  )}
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold">
                    {isDragging ? "ここにファイルをドロップ" : "履歴書をアップロード"}
                  </h3>
                  <p className="text-sm text-gray-500">
                    ファイルをドラッグ＆ドロップするか、クリックして選択してください
                  </p>
                  <p className="text-xs text-gray-400">
                    対応フォーマット: PDF、Word (.doc, .docx)
                  </p>
                </div>
                <input
                  type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0];
                    if (selectedFile) {
                      handleFile(selectedFile);
                    }
                  }}
                  disabled={isProcessing}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;