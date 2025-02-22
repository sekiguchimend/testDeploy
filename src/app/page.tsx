import { FileUpload } from "@/components/FileUpload";
import { ComparisonView } from "@/components/ComparisonView";
import { DownloadDialog } from "@/components/DownloadDialog";

const Index = () => {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <header className="w-full py-6 px-8 border-b bg-white/80 backdrop-blur-sm fixed top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-semibold">履歴書レビュープラットフォーム</h1>
        </div>
      </header>

      <main className="pt-24 pb-16 px-8">
        <div className="max-w-7xl mx-auto space-y-12">
          <section className="text-center space-y-4 animate-fadeIn">
            <span className="px-4 py-1 rounded-full bg-primary/10 text-primary text-sm">
              プロフェッショナルな履歴書添削
            </span>
            <h2 className="text-4xl font-semibold tracking-tight">
              あなたの履歴書を魅力的に
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              履歴書をアップロードして、プロフェッショナルなフィードバックを受け取りましょう。
              リアルタイムで変更を確認し、改善された履歴書をダウンロードできます。
            </p>
          </section>

          <FileUpload />
          <ComparisonView />
          
          <div className="flex justify-center mt-8">
            <DownloadDialog />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;