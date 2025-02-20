import { useState } from "react";
import { ArrowLeft, ArrowRight, Download, FileText, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "./ui/dialog";
import { useToast } from "@/hooks/use-toast";

export const ComparisonView = () => {
  const [showDiff, setShowDiff] = useState(true);
  const [reReviewComment, setReReviewComment] = useState("");
  const [showReReviewDialog, setShowReReviewDialog] = useState(false);
  const { toast } = useToast();

  const handleReReviewSubmit = () => {
    console.log("Re-review requested with comment:", reReviewComment);
    toast({
      title: "再添削リクエストを送信しました",
      description: "添削者からの返信をお待ちください。",
    });
    setShowReReviewDialog(false);
    setReReviewComment("");
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 animate-fadeIn">
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

      <div className="grid grid-cols-2 gap-8">
        <div className="resume-card">
          <div className="mb-6 flex items-center gap-2">
            <span className="px-3 py-1 text-sm rounded-full bg-gray-100 font-medium">オリジナル</span>
          </div>
          <div className="prose max-w-none space-y-6">
            <div className="text-center mb-12">
              <h1 className="text-3xl font-bold mb-8 tracking-tight">職務経歴書</h1>
              <p className="text-right text-sm mb-2">20XX年XX月XX日現在</p>
              <p className="text-right text-lg">白州 太郎</p>
            </div>
            
            <section className="resume-section">
              <h2 className="resume-heading">基本情報</h2>
              <table className="resume-table">
                <tbody>
                  <tr className="border-b">
                    <th>氏名</th>
                    <td>白州 太郎</td>
                  </tr>
                  <tr className="border-b">
                    <th>生年月日</th>
                    <td>19XX年XX月XX日（XX歳）</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section className="resume-section">
              <h2 className="resume-heading">職務要約</h2>
              <p className="text-gray-800 leading-relaxed">
                新卒で入社して以来5年間にわたり、営業事務としてアシスタント業務に従事しています。
                客先説明用の資料作成や受発注業務のほか、売上データの集計・報告用資料の作成も担当、
                営業の業務効率化や、業務品質の向上に貢献しています。
              </p>
            </section>

            <section className="resume-section">
              <h2 className="resume-heading">職務経歴</h2>
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-lg mb-3">株式会社ABC商事（20XX年4月 - 現在）</h3>
                  <p className="text-sm text-gray-600 mb-4">営業事務</p>
                  <ul className="list-disc pl-5 space-y-3">
                    <li>営業部のアシスタント業務</li>
                    <li>受発注管理、在庫管理</li>
                    <li>売上データの集計・分析</li>
                    <li>営業資料の作成</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="resume-section">
              <h2 className="resume-heading">保有資格</h2>
              <ul className="list-disc pl-5 space-y-3">
                <li>日商簿記2級（20XX年取得）</li>
                <li>MOS Excel Expert（20XX年取得）</li>
              </ul>
            </section>
          </div>
        </div>

        <div className="resume-card">
          <div className="mb-6 flex items-center gap-2">
            <span className="px-3 py-1 text-sm rounded-full bg-primary/10 text-primary font-medium">添削済み</span>
          </div>
          <div className="prose max-w-none space-y-6">
            <div className="text-center mb-12">
              <h1 className="text-3xl font-bold mb-8 tracking-tight">職務経歴書</h1>
              <p className="text-right text-sm mb-2">20XX年XX月XX日現在</p>
              <p className="text-right text-lg">白州 太郎</p>
            </div>
            
            <section className="resume-section">
              <h2 className="resume-heading">基本情報</h2>
              <table className="resume-table">
                <tbody>
                  <tr className="border-b">
                    <th>氏名</th>
                    <td>白州 太郎</td>
                  </tr>
                  <tr className="border-b">
                    <th>生年月日</th>
                    <td>19XX年XX月XX日（XX歳）</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section className="resume-section">
              <h2 className="resume-heading">職務要約</h2>
              <p className="text-gray-800 leading-relaxed">
                新卒で入社して以来5年間にわたり、
                <span className="highlight">営業部のアシスタントリーダーとして</span>
                業務に従事しています。
                客先説明用の資料作成や受発注業務のほか、
                <span className="highlight">売上データの分析・可視化</span>
                を担当し、
                <span className="highlight">部門全体の業務効率を20%向上</span>
                させることに成功しました。
              </p>
            </section>

            <section className="resume-section">
              <h2 className="resume-heading">職務経歴</h2>
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-lg mb-3">株式会社ABC商事（20XX年4月 - 現在）</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    <span className="highlight">営業事務リーダー</span>
                  </p>
                  <ul className="list-disc pl-5 space-y-3">
                    <li>
                      <span className="highlight">営業部のアシスタントリーダーとして10名のチームを統括</span>
                    </li>
                    <li>
                      <span className="highlight">受発注管理システムの刷新プロジェクトをリード、処理時間を50%削減</span>
                    </li>
                    <li>
                      <span className="highlight">Tableauを活用した売上データの可視化・分析基盤の構築</span>
                    </li>
                    <li>
                      <span className="highlight">営業資料のテンプレート化により、資料作成時間を30%削減</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="resume-section">
              <h2 className="resume-heading">保有資格</h2>
              <ul className="list-disc pl-5 space-y-3">
                <li>日商簿記2級（20XX年取得）</li>
                <li>MOS Excel Expert（20XX年取得）</li>
                <li>
                  <span className="highlight">Tableau Desktop Specialist（20XX年取得）</span>
                </li>
              </ul>
            </section>
          </div>
        </div>
      </div>

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