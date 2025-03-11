import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, FileEdit } from 'lucide-react';

interface TextComparisonModalProps {
  originalText: string;
  correctedText: string;
  fileName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TextComparisonModal({
  originalText, 
  correctedText, 
  fileName,
  isOpen,
  onOpenChange
}: TextComparisonModalProps) {
  // テキストの差分を強調表示するユーティリティ関数
  const highlightDifferences = (original: string, corrected: string) => {
    const diffWords = (originalText: string, correctedText: string) => {
      const originalWords = originalText.split(/\s+/);
      const correctedWords = correctedText.split(/\s+/);
      
      return correctedWords.map((word, index) => {
        const originalWord = originalWords[index];
        return originalWord !== word 
          ? { word, changed: true } 
          : { word, changed: false };
      });
    };

    return diffWords(original, corrected);
  };

  const differences = highlightDifferences(originalText, correctedText);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileEdit className="h-6 w-6 text-blue-500" />
            テキスト比較: {fileName}
          </DialogTitle>
          <DialogDescription>
            元のテキストと添削後のテキストを比較します
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-4 flex-grow overflow-hidden">
          {/* 元のテキスト */}
          <div className="bg-gray-50 p-4 rounded-lg overflow-auto">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-gray-600" />
              元のテキスト
            </h3>
            <div className="whitespace-pre-wrap break-words text-sm">
              {originalText || '元のテキストがありません'}
            </div>
          </div>
          
          {/* 添削後のテキスト */}
          <div className="bg-blue-50 p-4 rounded-lg overflow-auto">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <FileEdit className="h-5 w-5 mr-2 text-blue-600" />
              添削後のテキスト
            </h3>
            <div className="whitespace-pre-wrap break-words text-sm">
              {correctedText || '添削後のテキストがありません'}
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex justify-end space-x-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            閉じる
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// コンポーネントをデフォルトエクスポート
export default TextComparisonModal;