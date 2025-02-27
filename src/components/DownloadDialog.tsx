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

// フォーマット間の変換を行うユーティリティ関数
const formatFileSize = (sizeInBytes: number): string => {
  if (sizeInBytes < 1024) return `${sizeInBytes} B`;
  if (sizeInBytes < 1024 * 1024) return `${(sizeInBytes / 1024).toFixed(2)} KB`;
  return `${(sizeInBytes / 1024 / 1024).toFixed(2)} MB`;
};

interface DownloadDialogProps {
  downloadUrl?: string;
  downloadFileName?: string;
  pdfDownloadUrl?: string;
  fileData?: {
    name: string;
    size: number;
    type: string;
  };
}

export const DownloadDialog: React.FC<DownloadDialogProps> = ({
  downloadUrl,
  downloadFileName,
  pdfDownloadUrl,
  fileData
}) => {
  const [format, setFormat] = useState<string>("pdf");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  // ダウンロード可能なファイルがあるかどうかを確認
  const hasDownloadableFile = !!(downloadUrl || pdfDownloadUrl);

  // 選択されたフォーマットに対応するURLを取得
  const getDownloadUrlForFormat = (): string => {
    if (format === "pdf" && pdfDownloadUrl) {
      return pdfDownloadUrl;
    }
    // デフォルトはテキスト/Word形式
    return downloadUrl || "";
  };

  const handleDownload = () => {
    const downloadUrlForFormat = getDownloadUrlForFormat();
    
    if (!downloadUrlForFormat) {
      toast({
        title: "エラー",
        description: "ダウンロード可能なファイルがありません。先に職務経歴書をアップロードしてください。",
        variant: "destructive",
      });
      return;
    }

    console.log(`ダウンロードを開始: ${format}形式`);
    toast({
      title: "ダウンロードを開始しました",
      description: `添削済み履歴書を${format.toUpperCase()}形式でダウンロードしています。`,
    });
    setShowConfirm(false);
    setIsDialogOpen(false);

    // 実際のファイルダウンロード処理
    window.location.href = downloadUrlForFormat;
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button 
          className="gap-2 bg-gradient-to-r from-primary/90 to-primary hover:from-primary hover:to-primary/90 transition-all duration-300 shadow-lg hover:shadow-xl px-6 py-6 rounded-xl animate-fadeIn"
          disabled={!hasDownloadableFile}
          onClick={() => {
            if (!hasDownloadableFile) {
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
          添削済み履歴書をダウンロード
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>添削済み履歴書のダウンロード</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">出力形式を選択</label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf" disabled={!pdfDownloadUrl}>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    PDF形式
                  </div>
                </SelectItem>
                <SelectItem value="docx" disabled={!downloadUrl}>
                  <div className="flex items-center gap-2">
                    <File className="w-4 h-4" />
                    Word形式 (.docx)
                  </div>
                </SelectItem>
                <SelectItem value="txt" disabled={!downloadUrl}>
                  <div className="flex items-center gap-2">
                    <FileDown className="w-4 h-4" />
                    テキスト形式 (.txt)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">プレビュー</label>
            <div className="border rounded-lg p-4 bg-gray-50 min-h-[200px] relative">
              {fileData ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <FileText className="w-12 h-12 text-primary mb-2" />
                  <p className="text-sm text-gray-600">{fileData.name || downloadFileName || "添削済みファイル"}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    サイズ: {fileData.size ? formatFileSize(fileData.size) : "不明"}
                  </p>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  ファイル情報を読み込めませんでした
                </div>
              )}
            </div>
          </div>

          <Button 
            className="w-full gap-2" 
            onClick={() => setShowConfirm(true)}
            disabled={!getDownloadUrlForFormat()}
          >
            <Download className="w-4 h-4" />
            この形式でダウンロード
          </Button>
        </div>
      </DialogContent>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ダウンロードの確認</AlertDialogTitle>
            <AlertDialogDescription>
              添削済み履歴書を{format.toUpperCase()}形式でダウンロードします。
              よろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDownload}>
              ダウンロード
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};