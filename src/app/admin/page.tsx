"use client"
import React, { useState } from "react";
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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Settings, Check, X, Edit2, FileText, Download } from "lucide-react";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
// import { useToast } from "@/hooks/use-toast";

const data = [
  { name: "1月", uploads: 40 },
  { name: "2月", uploads: 30 },
  { name: "3月", uploads: 45 },
  { name: "4月", uploads: 50 },
  { name: "5月", uploads: 35 },
  { name: "6月", uploads: 60 },
];

interface Keyword {
  id: number;
  keyword: string;
  action: string;
  isEditing?: boolean;
}

const mockResumes = [
  { id: 1, title: "エンジニア職務経歴書", status: "添削済み", uploadedAt: "2024-03-15 10:30", user: "田中太郎" },
  { id: 2, title: "プロジェクトマネージャー職務経歴書", status: "添削中", uploadedAt: "2024-03-15 11:45", user: "山田花子" },
  { id: 3, title: "デザイナー職務経歴書", status: "添削済み", uploadedAt: "2024-03-15 13:20", user: "佐藤次郎" },
];

export default function AdminDashboard() {
  // const { toast } = useToast();
  const [keywords, setKeywords] = useState<Keyword[]>([
    { id: 1, keyword: "機密情報", action: "添削対象外" },
    { id: 2, keyword: "個人情報", action: "添削対象外" },
    { id: 3, keyword: "社内", action: "要確認" },
  ]);
  const [newKeyword, setNewKeyword] = useState("");
  const [editingKeyword, setEditingKeyword] = useState<{
    id: number | null;
    keyword: string;
    action: string;
  }>({ id: null, keyword: "", action: "" });

  const handleAddKeyword = () => {
    if (newKeyword.trim()) {
      const newId = Math.max(...keywords.map((k) => k.id), 0) + 1;
      setKeywords([
        ...keywords,
        { id: newId, keyword: newKeyword, action: "要確認" },
      ]);
      setNewKeyword("");
      // toast({
      //   title: "キーワードを追加しました",
      //   description: `"${newKeyword}"を追加しました。`,
      // });
      console.log("キーワードを追加しました")
    }
  };

  const startEditing = (keyword: Keyword) => {
    setEditingKeyword({
      id: keyword.id,
      keyword: keyword.keyword,
      action: keyword.action,
    });
  };

  const saveEdit = (id: number) => {
    setKeywords(
      keywords.map((k) =>
        k.id === id
          ? {
              ...k,
              keyword: editingKeyword.keyword,
              action: editingKeyword.action,
            }
          : k
      )
    );
    setEditingKeyword({ id: null, keyword: "", action: "" });
    // toast({
    //   title: "変更を保存しました",
    //   description: "キーワードの設定を更新しました。",
    // });
    console.log("キーワードの設定を更新しました")
  };

  const cancelEdit = () => {
    setEditingKeyword({ id: null, keyword: "", action: "" });
  };

  const deleteKeyword = (id: number) => {
    setKeywords(keywords.filter((k) => k.id !== id));
    // toast({
    //   title: "キーワードを削除しました",
    //   variant: "destructive",
    // });
    console.log("キーワードを削除しました")
  };

  const handleDownload = (id: number) => {
    // toast({
    //   title: "ダウンロードを開始しました",
    //   description: "職務経歴書のダウンロードを開始します。"
    // });
    console.log("職務経歴書のダウンロードを開始します。")
  };

  return (
    <div className="container mx-auto p-6 space-y-8 animate-fadeIn bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          管理ダッシュボード
        </h1>
        <Button
          variant="outline"
          className="hover:bg-gray-100 transition-colors"
        >
          <Settings className="mr-2 h-4 w-4" />
          設定
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
                アップロード済み職務経歴書
              </h2>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">タイトル</TableHead>
                    <TableHead className="font-semibold">ステータス</TableHead>
                    <TableHead className="font-semibold">アップロード日時</TableHead>
                    <TableHead className="font-semibold">ユーザー</TableHead>
                    <TableHead className="text-right font-semibold">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* {mockResumes.map((resume) => (
                    <TableRow key={resume.id} className="hover:bg-gray-50/50">
                      <TableCell className="font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        {resume.title}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-sm ${
                          resume.status === "添削済み" 
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {resume.status}
                        </span>
                      </TableCell>
                      <TableCell>{resume.uploadedAt}</TableCell>
                      <TableCell>{resume.user}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(resume.id)}
                          className="hover:bg-blue-50 text-blue-600"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          ダウンロード
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))} */}
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
            </div>
            <div className="space-y-6">
              <div className="flex gap-4">
                <Input
                  placeholder="キーワードを入力"
                  className="max-w-sm border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                />
                <Button
                  onClick={handleAddKeyword}
                  className="bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  追加
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">キーワード</TableHead>
                    <TableHead className="font-semibold">アクション</TableHead>
                    <TableHead className="text-right font-semibold">
                      操作
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keywords.map((item) => (
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
                          <Input
                            value={editingKeyword.action}
                            onChange={(e) =>
                              setEditingKeyword({
                                ...editingKeyword,
                                action: e.target.value,
                              })
                            }
                            className="max-w-[200px]"
                          />
                        ) : (
                          item.action
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
                              onClick={() => deleteKeyword(item.id)}
                              className="text-red-500 hover:bg-red-50 hover:text-red-600"
                            >
                              削除
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <Card className="p-6 shadow-lg bg-white/80 backdrop-blur-sm">
            <h2 className="text-xl font-semibold mb-6 text-gray-900">
              アップロード推移
            </h2>
            <div className="h-[400px]">
              <ChartContainer
                className="mt-4"
                config={{
                  uploads: {
                    label: "アップロード数",
                    theme: {
                      light: "#2563eb",
                      dark: "#60a5fa",
                    },
                  },
                }}
              >
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#6b7280" tick={{ fill: '#6b7280' }} />
                  <YAxis stroke="#6b7280" tick={{ fill: '#6b7280' }} />
                  <ChartTooltip />
                  {/* <Line
                    type="monotone"
                    dataKey="uploads"
                    stroke="var(--color-uploads)"
                    strokeWidth={2}
                  /> */}
                </LineChart>
              </ChartContainer>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}