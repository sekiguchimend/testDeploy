"use client"
import { useState, useEffect } from "react";
import { Download, FileText, File, FileDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useMemo } from "react";
import dynamic from "next/dynamic";

// docxライブラリは動的にインポート
const DocxModule = dynamic(() => import("docx"), { ssr: false });


// フォーマット間の変換を行うユーティリティ関数
const formatFileSize = (sizeInBytes: number): string => {
  if (sizeInBytes < 1024) return `${sizeInBytes} B`;
  if (sizeInBytes < 1024 * 1024) return `${(sizeInBytes / 1024).toFixed(2)} KB`;
  return `${(sizeInBytes / 1024 / 1024).toFixed(2)} MB`;
};

// 利用可能なファイル形式
interface FormatOption {
  value: string;
  label: string;
  icon: React.ReactNode;
  mimeType: string;
}

const formatOptions: FormatOption[] = [
  {
    value: "pdf",
    label: "PDF形式",
    icon: <FileText className="w-4 h-4" />,
    mimeType: "application/pdf"
  },
  {
    value: "docx",
    label: "Word形式 (.docx)",
    icon: <File className="w-4 h-4" />,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  },
  {
    value: "txt",
    label: "テキスト形式 (.txt)",
    icon: <FileDown className="w-4 h-4" />,
    mimeType: "text/plain"
  },
  {
    value: "html",
    label: "HTML形式",
    icon: <FileText className="w-4 h-4" />,
    mimeType: "text/html"
  },
  {
    value: "markdown",
    label: "Markdown形式 (.md)",
    icon: <FileDown className="w-4 h-4" />,
    mimeType: "text/markdown"
  }
];

interface DownloadDialogProps {
  reviewedFilePath?: string; // 添削済みファイルのパス
  originalWithDesignPath?: string; // デザイン適用済み元ファイルのパス
  fileName?: string; // 元のファイル名
  fileSize?: number; // ファイルサイズ
  disabled?: boolean; // ダウンロードボタンの無効化フラグ
  downloadUrl?: string; // レガシーサポート: 直接のダウンロードURL
}

