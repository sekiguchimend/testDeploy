"use client";

import { useState, useCallback, useEffect } from "react";
import { FileText, Upload, Download, MessageSquare, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from "@/components/ui/dialog";
import ComparisonView from "./ComparisonView";
import { DownloadDialog } from "./DownloadDialog";

// DownloadDialogコンポーネントのプロパティ型を定義
interface DownloadDialogProps {
  downloadUrl?: string;
  fileName?: string;
  fileSize?: number;
  designInfo?: any;
  correctedText?: string;
}

// コンポーネントのプロパティ型を定義
interface FileUploadProps {
  onFileProcessed?: (data: {
    originalText: string;
    correctedText: string;
    designInfo?: any;
    downloadUrl: string;
    pdfDownloadUrl?: string;
  }) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileProcessed }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState("");
  const [progress, setProgress] = useState(0);
  const [customPrompt, setCustomPrompt] = useState("");
  const [extractDesign, setExtractDesign] = useState(true);
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false);
  const [isRereviewDialogOpen, setIsRereviewDialogOpen] = useState(false);
  const [isRereviewProcessing, setIsRereviewProcessing] = useState(false); // 再添削処理中のステータス
  const [rereviewStage, setRereviewStage] = useState(""); // 再添削のステージ表示
  const [rereviewProgress, setRereviewProgress] = useState(0); // 再添削の進捗状況
  const [processedData, setProcessedData] = useState<{
    originalText: string;
    correctedText: string;
    downloadUrl?: string;
    downloadFileName?: string;
    designInfo?: any;
    pdfDownloadUrl?: string;
    jsonResponse?: any;
  } | null>(null);
  const [fileInfo, setFileInfo] = useState<{
    reviewedFilePath?: string;
    originalWithDesignPath?: string;
    fileName?: string;
    fileSize?: number;
  }>({});

  // onFileProcessedコールバックが変更されたら、processedDataに基づいて呼び出す
  useEffect(() => {
    if (onFileProcessed && processedData) {
      onFileProcessed({
        originalText: processedData.originalText,
        correctedText: processedData.correctedText,
        designInfo: processedData.designInfo,
        downloadUrl: processedData.downloadUrl || '',
        pdfDownloadUrl: processedData.pdfDownloadUrl
      });
    }
  }, [onFileProcessed, processedData]);

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
  
  // 再添削用の進捗状況シミュレーション
  const simulateRereviewProgress = () => {
    setRereviewProgress(0);
    let currentProgress = 0;
    
    const stages = [
      "前回の添削結果を分析中...",
      "改善ポイントを特定中...",
      "AI再添削を実行中...",
      "ドキュメントを最適化中...",
      "最終仕上げ中..."
    ];
    
    const interval = setInterval(() => {
      currentProgress += 2;
      setRereviewProgress(currentProgress);
      
      // ステージ変更
      const stageIndex = Math.floor(currentProgress / 20);
      if (stageIndex < stages.length) {
        setRereviewStage(stages[stageIndex]);
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
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.name.endsWith('.txt') // テキストファイルもサポート
    ) {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("extractDesign", extractDesign.toString());
      
      // カスタムプロンプトがある場合は追加
      if (customPrompt) {
        formData.append("customPrompt", customPrompt);
      }

      // 進捗シミュレーション開始
      const stopSimulation = simulateProgress();

      try {
        // 通常のレビューAPI呼び出し
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

        // 処理結果を設定
        const processedDataResult = {
          originalText: data.originalText,
          correctedText: data.correctedText,
          downloadUrl: data.downloadUrl,
          downloadFileName: data.downloadFileName,
          designInfo: data.designInfo,
          pdfDownloadUrl: data.pdfDownloadUrl,
          jsonResponse: data.jsonResponse
        };

        setProcessedData(processedDataResult);

        // ダウンロード用のファイル情報を設定
        setFileInfo({
          reviewedFilePath: data.reviewedFilePath || data.downloadFileName,
          originalWithDesignPath: data.originalWithDesignPath,
          fileName: file.name,
          fileSize: file.size
        });

        // 進捗を100%に設定
        setProgress(100);
        setProcessingStage("処理完了");
        
        // カスタムプロンプトをリセット
        setCustomPrompt("");

        console.log("ファイルの処理が完了しました");
      } catch (error) {
        console.error("ファイル処理中にエラーが発生しました:", error);
        console.log("ファイルの処理中に問題が発生しました。");
      } finally {
        // 進捗シミュレーションを停止
        stopSimulation();
        setIsProcessing(false);
        setIsPromptDialogOpen(false);
      }
    } else {
      console.log("PDF、Word、またはテキスト形式のファイルをアップロードしてください。");
    }
  };

  const handleRereview = async () => {
    if (!processedData?.correctedText) return;
    
    // ダイアログを閉じる
    setIsRereviewDialogOpen(false);
    
    // 再添削処理中の状態を設定
    setIsRereviewProcessing(true);
    
    // 進捗シミュレーション開始
    const stopSimulation = simulateRereviewProgress();
    
    try {
      // フォームデータの準備
      const formData = new FormData();
      formData.append("text", processedData.correctedText);
      formData.append("extractDesign", extractDesign.toString());
      
      if (customPrompt) {
        formData.append("customPrompt", customPrompt);
      }
      
      // APIリクエスト
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
      
      // 処理結果を設定
      const processedDataResult = {
        originalText: processedData.correctedText,  // 前回の添削結果が今回の元テキスト
        correctedText: data.correctedText,
        downloadUrl: data.downloadUrl,
        downloadFileName: data.downloadFileName,
        designInfo: data.designInfo,
        pdfDownloadUrl: data.pdfDownloadUrl,
        jsonResponse: data.jsonResponse
      };
      
      setProcessedData(processedDataResult);
      
      // ダウンロード用のファイル情報を設定
      setFileInfo({
        reviewedFilePath: data.reviewedFilePath || data.downloadFileName,
        originalWithDesignPath: data.originalWithDesignPath,
        fileName: fileInfo.fileName || data.downloadFileName || "reviewed_text.txt",
        fileSize: data.fileSize || Buffer.byteLength(data.correctedText, 'utf8')
      });
      
      // 進捗を100%に設定
      setRereviewProgress(100);
      setRereviewStage("処理完了");
      
      // カスタムプロンプトをリセット
      setCustomPrompt("");
      
      console.log("再添削が完了しました");
    } catch (error) {
      console.error("再添削中にエラーが発生しました:", error);
      console.log("再添削中に問題が発生しました。");
    } finally {
      // 進捗シミュレーションを停止
      stopSimulation();
      setIsRereviewProcessing(false);
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
    setFileInfo({});
    setProgress(0);
    setProcessingStage("");
    setRereviewProgress(0);
    setRereviewStage("");
    setCustomPrompt("");
  };

  const openPromptDialog = () => {
    setIsPromptDialogOpen(true);
  };

  const openRereviewDialog = () => {
    setIsRereviewDialogOpen(true);
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 animate-fadeIn">
      {/* プロンプト設定ダイアログ */}
      <Dialog open={isPromptDialogOpen} onOpenChange={setIsPromptDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>添削の詳細設定</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customPrompt">AIへの追加指示</Label>
              <Textarea
                id="customPrompt"
                placeholder="例: 「ITエンジニアとしてのスキルをより強調してください」、「営業職向けにアピールポイントを強化してください」"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="min-h-[150px]"
              />
              <p className="text-xs text-gray-500">
                添削時にAIへの追加指示を設定できます。例えば、特定の業界向けの強調ポイントや、表現方法の指定などが可能です。
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="extractDesign"
                checked={extractDesign}
                onCheckedChange={setExtractDesign}
              />
              <Label htmlFor="extractDesign">デザイン情報を抽出する</Label>
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline"
              onClick={() => setIsPromptDialogOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => setIsPromptDialogOpen(false)}
            >
              設定を適用
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 再添削設定ダイアログ */}
      <Dialog open={isRereviewDialogOpen} onOpenChange={setIsRereviewDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>再添削の設定</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reReviewPrompt">追加の指示（任意）</Label>
              <Textarea
                id="reReviewPrompt"
                placeholder="例: 「より簡潔な表現にしてください」、「具体的な数値をさらに追加してください」"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="min-h-[150px]"
              />
              <p className="text-xs text-gray-500">
                すでに添削された文章をさらに改善するための指示を入力できます。空欄の場合は一般的な添削が行われます。
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="extractDesignReReview"
                checked={extractDesign}
                onCheckedChange={setExtractDesign}
              />
              <Label htmlFor="extractDesignReReview">デザイン情報を抽出する</Label>
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline"
              onClick={() => setIsRereviewDialogOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleRereview}
              disabled={isRereviewProcessing}
            >
              再添削を実行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {processedData ? (
        <div className="space-y-6">
          {/* 再添削中のローディング表示 */}
          {isRereviewProcessing && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
                <div className="flex flex-col items-center justify-center space-y-6">
                  <div className="p-4 rounded-full bg-primary/5">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                  <div className="text-center space-y-4 w-full">
                    <h3 className="text-lg font-semibold">{rereviewStage}</h3>
                    <Progress value={rereviewProgress} className="h-2 w-full" />
                    <p className="text-sm text-gray-500">
                      再添削の処理中です。しばらくお待ちください...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* 添削結果表示 */}
          <ComparisonView 
            originalText={processedData.originalText} 
            correctedText={processedData.correctedText}
            designInfo={processedData.designInfo}
            jsonResponse={processedData.jsonResponse}
          />
          
          {/* 操作ボタン */}
          <div className="flex flex-wrap justify-center gap-4 mt-8">
            {/* ダウンロードボタン */}
            {(processedData.downloadUrl || fileInfo.reviewedFilePath) && (
              <DownloadDialog 
                downloadUrl={processedData.downloadUrl || fileInfo.reviewedFilePath}
                fileName={fileInfo.fileName || processedData.downloadFileName}
                fileSize={fileInfo.fileSize}
                designInfo={processedData.designInfo}
                correctedText={processedData.correctedText}
              />
            )}
            
            {/* 再添削ボタン */}
            <Button 
              variant="secondary" 
              onClick={openRereviewDialog}
              className="gap-2 bg-gradient-to-r from-secondary/90 to-secondary hover:from-secondary hover:to-secondary/90 transition-all duration-300 shadow-lg hover:shadow-xl px-6 py-6 rounded-xl"
              disabled={isRereviewProcessing}
            >
              <Repeat className="w-5 h-5" />
              <span>添削結果をさらに改善</span>
            </Button>
            
            {/* 新規ファイルボタン */}
            <Button 
              variant="outline" 
              onClick={handleReset}
              className="gap-2 px-6 py-6 rounded-xl"
              disabled={isRereviewProcessing}
            >
              <Upload className="w-5 h-5" />
              <span>別のファイルをアップロード</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="w-full">
          {/* 添削設定ボタン (ドロップエリア外) */}
          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              onClick={openPromptDialog}
              className="gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              添削の詳細設定
            </Button>
          </div>
          
          {/* ファイルドロップエリア */}
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
                      対応フォーマット: PDF、Word (.doc, .docx)、テキスト (.txt)
                    </p>
                  </div>
                  <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
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
        </div>
      )}
    </div>
  );
};

export default FileUpload;