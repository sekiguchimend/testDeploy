import { useState, useCallback } from "react";
import { FileText, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// 最後にアップロードされたファイルを保持するためのグローバル変数
let lastUploadedFile: File | null = null;

export const getLastUploadedFile = () => lastUploadedFile;

export const FileUpload = () => {
  const [isDragging, setIsDragging] = useState(false);
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

  const handleFile = (file: File) => {
    if (file.type === "application/pdf" || file.type === "application/msword" || 
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      console.log("ファイルを受け付けました:", file.name);
      lastUploadedFile = file; // アップロードされたファイルを保存
      toast({
        title: "ファイルのアップロードが完了しました",
        description: `${file.name}がアップロードされ、処理中です。`,
      });
    } else {
      toast({
        title: "無効なファイル形式です",
        description: "PDFまたはWordドキュメントをアップロードしてください。",
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
  }, [toast]);

  return (
    <div
      className="w-full max-w-2xl mx-auto mt-8 animate-fadeIn"
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <div
        className={`
          relative p-12 rounded-lg border-2 border-dashed transition-all duration-200 ease-in-out
          ${isDragging 
            ? "border-primary bg-primary/5" 
            : "border-gray-200 hover:border-primary/50"}
        `}
      >
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
            accept=".pdf,.doc,.docx"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleFile(file);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};