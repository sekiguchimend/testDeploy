"use client"
import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import Link from "next/link";
import {ArrowLeft, Check, X, Edit2, FileText, Download, RefreshCw, Calendar, AlertTriangle, Link as lin} from "lucide-react";
import { getAllResumeFiles, getMonthlyStats, getStatusStats } from "@/lib/resumeService";
import { getAllKeywords, addKeyword, updateKeyword, deleteKeyword } from "@/lib/keywordService";
import type { ResumeFile, MonthlyStats } from "@/lib/resumeService";
import type { Keyword } from "@/lib/keywordService";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import TextComparisonModal from "@/components/TextComparisonModal";

// 円グラフのカラー
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function AdminDashboard() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [newAction, setNewAction] = useState<string>("要確認");
  const [editingKeyword, setEditingKeyword] = useState<{
    id: number | null;
    keyword: string;
    action: string;
  }>({ id: null, keyword: "", action: "" });
  
  // レジュメファイル管理
  const [resumes, setResumes] = useState<ResumeFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [keywordsLoading, setKeywordsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // テキスト比較モーダル関連
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false);
  const [selectedResume, setSelectedResume] = useState<ResumeFile | null>(null);
  
  // 統計データ
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [statusStats, setStatusStats] = useState<{[key: string]: number}>({});
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [statsLoading, setStatsLoading] = useState(true);
  const [totalUploads, setTotalUploads] = useState(0);

  // テキスト比較モーダルを開く関数
  const openTextComparisonModal = (resume: ResumeFile) => {
    setSelectedResume(resume);
    setComparisonModalOpen(true);
  };
  // キーワード一覧をSupabaseから取得
  const fetchKeywords = async () => {
    if (keywordsLoading && !keywords.length) {
      console.log('キーワード一覧取得を開始...');
    } else {
      setKeywordsLoading(true);
    }
    
    try {
      console.log('キーワード一覧を取得中...');
      const result = await getAllKeywords();
      
      console.log('キーワード一覧取得結果:', {
        成功: result.success,
        データ数: result.data?.length || 0,
        エラー: result.error_message || 'なし'
      });
      
      if (result.data && Array.isArray(result.data)) {
        setKeywords(result.data);
      } else {
        console.warn('レスポンスには有効なキーワード配列がありません:', result);
        setKeywords([]);
      }
      
      if (!result.success) {
        console.warn('キーワード一覧取得に問題がありました:', result.error_message);
        toast.warning("キーワードデータが正しく取得できていない可能性があります");
      }
    } catch (err: any) {
      const errorMessage = err.message || 'キーワード一覧の取得に失敗しました';
      console.error('キーワードデータ取得エラー:', errorMessage);
      toast.error(errorMessage);
    } finally {
      setKeywordsLoading(false);
    }
  };

  // 添削済みファイルをSupabaseから取得
  const fetchResumeFiles = async () => {
    if (loading && !resumes.length) {
      // 最初のロード時はステータスを表示
      console.log('ファイル一覧取得を開始...');
    } else {
      setLoading(true);
    }
    
    setError(null);
    
    try {
      console.log('添削済みファイル一覧を取得中...');
      const result = await getAllResumeFiles();
      
      console.log('ファイル一覧取得結果:', {
        成功: result.success,
        データ数: result.data?.length || 0,
        エラー: result.error_message || 'なし'
      });
      
      if (result.data && Array.isArray(result.data)) {
        setResumes(result.data);
        setTotalUploads(result.data.length); // 総アップロード数を更新
      } else {
        console.warn('レスポンスには有効なデータ配列がありません:', result);
        setResumes([]);
      }
      
      if (!result.success) {
        console.warn('ファイル一覧取得に問題がありました:', result.error);
        toast.warning("一部のデータが正しく取得できていない可能性があります");
      }
    } catch (err: any) {
      const errorMessage = err.message || 'ファイル一覧の取得に失敗しました';
      setError(errorMessage);
      console.error('データ取得エラー:', errorMessage);
      setResumes([]);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 統計データを取得
  const fetchStats = async (year: number = selectedYear) => {
    if (statsLoading && !monthlyStats.length) {
      // 最初のロード時はステータスを表示
      console.log('統計データ取得を開始...');
    } else {
      setStatsLoading(true);
    }
    
    try {
      // 月間統計を取得
      console.log(`${year}年の月間統計データを取得中...`);
      const monthlyResult = await getMonthlyStats(year);
      
      console.log('月間統計取得結果:', {
        成功: monthlyResult.success,
        データ数: monthlyResult.data?.length || 0,
       
      });
      
      if (monthlyResult.data && Array.isArray(monthlyResult.data)) {
        setMonthlyStats(monthlyResult.data);
        
        // 月間データの合計を計算
        const yearlyTotal = monthlyResult.data.reduce((sum, item) => sum + item.uploads, 0);
        console.log(`${year}年の月間アップロード合計:`, yearlyTotal);
      } else {
        console.warn('月間統計のレスポンスに有効なデータがありません:', monthlyResult);
        setMonthlyStats([]);
      }
      
      // ステータス別統計を取得
      console.log('ステータス別統計データを取得中...');
      const statusResult = await getStatusStats();
      
      console.log('ステータス統計取得結果:', {
        成功: statusResult.success,
        データ: statusResult.data,
        エラー: statusResult.error_message || 'なし'
      });
      
      if (statusResult.data && typeof statusResult.data === 'object') {
        setStatusStats(statusResult.data);
        
        // ステータス別の合計も計算（総アップロード数のクロスチェック用）
        const statusTotal = Object.values(statusResult.data).reduce((sum, count) => sum + count, 0);
        console.log('ステータス別の合計:', statusTotal);
        
        // ファイル一覧と統計の不一致をチェック
        if (resumes.length !== statusTotal && resumes.length > 0 && statusTotal > 0) {
          console.warn('警告: ファイル一覧の数とステータス統計の合計が一致しません', {
            ファイル一覧: resumes.length,
            ステータス合計: statusTotal
          });
        }
      } else {
        console.warn('ステータス統計のレスポンスに有効なデータがありません:', statusResult);
        setStatusStats({});
      }
      
      // エラーがあっても表示だけで処理続行
      if (!monthlyResult.success || !statusResult.success) {
        toast.warning("一部の統計データが正しく取得できていない可能性があります");
      }
    } catch (error: any) {
      console.error('統計データの取得に失敗しました', error);
      setMonthlyStats([]);
      setStatusStats({});
      toast.error(error.message || "統計データの取得に失敗しました");
    } finally {
      setStatsLoading(false);
    }
  };
  
  // リフレッシュ関数 - すべてのデータを再取得
  const refreshAllData = async () => {
    console.log('全データを更新中...');
    try {
      await fetchResumeFiles();
      await fetchStats(selectedYear);
      await fetchKeywords();
      toast.success("データを更新しました");
    } catch (error) {
      console.error('データ更新中にエラーが発生:', error);
      toast.error("データの更新中にエラーが発生しました");
    }
  };

  // コンポーネントマウント時に初期データ取得
  useEffect(() => {
    console.log('管理ダッシュボード初期化中...');
    refreshAllData();
  }, []);

  // 年が変更されたら統計を更新
  useEffect(() => {
    if (!statsLoading) {
      console.log(`選択年が${selectedYear}年に変更されました。統計を更新します...`);
      fetchStats(selectedYear);
    }
  }, [selectedYear]);

  // ファイルダウンロード処理
  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      console.log(`ファイルをダウンロード中: ${fileName} (${filePath})`);
      
      // APIルートを直接呼び出す
      const downloadUrl = `/api/download?file=${encodeURIComponent(filePath)}`;
      
      // ダウンロードリンクを作成
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName || 'downloaded-resume.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast.success("ファイルのダウンロードを開始しました");
    } catch (err: any) {
      const errorMessage = err.message || 'ファイルのダウンロードに失敗しました';
      console.error('ダウンロードエラー:', errorMessage);
      toast.error(errorMessage);
    }
  };
  
  // ステータスデータをグラフ用に変換
  const statusChartData = Object.entries(statusStats).map(([status, count]) => ({
    name: status,
    value: count
  }));
  
  // キーワード関連の処理
  const handleAddKeyword = async () => {
    if (newKeyword.trim()) {
      setKeywordsLoading(true);
      try {
        const result = await addKeyword(newKeyword, newAction);
        
        if (result.success && result.data) {
          setKeywords([...keywords, result.data]);
          setNewKeyword("");
          toast.success(`キーワード「${newKeyword}」を追加しました`);
        } else {
          toast.error(`キーワード追加エラー: ${result.error_message}`);
        }
      } catch (error: any) {
        console.error('キーワード追加に失敗:', error);
        toast.error(error.message || 'キーワードの追加に失敗しました');
      } finally {
        setKeywordsLoading(false);
      }
    }
  };

  const startEditing = (keyword: Keyword) => {
    setEditingKeyword({
      id: keyword.id,
      keyword: keyword.keyword,
      action: keyword.action,
    });
  };

  const saveEdit = async (id: number) => {
    setKeywordsLoading(true);
    try {
      const result = await updateKeyword(
        id, 
        editingKeyword.keyword, 
        editingKeyword.action
      );
      
      if (result.success && result.data) {
        setKeywords(
          keywords.map((k) => (k.id === id ? result.data : k))
        );
        setEditingKeyword({ id: null, keyword: "", action: "" });
        toast.success("キーワードの設定を更新しました");
      } else {
        toast.error(`キーワード更新エラー: ${result.error_message}`);
      }
    } catch (error: any) {
      console.error('キーワード更新に失敗:', error);
      toast.error(error.message || 'キーワードの更新に失敗しました');
    } finally {
      setKeywordsLoading(false);
    }
  };

  const cancelEdit = () => {
    setEditingKeyword({ id: null, keyword: "", action: "" });
  };

  const deleteKeywordItem = async (id: number) => {
    const keywordToDelete = keywords.find(k => k.id === id);
    if (!keywordToDelete) return;
    
    setKeywordsLoading(true);
    try {
      const result = await deleteKeyword(id);
      
      if (result.success) {
        setKeywords(keywords.filter((k) => k.id !== id));
        toast.success(`キーワード「${keywordToDelete.keyword}」を削除しました`);
      } else {
        toast.error(`キーワード削除エラー: ${result.error_message}`);
      }
    } catch (error: any) {
      console.error('キーワード削除に失敗:', error);
      toast.error(error.message || 'キーワードの削除に失敗しました');
    } finally {
      setKeywordsLoading(false);
    }
  };

  // 日付フォーマット変換
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch (e) {
      return '無効な日付';
    }
  };

  // 過去5年分の選択肢を生成
  const yearOptions = Array.from({length: 5}, (_, i) => {
    const year = new Date().getFullYear() - i;
    return { value: year, label: `${year}年` };
  });

  return (
    <div className="container mx-auto p-6 space-y-8 animate-fadeIn bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <div className="flex justify-between items-center mb-8">
      <Link href="./">
        <ArrowLeft />
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          管理ダッシュボード
        </h1>
        
        <Button
          variant="outline"
          className="hover:bg-gray-100 transition-colors"
          onClick={refreshAllData}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          すべて更新
        </Button>
      </div>

      <Tabs defaultValue="resumes" className="space-y-6">
        <TabsList className="inline-flex h-12 items-center justify-center rounded-lg bg-gray-100 p-1 text-gray-500 mb-4">
          <TabsTrigger value="resumes">職務経歴書一覧</TabsTrigger>
          <TabsTrigger value="keywords">キーワード管理</TabsTrigger>
          <TabsTrigger value="analytics">分析</TabsTrigger>
        </TabsList>

        <TabsContent value="resumes" className="space-y-4">
          <Card className="p-6 shadow-lg bg-white/80 backdrop-blur-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                アップロード済み職務経歴書 ({resumes.length}件)
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchResumeFiles}
                className="text-gray-600 hover:text-gray-900"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                更新する
              </Button>
            </div>
            
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-md">
                エラー: {error}
              </div>
            )}
            
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold w-2/5">タイトル</TableHead>
                    <TableHead className="font-semibold w-1/5">ステータス</TableHead>
                    <TableHead className="font-semibold w-1/5">アップロード日時</TableHead>
                    <TableHead className="font-semibold w-1/5">ユーザー</TableHead>
                    <TableHead className="text-right font-semibold">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <div className="flex justify-center items-center">
                          <RefreshCw className="h-5 w-5 animate-spin mr-2 text-gray-500" />
                          データを読み込み中...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : resumes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        保存されたファイルがありません
                      </TableCell>
                    </TableRow>
                  ) : (
                    resumes.map((resume) => (
                      <TableRow key={resume.id} className="hover:bg-gray-50/50">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 flex-shrink-0 text-blue-500" />
                            <span className="line-clamp-2 break-words">{resume.title || '名称なし'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-sm ${
                            resume.status === "添削済み" 
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}>
                            {resume.status || '未分類'}
                          </span>
                        </TableCell>
                        <TableCell>{formatDate(resume.uploaded_at)}</TableCell>
                        <TableCell className="truncate max-w-[150px]">{resume.user_name || 'ゲストユーザー'}</TableCell>
                        {/* <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(resume.file_path, resume.title)}
                            className="hover:bg-blue-50 text-blue-600"
                          >
                            <Download className="h-4 w-4 mr-1" />
                            ダウンロード
                          </Button>
                        </TableCell> */}
                        <TableCell className="text-right">
  <Button
    variant="ghost"
    size="sm"
    onClick={() => openTextComparisonModal(resume)}
    className="hover:bg-blue-50 text-blue-600"
  >
    <Edit2 className="h-4 w-4 mr-1" />
    テキスト比較
  </Button>
</TableCell>
                        {selectedResume && (
  <TextComparisonModal
    originalText={selectedResume.original_text || ''}
    correctedText={selectedResume.corrected_text || ''}
    fileName={selectedResume.title || ''}
    isOpen={comparisonModalOpen}
    onOpenChange={(open) => {
      setComparisonModalOpen(open);
      if (!open) {
        setSelectedResume(null);
      }
    }}
  />
)}
                        
                      </TableRow>
                       
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="keywords">
          <Card className="p-6 shadow-lg bg-white/80 backdrop-blur-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                キーワード設定
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchKeywords}
                className="text-gray-600 hover:text-gray-900"
                disabled={keywordsLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${keywordsLoading ? 'animate-spin' : ''}`} />
                更新する
              </Button>
            </div>
            
            <Alert className="mb-6 bg-amber-50 border-amber-200">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <AlertDescription className="ml-2">
                ここで設定したキーワードは添削プロセス中に検出され、「添削対象外」に設定したキーワードはAIプロンプトに含まれなくなります。
              </AlertDescription>
            </Alert>
            
            <div className="space-y-6">
              <div className="flex gap-4 items-end">
                <div className="space-y-2 flex-1">
                  <label htmlFor="newKeyword" className="text-sm font-medium">
                    キーワード
                  </label>
                  <Input
                    id="newKeyword"
                    placeholder="キーワードを入力"
                    className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="newAction" className="text-sm font-medium">
                    アクション
                  </label>
                  <Select 
                    value={newAction} 
                    onValueChange={setNewAction}
                  >
                    <SelectTrigger id="newAction" className="w-[150px]">
                      <SelectValue placeholder="アクションを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="添削対象外">添削対象外</SelectItem>
                      <SelectItem value="要確認">要確認</SelectItem>
                      <SelectItem value="警告表示">警告表示</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleAddKeyword}
                  className="bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                  disabled={keywordsLoading}
                >
                  追加
                </Button>
              </div>

              <div className="relative">
                {keywordsLoading && (
                  <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center">
                    <RefreshCw className="h-10 w-10 animate-spin text-blue-500" />
                  </div>
                )}
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold w-2/5">キーワード</TableHead>
                      <TableHead className="font-semibold w-2/5">アクション</TableHead>
                      <TableHead className="text-right font-semibold w-1/5">
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keywords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                          登録されたキーワードがありません
                        </TableCell>
                      </TableRow>
                    ) : (
                      keywords.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {editingKeyword.id === item.id ? (
                              <Input
                                value={editingKeyword.keyword}
                                onChange={(e) =>
                                  setEditingKeyword({
                                    ...editingKeyword,
                                    keyword: e.target.value,
                                  })
                                }
                                className="max-w-[200px]"
                              />
                            ) : (
                              item.keyword
                            )}
                          </TableCell>
                          <TableCell>
                            {editingKeyword.id === item.id ? (
                              <Select
                                value={editingKeyword.action}
                                onValueChange={(value) =>
                                  setEditingKeyword({
                                    ...editingKeyword,
                                    action: value,
                                  })
                                }
                              >
                                <SelectTrigger className="w-[150px]">
                                  <SelectValue placeholder="アクションを選択" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="添削対象外">添削対象外</SelectItem>
                                  <SelectItem value="要確認">要確認</SelectItem>
                                  <SelectItem value="警告表示">警告表示</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className={`px-2 py-1 rounded-full text-sm ${
                                item.action === "添削対象外" 
                                  ? "bg-red-100 text-red-800"
                                  : item.action === "要確認"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}>
                                {item.action}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {editingKeyword.id === item.id ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => saveEdit(item.id)}
                                  className="mr-2"
                                >
                                  <Check className="h-4 w-4 text-green-500" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={cancelEdit}
                                >
                                  <X className="h-4 w-4 text-red-500" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => startEditing(item)}
                                  className="mr-2"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteKeywordItem(item.id)}
                                  className="text-red-500 hover:bg-red-50 hover:text-red-600"
                                >
                                  削除
                                </Button>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 月間アップロード統計 */}
            <Card className="p-6 shadow-lg bg-white/80 backdrop-blur-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  月間アップロード推移
                </h2>
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedYear.toString()}
                    onValueChange={(value) => setSelectedYear(parseInt(value))}
                  >
                    <SelectTrigger className="w-[120px]">
                      <Calendar className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="年を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchStats(selectedYear)}
                    className="text-gray-600 hover:text-gray-900"
                    disabled={statsLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${statsLoading ? 'animate-spin' : ''}`} />
                    更新
                  </Button>
                </div>
              </div>
              <div className="h-[300px]">
                {statsLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <RefreshCw className="h-10 w-10 animate-spin text-gray-400" />
                  </div>
                ) : monthlyStats.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    データがありません
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" stroke="#6b7280" tick={{ fill: '#6b7280' }} />
                      <YAxis stroke="#6b7280" tick={{ fill: '#6b7280' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: 'none' }}
                        formatter={(value) => [`${value}件`, 'アップロード数']}
                        labelFormatter={(label) => `${label} (${selectedYear}年)`}
                      />
                      <Bar 
                        dataKey="uploads" 
                        fill="#3b82f6" 
                        radius={[4, 4, 0, 0]} 
                        animationDuration={1000}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
            
            {/* ステータス別グラフ */}
            <Card className="p-6 shadow-lg bg-white/80 backdrop-blur-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  ステータス別割合
                </h2>
              </div>
              <div className="h-[300px]">
                {statsLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <RefreshCw className="h-10 w-10 animate-spin text-gray-400" />
                  </div>
                ) : statusChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    データがありません
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        animationDuration={1000}
                      >
                        {statusChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value) => [`${value}件`, '']}
                        contentStyle={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: 'none' }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>
          
          {/* 総合統計 */}
          <Card className="p-6 shadow-lg bg-white/80 backdrop-blur-sm mt-6">
            <h2 className="text-xl font-semibold mb-6 text-gray-900">
              総合統計
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 shadow-sm border border-blue-100">
                <h3 className="text-sm text-blue-600 font-medium mb-2">総アップロード数</h3>
                <p className="text-3xl font-bold text-blue-700">
                  {statsLoading ? (
                    <RefreshCw className="h-6 w-6 animate-spin text-blue-400" />
                  ) : (
                    // ファイル一覧のカウントを使用 - 問題修正
                    resumes.length
                  )}
                </p>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4 shadow-sm border border-green-100">
                <h3 className="text-sm text-green-600 font-medium mb-2">添削済みファイル</h3>
                <p className="text-3xl font-bold text-green-700">
                  {statsLoading ? (
                    <RefreshCw className="h-6 w-6 animate-spin text-green-400" />
                  ) : (
                    statusStats['添削済み'] || 0
                  )}
                </p>
              </div>
              
              <div className="bg-amber-50 rounded-lg p-4 shadow-sm border border-amber-100">
                <h3 className="text-sm text-amber-600 font-medium mb-2">{selectedYear}年合計</h3>
                <p className="text-3xl font-bold text-amber-700">
                  {statsLoading ? (
                    <RefreshCw className="h-6 w-6 animate-spin text-amber-400" />
                  ) : (
                    monthlyStats.reduce((sum, item) => sum + item.uploads, 0)
                  )}
                </p>
              </div>
            </div>
            
            <div className="mt-8">
              <h3 className="text-lg font-medium mb-4 text-gray-800">アップロード傾向分析</h3>
              <div className="h-[400px]">
                {statsLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <RefreshCw className="h-10 w-10 animate-spin text-gray-400" />
                  </div>
                ) : monthlyStats.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    データがありません
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" stroke="#6b7280" tick={{ fill: '#6b7280' }} />
                      <YAxis stroke="#6b7280" tick={{ fill: '#6b7280' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', border: 'none' }}
                        formatter={(value) => [`${value}件`, 'アップロード数']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="uploads" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#3b82f6' }}
                        activeDot={{ r: 6 }}
                        animationDuration={1500}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}