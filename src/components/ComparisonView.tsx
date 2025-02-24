"use client";

import React, { useState } from "react";
import { ArrowLeft, ArrowRight, FileText, RotateCcw } from "lucide-react";
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

interface ComparisonViewProps {
  originalText: string;
  correctedText: string;
}

// PDF の判定
const isPDF = (text: string) => text.includes("%PDF");

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  originalText,
  correctedText,
}) => {
  const [showDiff, setShowDiff] = useState(true);
  const [reReviewComment, setReReviewComment] = useState("");
  const [showReReviewDialog, setShowReReviewDialog] = useState(false);
  const { toast } = useToast();

  const handleReReviewSubmit = () => {
    toast({
      title: "再添削リクエストを送信しました",
      description: "添削者からの返信をお待ちください。",
    });
    setShowReReviewDialog(false);
    setReReviewComment("");
  };

  return (
    <div className="w-full max-w-screen-xl mx-auto p-6 animate-fadeIn">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold tracking-tight">職務経歴書の比較</h2>
        </div>
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={() => setShowDiff(!showDiff)}
            className="flex items-center space-x-2 hover:bg-gray-50"
          >
            {showDiff ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            <span>{showDiff ? "変更を非表示" : "変更を表示"}</span>
          </Button>
          {/* 再添削ダイアログ */}
          <Dialog open={showReReviewDialog} onOpenChange={setShowReReviewDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center space-x-2 hover:bg-gray-50">
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
              <div dangerouslySetInnerHTML={{ __html: originalText }} />
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
              <div dangerouslySetInnerHTML={{ __html: correctedText }} />
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