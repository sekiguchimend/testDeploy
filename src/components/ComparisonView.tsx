"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeftRight, Download, FileText, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import * as diff from 'diff';

interface ComparisonViewProps {
  originalText: string;
  correctedText: string;
  onDownload?: () => void;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  originalText,
  correctedText,
  onDownload
}) => {
  const [reReviewComment, setReReviewComment] = useState("");
  const [showReReviewDialog, setShowReReviewDialog] = useState(false);
  const [markedOriginalText, setMarkedOriginalText] = useState("");
  const [markedCorrectedText, setMarkedCorrectedText] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    // 差分を計算して視覚的なマーカーを追加
    highlightDifferences();
  }, [originalText, correctedText]);

  const highlightDifferences = () => {
    // テキストデータからHTMLタグを除去してプレーンテキストとして比較
    const cleanOriginal = originalText.replace(/<[^>]*>/g, '');
    const cleanCorrected = correctedText.replace(/<[^>]*>/g, '');

    // 段落ごとに分割
    const originalParagraphs = cleanOriginal.split('\n\n');
    const correctedParagraphs = cleanCorrected.split('\n\n');

    let markedOriginal = '';
    let markedCorrected = '';

    // 最大の長さを取得
    const maxLength = Math.max(originalParagraphs.length, correctedParagraphs.length);

    for (let i = 0; i < maxLength; i++) {
      const origPara = originalParagraphs[i] || '';
      const corrPara = correctedParagraphs[i] || '';

      if (origPara === corrPara) {
        // 変更がない場合は通常のテキストとして追加
        markedOriginal += `<p>${origPara}</p>`;
        markedCorrected += `<p>${corrPara}</p>`;
      } else {
        // 差分を計算
        const differences = diff.diffWords(origPara, corrPara);

        // 原文に削除マーカーを追加
        let paraWithDeleteMarkers = '';
        differences.forEach(part => {
          if (part.removed) {
            paraWithDeleteMarkers += `<mark class="bg-red-100">${part.value}</mark>`;
          } else if (!part.added) {
            paraWithDeleteMarkers += part.value;
          }
        });
        
        // 添削文に追加マーカーを追加
        let paraWithAddMarkers = '';
        differences.forEach(part => {
          if (part.added) {
            paraWithAddMarkers += `<mark class="bg-green-100">${part.value}</mark>`;
          } else if (!part.removed) {
            paraWithAddMarkers += part.value;
          }
        });

        markedOriginal += `<p>${paraWithDeleteMarkers}</p>`;
        markedCorrected += `<p>${paraWithAddMarkers}</p>`;
      }
    }

    setMarkedOriginalText(markedOriginal);
    setMarkedCorrectedText(markedCorrected);
  };

  const handleReReviewSubmit = () => {
    toast({
      title: "再添削リクエストを送信しました",
      description: "添削者からの返信をお待ちください。",
    });
    setShowReReviewDialog(false);
    setReReviewComment("");
  };

  // PDFかどうかを判定する関数
  const isPDF = (text: string) => {
    // PDFの内容を示す特徴的な文字列パターンで判定
    const pdfPatterns = [
      "%PDF-", // PDFヘッダー
      "Adobe PDF",
      "application/pdf"
    ];
    
    return pdfPatterns.some(pattern => text.includes(pattern));
  };

  return (
    <div className="w-full mx-auto p-6 animate-fadeIn bg-white rounded-lg shadow-sm">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">職務経歴書の添削結果</h2>
        </div>
        <div className="flex items-center space-x-3">
          {onDownload && (
            <Button 
              onClick={onDownload}
              variant="default"
              className="flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>添削済みファイルをダウンロード</span>
            </Button>
          )}
          
          {/* 再添削ダイアログ */}
          <Dialog open={showReReviewDialog} onOpenChange={setShowReReviewDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center space-x-2">
                <RotateCcw className="w-4 h-4" />
                <span>再添削を依頼</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold tracking-tight">再添削の依頼</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-gray-600 leading-relaxed">
                  追加で修正してほしい箇所や気になる点についてコメントを記入してください。
                </p>
                <Textarea
                  value={reReviewComment}
                  onChange={(e) => setReReviewComment(e.target.value)}
                  placeholder="例: スキルセクションをより具体的にしてほしい"
                  className="min-h-[150px] resize-none"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowReReviewDialog(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleReReviewSubmit} disabled={!reReviewComment.trim()}>
                  送信する
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 比較ビュー */}
      <div className="grid grid-cols-2 gap-8">
        {/* オリジナル */}
        <div className="resume-card">
          <div className="mb-6 flex items-center gap-2">
            <span className="px-3 py-1 text-sm rounded-full bg-gray-100 font-medium">オリジナル</span>
          </div>
          <div className="prose max-w-none space-y-6">
            {isPDF(originalText) ? (
              <span>PDFファイルが含まれています。</span>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: markedOriginalText || originalText }} />
            )}
          </div>
        </div>

        {/* 添削済み */}
        <div className="resume-card">
          <div className="mb-6 flex items-center gap-2">
            <span className="px-3 py-1 text-sm rounded-full bg-primary/10 text-primary font-medium">添削済み</span>
          </div>
          <div className="prose max-w-none space-y-6">
            {isPDF(correctedText) ? (
              <span>PDFファイルが含まれています。</span>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: markedCorrectedText || correctedText }} />
            )}
          </div>
        </div>
      </div>

      {/* 色の説明 */}
      <div className="mt-8 flex justify-center gap-4">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 bg-green-100 rounded"></span>
          <span className="text-sm text-gray-600">追加・修正された内容</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 bg-red-100 rounded"></span>
          <span className="text-sm text-gray-600">削除された内容</span>
        </div>
      </div>
    </div>
  );
};

export default ComparisonView;