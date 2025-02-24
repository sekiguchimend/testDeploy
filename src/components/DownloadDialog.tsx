"use client"
import { useState } from "react";
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
import { getLastUploadedFile } from "@/components/FileUpload";

export const DownloadDialog = () => {
  const [format, setFormat] = useState<string>("pdf");
  const [showConfirm, setShowConfirm] = useState(false);
  const { toast } = useToast();

  const handleDownload = () => {
    const file = getLastUploadedFile();
    if (!file) {
      toast({
        title: "エラー",
        description: "ダウンロード可能なファイルがありません。先に職務経歴書をアップロードしてください。",
        variant: "destructive",
      });
      return;
    }

    console.log(`ダウンロードを開始: ${format}形式`, file.name);
    toast({
      title: "ダウンロードを開始しました",
      description: `添削済み履歴書を${format.toUpperCase()}形式でダウンロードしています。`,
    });
    setShowConfirm(false);

    // ここで実際のダウンロード処理を実装
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = `添削済み_${file.name.split('.')[0]}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-gradient-to-r from-primary/90 to-primary hover:from-primary hover:to-primary/90 transition-all duration-300 shadow-lg hover:shadow-xl px-6 py-6 rounded-xl animate-fadeIn">
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
                <SelectItem value="pdf">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    PDF形式
                  </div>
                </SelectItem>
                <SelectItem value="docx">
                  <div className="flex items-center gap-2">
                    <File className="w-4 h-4" />
                    Word形式 (.docx)
                  </div>
                </SelectItem>
                <SelectItem value="txt">
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
              {getLastUploadedFile() ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <FileText className="w-12 h-12 text-primary mb-2" />
                  <p className="text-sm text-gray-600">{getLastUploadedFile()?.name}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    サイズ: {(getLastUploadedFile()?.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  アップロードされたファイルがありません
                </div>
              )}
            </div>
          </div>

          <Button 
            className="w-full gap-2" 
            onClick={() => setShowConfirm(true)}
            disabled={!getLastUploadedFile()}
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