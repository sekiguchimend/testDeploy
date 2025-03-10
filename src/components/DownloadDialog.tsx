"use client"
import { useState, useRef } from "react";
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
import { convertCorrectedDocumentToFile, downloadBlob } from './documentConverter';

// サイズのフォーマット用ユーティリティ
const formatFileSize = (sizeInBytes: number): string => {
  if (sizeInBytes < 1024) return `${sizeInBytes} B`;
  if (sizeInBytes < 1024 * 1024) return `${(sizeInBytes / 1024).toFixed(2)} KB`;
  return `${(sizeInBytes / 1024 / 1024).toFixed(2)} MB`;
};

// 利用可能なファイル形式
interface FormatOption {
  value: 'pdf' | 'docx' | 'txt' | 'html' | 'markdown';
  label: string;
  icon: React.ReactNode;
}

const formatOptions: FormatOption[] = [
  {
    value: "pdf",
    label: "PDF形式",
    icon: <FileText className="w-4 h-4" />
  },
  {
    value: "docx",
    label: "Word形式 (.docx)",
    icon: <File className="w-4 h-4" />
  },
  {
    value: "txt",
    label: "テキスト形式 (.txt)",
    icon: <FileDown className="w-4 h-4" />
  },
  {
    value: "html",
    label: "HTML形式",
    icon: <FileText className="w-4 h-4" />
  },
  {
    value: "markdown",
    label: "Markdown形式 (.md)",
    icon: <FileDown className="w-4 h-4" />
  }
];

interface DesignInfo {
  fonts: string[];
  layout: {
    pageCount: number;
    margins: {
      top: string;
      right: string;
      bottom: string;
      left: string;
    };
  };
  styles: {
    [key: string]: {
      fontSize: string;
      fontFamily?: string;
      fontWeight?: string;
      color?: string;
      lineHeight?: string;
      textAlign?: string;
    };
  };
  cssRules: Array<{
    selector: string;
    properties: { [key: string]: string };
  }>;
}

interface DownloadDialogProps {
  designInfo?: DesignInfo;          // デザイン情報
  fileName?: string;                // ファイル名
  fileSize?: number;                // ファイルサイズ
  disabled?: boolean;               // 無効化フラグ
}

export const DownloadDialog: React.FC<DownloadDialogProps> = ({
  designInfo,
  fileName = "添削済みファイル",
  fileSize,
  disabled = false
}) => {
  const [format, setFormat] = useState<'pdf' | 'docx' | 'txt' | 'html' | 'markdown'>("txt");
  const [fileType, setFileType] = useState<"corrected" | "original">("corrected");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // 元のコンテンツと添削後のコンテンツ要素への参照
  const originalContentRef = useRef<HTMLElement | null>(null);
  const correctedContentRef = useRef<HTMLElement | null>(null);

  // 初期設定（DOM要素への参照を設定）
  const setupContentRefs = () => {
    // 添削後のコンテンツ要素を取得
    correctedContentRef.current = document.querySelector('.corrected-document .content');
    // 元のコンテンツ要素を取得
    originalContentRef.current = document.querySelector('.original-document .content');
  };

  // ダウンロード可能なファイルがあるかどうかを確認
  const hasContent = () => {
    setupContentRefs();
    return !!correctedContentRef.current || !!originalContentRef.current;
  };

  // ダウンロードファイル名の生成
  const getDownloadFileName = (): string => {
    const prefix = fileType === "corrected" ? "添削済み" : "元文書";
    const baseFileName = fileName?.replace(/\.[^/.]+$/, "") || "document";
    return `${prefix}_${baseFileName}`;
  };

  // ファイルをダウンロードする関数
  const downloadFile = async () => {
    setupContentRefs();

    // 選択されたタイプの要素
    const contentElement = fileType === "corrected" 
      ? correctedContentRef.current 
      : originalContentRef.current;
    
    if (!contentElement) {
      console.log("ダウンロード可能なコンテンツがありません。");
      return;
    }

    setIsDownloading(true);
    
    try {
      // ファイル名を生成
      const downloadFileName = getDownloadFileName();

      // documentConverter.ts のメソッドを使用して変換
      const blob = await convertCorrectedDocumentToFile(
        contentElement,
        {
          format,
          fileName: downloadFileName,
          designInfo
        }
      );

      // ダウンロード
      downloadBlob(blob, `${downloadFileName}.${format}`);

      console.log(`${downloadFileName}.${format}のダウンロードが完了しました。`);
    } catch (error) {
      console.error("ダウンロードエラー:", error);
      
      // エラーメッセージをユーザーに表示
      alert(`ダウンロード中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDownloading(false);
      setShowConfirm(false);
      setIsDialogOpen(false);
    }
  };

  // ダウンロード処理中の表示
  const renderLoadingState = () => {
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
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button 
          className="gap-2 bg-gradient-to-r from-primary/90 to-primary hover:from-primary hover:to-primary/90 transition-all duration-300 shadow-lg hover:shadow-xl px-6 py-6 rounded-xl animate-fadeIn"
          disabled={disabled}
          onClick={() => {
            if (!hasContent()) {
              console.log("ダウンロード可能なコンテンツがありません。");
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
                variant={fileType === "corrected" ? "default" : "outline"}
                onClick={() => setFileType("corrected")}
                className="flex-1"
              >
                添削済みファイル
              </Button>
              <Button
                variant={fileType === "original" ? "default" : "outline"}
                onClick={() => setFileType("original")}
                className="flex-1"
              >
                元ファイル
              </Button>
            </div>
          </div>

          {/* 出力形式選択 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">出力形式を選択</label>
            <Select value={format} onValueChange={(value) => setFormat(value as any)}>
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
                  {fileType === "corrected" ? "添削済み" : "元文書"}: {getDownloadFileName()}.{format}
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
            disabled={isDownloading}
          >
            {renderLoadingState()}
          </Button>
        </div>
      </DialogContent>

      {/* 確認ダイアログ */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ダウンロードの確認</AlertDialogTitle>
            <AlertDialogDescription>
              {fileType === "corrected" ? "添削済み" : "元の"}職務経歴書を{format.toUpperCase()}形式でダウンロードします。
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