export const DownloadDialog: React.FC<DownloadDialogProps> = ({
  reviewedFilePath,
  originalWithDesignPath,
  fileName = "添削済みファイル",
  fileSize,
  disabled = false,
  downloadUrl
}) => {
  const [format, setFormat] = useState<string>("txt");
  const [fileType, setFileType] = useState<"reviewed" | "original">("reviewed");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);
  const { toast } = useToast();

  // ダウンロード可能なファイルがあるかどうかを確認
  const hasReviewedFile = !!reviewedFilePath || !!downloadUrl;
  const hasOriginalFile = !!originalWithDesignPath;

  // 選択されたフォーマットに対応するURLを取得
  const getDownloadUrl = (): string => {
    // レガシーサポート: 直接のダウンロードURLがある場合はそれを優先
    if (downloadUrl && fileType === "reviewed") {
      return downloadUrl;
    }
    
    const basePath = fileType === "reviewed" ? reviewedFilePath : originalWithDesignPath;
    
    if (!basePath) return "";
    
    // API経由でダウンロード (変換パラメータは削除)
    return `/api/download?file=${encodeURIComponent(basePath)}`;
  };

  // ダウンロードファイル名の生成
  const getDownloadFileName = (): string => {
    const prefix = fileType === "reviewed" ? "添削済み" : "元文書_デザイン適用";
    const baseFileName = fileName?.replace(/\.[^/.]+$/, "") || "document"; // 拡張子を削除
    return `${prefix}_${baseFileName}.${format}`;
  };

  // テキストをHTML形式に変換
  const convertToHtml = (text: string): string => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>変換された文書</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2em; line-height: 1.6; }
    pre { white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>変換された文書</h1>
  <pre>${text}</pre>
</body>
</html>`;
  };

  // テキストをMarkdown形式に変換
  const convertToMarkdown = (text: string): string => {
    return `# 変換された文書\n\n${text}`;
  };

  // テキストをPDF形式に変換（jsPDFを使用）
  const convertToPdf = async (text: string): Promise<Blob> => {
    setIsLibraryLoading(true);
    
    try {
      // jsPDFをインポート
      const jsPDFModule = await import('jspdf');
      const { jsPDF } = jsPDFModule.default;
      
      // PDFドキュメントを作成
      const doc = new jsPDF();
      
      // タイトルを追加
      doc.setFontSize(16);
      doc.text('変換された文書', 20, 20);
      
      // テキストを追加（日本語対応のため）
      doc.setFontSize(11);
      
      // テキストを複数行に分割
      const lines = doc.splitTextToSize(text, 170);
      
      // ページの高さ
      const pageHeight = doc.internal.pageSize.height;
      let y = 30; // 開始Y位置
      
      for (let i = 0; i < lines.length; i++) {
        // 新しいページが必要か確認
        if (y > pageHeight - 20) {
          doc.addPage();
          y = 20; // 新しいページでのY位置をリセット
        }
        
        doc.text(lines[i], 20, y);
        y += 7; // 次の行のY位置
      }
      
      // PDFをBlobとして取得
      return doc.output('blob');
    } catch (error) {
      console.error("PDF変換エラー:", error);
      throw new Error("PDF変換に失敗しました");
    } finally {
      setIsLibraryLoading(false);
    }
  };

  // テキストをDOCX形式に変換（docxを使用）
  const convertToDocx = async (text: string): Promise<Blob> => {
    setIsLibraryLoading(true);
    
    try {
      // docxライブラリをimport
      const docxModule = await import('docx');
      const { Document, Paragraph, Packer } = docxModule;
      
      // テキストを段落に分割
      const paragraphs = text.split('\n').map(line => 
        new Paragraph({
          text: line || " "
        })
      );
      
      // DOCXドキュメント作成
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: "変換された文書",
              heading: 'Heading1'
            }),
            ...paragraphs
          ]
        }]
      });
      
      // DOCXをBlobとして生成
      const buffer = await Packer.toBlob(doc);
      return buffer;
    } catch (error) {
      console.error("DOCX変換エラー:", error);
      throw new Error("DOCX変換に失敗しました。必要なライブラリが読み込めませんでした。");
    } finally {
      setIsLibraryLoading(false);
    }
  };

  // テキストを指定された形式に変換
  const convertText = async (text: string, format: string): Promise<{blob: Blob, mimeType: string}> => {
    let blob: Blob;
    let mimeType: string;
    
    switch (format) {
      case "html":
        blob = new Blob([convertToHtml(text)], { type: "text/html" });
        mimeType = "text/html";
        break;
      case "markdown":
        blob = new Blob([convertToMarkdown(text)], { type: "text/markdown" });
        mimeType = "text/markdown";
        break;
      case "pdf":
        blob = await convertToPdf(text);
        mimeType = "application/pdf";
        break;
      case "docx":
        blob = await convertToDocx(text);
        mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        break;
      default:
        blob = new Blob([text], { type: "text/plain" });
        mimeType = "text/plain";
    }
    
    return { blob, mimeType };
  };

  // ファイルをダウンロードする関数
  const downloadFile = async () => {
    const downloadUrl = getDownloadUrl();
    const filename = getDownloadFileName();
    
    if (!downloadUrl) {
      toast({
        title: "エラー",
        description: "ダウンロード可能なファイルがありません。先に職務経歴書をアップロードしてください。",
        variant: "destructive",
      });
      return;
    }

    setIsDownloading(true);
    
    try {
      // サーバーからファイルコンテンツを取得
      console.log("ファイル取得:", downloadUrl);
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error(`ダウンロードエラー: ${response.statusText}`);
      }
      
      // テキストコンテンツを取得
      const textContent = await response.text();
      
      try {
        // 選択された形式に変換
        const { blob, mimeType } = await convertText(textContent, format);
        
        // ダウンロードリンクを作成
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        
        // リンクをクリックしてダウンロード開始
        document.body.appendChild(link);
        link.click();
        
        // クリーンアップ
        link.remove();
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "ダウンロード完了",
          description: `${filename}のダウンロードが完了しました。`,
        });
      } catch (conversionError) {
        console.error("変換エラー:", conversionError);
        
        // 変換に失敗した場合、プレーンテキストとしてダウンロード
        const blob = new Blob([textContent], { type: "text/plain" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename.replace(/\.[^/.]+$/, "")}.txt`;
        
        document.body.appendChild(link);
        link.click();
        
        link.remove();
        window.URL.revokeObjectURL(url);
        
        toast({
          title: "変換失敗",
          description: `${format}形式への変換に失敗しました。テキスト形式でダウンロードしました。`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("ダウンロードエラー:", error);
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "ファイルのダウンロード中にエラーが発生しました。",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
      setShowConfirm(false);
      setIsDialogOpen(false);
    }
  };

  // ダウンロード処理中の表示
  const downloadingState = useMemo(() => {
    if (isLibraryLoading) {
      return (
        <>
          <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
          ライブラリをロード中...
        </>
      );
    }
    if (isDownloading) {
      return (
        <>
          <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
          ダウンロード中...
        </>
      );
    }
    return (
      <>
        <Download className="w-4 h-4" />
        この形式でダウンロード
      </>
    );
  }, [isDownloading, isLibraryLoading]);

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button 
          className="gap-2 bg-gradient-to-r from-primary/90 to-primary hover:from-primary hover:to-primary/90 transition-all duration-300 shadow-lg hover:shadow-xl px-6 py-6 rounded-xl animate-fadeIn"
          disabled={disabled || (!hasReviewedFile && !hasOriginalFile)}
          onClick={() => {
            if (!hasReviewedFile && !hasOriginalFile) {
              toast({
                title: "エラー",
                description: "ダウンロード可能なファイルがありません。先に職務経歴書をアップロードしてください。",
                variant: "destructive",
              });
            } else {
              setIsDialogOpen(true);
            }
          }}
        >
          <Download className="w-5 h-5" />
          処理済みファイルをダウンロード
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>職務経歴書のダウンロード</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* ファイルタイプ選択 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">ダウンロードするファイル</label>
            <div className="flex gap-2">
              <Button
                variant={fileType === "reviewed" ? "default" : "outline"}
                onClick={() => setFileType("reviewed")}
                disabled={!hasReviewedFile}
                className="flex-1"
              >
                添削済みファイル
              </Button>
              <Button
                variant={fileType === "original" ? "default" : "outline"}
                onClick={() => setFileType("original")}
                disabled={!hasOriginalFile}
                className="flex-1"
              >
                元ファイル（デザイン適用）
              </Button>
            </div>
          </div>

          {/* 出力形式選択 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">出力形式を選択</label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {formatOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      {option.icon}
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(format === "pdf" || format === "docx") && (
              <p className="text-xs text-amber-600">
                注: この形式はブラウザ内で生成されます。複雑なレイアウトは正確に再現されない場合があります。
              </p>
            )}
          </div>

          {/* プレビュー */}
          <div className="space-y-2">
            <label className="text-sm font-medium">プレビュー</label>
            <div className="border rounded-lg p-4 bg-gray-50 min-h-[150px] relative">
              <div className="flex flex-col items-center justify-center h-full">
                <FileText className="w-12 h-12 text-primary mb-2" />
                <p className="text-sm text-gray-600">
                  {fileType === "reviewed" ? "添削済み" : "元文書（デザイン適用）"}：{getDownloadFileName()}
                </p>
                {fileSize && (
                  <p className="text-xs text-gray-400 mt-1">
                    推定サイズ: {formatFileSize(fileSize)}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-3">
                  ※ファイル形式の変換はクライアント側で行われます
                </p>
              </div>
            </div>
          </div>

          {/* ダウンロードボタン */}
          <Button 
            className="w-full gap-2" 
            onClick={() => setShowConfirm(true)}
            disabled={
              isDownloading || isLibraryLoading ||
              (fileType === "reviewed" && !hasReviewedFile) || 
              (fileType === "original" && !hasOriginalFile)
            }
          >
            {downloadingState}
          </Button>
        </div>
      </DialogContent>

      {/* 確認ダイアログ */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ダウンロードの確認</AlertDialogTitle>
            <AlertDialogDescription>
              {fileType === "reviewed" ? "添削済み" : "元の"}職務経歴書を{format.toUpperCase()}形式でダウンロードします。
              よろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={downloadFile}>
              ダウンロード
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};