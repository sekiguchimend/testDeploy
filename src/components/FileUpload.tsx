"use client";

import { useState, useCallback } from "react";
import { FileText, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
let lastUploadedFile: File | null = null;

export const getLastUploadedFile = () => lastUploadedFile;
interface FileUploadProps {
  onFileProcessed: (originalText: string, correctedText: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileProcessed }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
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

  const handleFile = async (file: File) => {
    if (
      file.type === "application/pdf" ||
      file.type === "application/msword" ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append("file", file);

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

        onFileProcessed(data.originalText, data.correctedText);

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

  return (
    <div
      className="w-full max-w-2xl mx-auto mt-8 animate-fadeIn"
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <div
        className={`relative p-12 rounded-lg border-2 border-dashed transition-all duration-200 ease-in-out
          ${isDragging ? "border-primary bg-primary/5" : "border-gray-200 hover:border-primary/50"}
          ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="p-4 rounded-full bg-primary/5">
            {isProcessing ? (
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            ) : isDragging ? (
              <FileText className="w-8 h-8 text-primary animate-bounce" />
            ) : (
              <Upload className="w-8 h-8 text-primary" />
            )}
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">
              {isProcessing ? "処理中..." : isDragging ? "ここにファイルをドロップ" : "履歴書をアップロード"}
            </h3>
            <p className="text-sm text-gray-500">
              {isProcessing
                ? "ファイルを処理しています。しばらくお待ちください..."
                : "ファイルをドラッグ＆ドロップするか、クリックして選択してください"}
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
      </div>
    </div>
  );
};

export default FileUpload;