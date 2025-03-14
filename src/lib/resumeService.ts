import supabase from './supabase';

export interface ResumeFile {
  id: number;
  title: string;
  status: string;
  uploaded_at: string;
  user_name: string;
  file_path: string;
  metadata?: any;
  original_text?: string;
  corrected_text?: string;
  pdf_url?:string
}

export interface Keyword {
  id: number;
  keyword: string;
  action: string;
  created_at?: string;
}

export interface UploadResult {
  success: boolean;
  file_id?: number;
  file_path?: string;
  error?: any;
  error_details?: any;
  error_message?: string;
}

export interface MonthlyStats {
  month: string;
  uploads: number;
}

/**
 * 添削済みファイルの情報をSupabaseに保存
 * 認証不要でデータベースに保存できるようにエラーハンドリングを強化
 */
/**
 * 添削済みファイルの情報をSupabaseに保存
 * 再添削の場合は「再添削」ステータスを設定
 */
/**
 * 添削済みファイルの情報をSupabaseに保存
 * 新しい添削のみを「再添削」ステータスに設定（過去の添削は更新しない）
 */
export async function saveResumeFile(
  fileName: string,
  filePath: string,
  userName: string = 'ゲストユーザー',
  metadata: any = {}
): Promise<UploadResult> {
  try {
    // メタデータから不要な項目を抽出
    const { 
      originalText, 
      correctedText, 
      ...cleanedMetadata 
    } = metadata;

    // 同じファイル名で過去に添削されたかチェック
    const { data: existingFiles, error: existingError } = await supabase
      .from('resume_files')
      .select('id, title')
      .eq('title', fileName)
      .eq('user_name', userName);

    // エラーハンドリング
    if (existingError) {
      console.warn('既存ファイル検索エラー:', existingError);
      // エラーがあっても処理を続行
    }

    // 再添削かどうか判定 - 過去に添削があれば再添削
    const isReReview = existingFiles && existingFiles.length > 0;
    
    // 添削ステータスを設定 - 現在の新しい添削のみ「再添削」とする
    const status = isReReview ? '再添削' : '添削済み';
    
    // 添削回数を計算
    const reviewCount = isReReview ? existingFiles.length + 1 : 1;

    // メタデータを拡張
    const enhancedMetadata = {
      ...cleanedMetadata,
      originalFileName: fileName,
      processedAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      isReReview,
      reviewCount,
      previousReviews: isReReview ? existingFiles.map(f => f.id) : []
    };
    
    // デバッグログを追加
    console.log("Supabase保存前のデバッグ情報:", {
      fileName,
      filePath,
      userName,
      status,
      reviewCount,
      isReReview,
      originalTextLength: originalText ? originalText.length : null,
      correctedTextLength: correctedText ? correctedText.length : null,
      metadata: JSON.stringify(enhancedMetadata).substring(0, 500)
    });
    
    // 文字数が長すぎる場合は切り詰める（Supabaseの制限に対応）
    const MAX_TEXT_LENGTH = 1000000; // 100万文字まで
    const truncatedOriginalText = originalText 
      ? (originalText.length > MAX_TEXT_LENGTH 
        ? originalText.substring(0, MAX_TEXT_LENGTH) 
        : originalText)
      : null;
    
    const truncatedCorrectedText = correctedText 
      ? (correctedText.length > MAX_TEXT_LENGTH 
        ? correctedText.substring(0, MAX_TEXT_LENGTH) 
        : correctedText)
      : null;
    
    // Supabaseのテーブルにデータを保存 - 新しいレコードのみを「再添削」ステータスで作成
    const { data, error } = await supabase
      .from('resume_files')
      .insert([
        {
          title: fileName,
          user_name: userName,
          status: status, // 再添削ステータス（過去のレコードは更新しない）
          file_path: filePath,
          metadata: enhancedMetadata,
          original_text: truncatedOriginalText,
          corrected_text: truncatedCorrectedText,
          pdf_url: metadata.pdfUrl,
          uploaded_at: new Date().toISOString()
        }
      ])
      .select();
    
    // エラーハンドリング
    if (error) {
      console.error('データベース挿入エラーの詳細:', {
        code: error.code,
        message: error.message,
        hint: error.hint,
        details: JSON.stringify(error.details),
        fullError: JSON.stringify(error)
      });
      
      return { 
        success: false, 
        error,
        error_details: {
          code: error.code,
          message: error.message,
          fullError: JSON.stringify(error)
        },
        file_path: filePath,
      };
    }
    
    // 保存成功時のログ
    console.log('データベース保存成功:', {
      fileId: data?.[0]?.id,
      title: fileName,
      status,
      reviewCount,
      originalTextSaved: !!truncatedOriginalText,
      correctedTextSaved: !!truncatedCorrectedText
    });
    
    return { 
      success: true, 
      file_id: data?.[0]?.id,
      file_path: filePath,
      status,
      reviewCount
    }as UploadResult;
  } catch (error: any) {
    // 予期せぬエラーのハンドリング
    console.error('ファイル情報の保存エラー:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    
    return { 
      success: false, 
      error,
      error_details: {
        message: error.message || 'Unknown error',
        name: error.name,
        time: new Date().toISOString()
      },
      file_path: filePath,
    };
  }
}
// 他の関数（getAllResumeFiles、getResumeFile等）は前回と同じなので省略
// ...

/**
 * 全ての添削済みファイルを取得 - シンプル化した実装
 */
export async function getAllResumeFiles() {
  try {
    console.log('シンプルな方法でファイル一覧を取得中...');
    
    // 接続情報の確認
    console.log('Supabase接続情報:', {
      URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '設定済み' : '未設定',
      KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '設定済み' : '未設定'
    });
    
    // 最もシンプルなクエリで試行
    const { data, error } = await supabase
      .from('resume_files')
      .select('*');
    
    // 詳細なログを出力
    console.log('クエリ結果:', {
      成功: !error,
      データ数: data?.length || 0,
      エラー発生: !!error
    });
    
    if (error) {
      console.error('ファイル一覧取得エラー詳細:', {
        コード: error.code,
        メッセージ: error.message,
        詳細: error.details,
        ヒント: error.hint
      });
      return { 
        success: false, 
        error, 
        error_message: error.message || 'ファイル一覧の取得に失敗しました',
        data: [] as ResumeFile[]
      };
    }
    
    // データの形式確認
    if (!data) {
      console.warn('データがnullです');
      return { success: true, data: [] as ResumeFile[] };
    }
    
    if (!Array.isArray(data)) {
      console.warn('データが配列ではありません:', typeof data);
      return { success: true, data: [] as ResumeFile[] };
    }
    
    if (data.length > 0) {
      // 最初のレコードの構造をログ出力
      console.log('最初のレコード構造:', Object.keys(data[0]));
      console.log('1件目のレコードサンプル:', {
        id: data[0].id,
        title: data[0].title,
        status: data[0].status,
        file_path: data[0].file_path
      });
    } else {
      console.log('取得したデータは空です');
    }
    
    return { success: true, data: data as ResumeFile[] };
  } catch (error: any) {
    // エラーオブジェクトの詳細情報を出力
    console.error('ファイル取得エラー:', {
      メッセージ: error?.message,
      名前: error?.name,
      スタック: error?.stack?.substring(0, 200), // スタックトレースの先頭部分だけ
      オブジェクト: JSON.stringify(error)
    });
    return { 
      success: false, 
      error,
      error_message: error?.message || 'ファイル一覧の取得に失敗しました', 
      data: [] as ResumeFile[]
    };
  }
}

/**
 * 特定のファイルを取得
 */
export async function getResumeFile(id: number) {
  try {
    console.log(`ID:${id}のファイル情報を取得中...`);
    
    const { data, error } = await supabase
      .from('resume_files')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('ファイル取得エラー:', error);
      return { success: false, error, error_message: error.message, data: null };
    }
    
    if (!data) {
      console.warn(`ID:${id}のファイルが見つかりませんでした`);
      return { success: false, error_message: 'ファイルが見つかりません', data: null };
    }
    
    console.log(`ID:${id}のファイル情報を取得しました`);
    return { success: true, data: data as ResumeFile };
  } catch (error: any) {
    console.error('ファイル取得エラー:', error);
    return { 
      success: false, 
      error, 
      error_message: error.message || 'ファイルの取得に失敗しました',
      data: null 
    };
  }
}

/**
 * ファイルのダウンロードURLを取得
 * ローカルAPIエンドポイントを使用
 */
export async function getFileDownloadURL(filePath: string) {
  try {
    console.log(`ファイル「${filePath}」のダウンロードURLを構築中...`);
    
    // APIエンドポイントのURLを構築
    const url = `/api/download?file=${encodeURIComponent(filePath)}`;
    return { success: true, url };
  } catch (error: any) {
    console.error('URL構築エラー:', error);
    return { 
      success: false, 
      error, 
      error_message: error.message || 'ダウンロードURLの作成に失敗しました',
      url: null 
    };
  }
}

/**
 * 月ごとのアップロード統計を取得
 */
export async function getMonthlyStats(year: number = new Date().getFullYear()) {
  try {
    console.log(`${year}年の月間統計を取得中...`);
    
    // データベースからデータを取得
    const { data, error } = await supabase
      .from('resume_files')
      .select('uploaded_at')
      .gte('uploaded_at', `${year}-01-01`)
      .lte('uploaded_at', `${year}-12-31`);
    
    console.log('月間統計クエリ結果:', {
      成功: !error,
      データ数: data?.length || 0,
      エラー発生: !!error
    });
    
    if (error) {
      console.error('月間統計データ取得エラー:', {
        コード: error.code,
        メッセージ: error.message,
        詳細: error.details,
        ヒント: error.hint
      });
      return await generateEmptyMonthlyStats();
    }
    
    // データが存在しない場合も空の結果を返す
    if (!data || data.length === 0) {
      console.log('該当する期間のデータが見つかりませんでした');
      return await generateEmptyMonthlyStats();
    }
    
    // 月ごとに集計
    return await calculateMonthlyStatsFromData(data, year);
  } catch (error: any) {
    console.error('月間統計取得エラー（例外）:', {
      メッセージ: error?.message,
      スタック: error?.stack?.substring(0, 200),
      名前: error?.name
    });
    
    const emptyStats = await generateEmptyMonthlyStats();
    return { 
      success: false, 
      error, 
      error_message: error?.message || '月間統計の取得に失敗しました',
      data: emptyStats.data
    };
  }
}

/**
 * 取得したデータから月間統計を計算
 */
async function calculateMonthlyStatsFromData(data: any[], year: number) {
  try {
    console.log(`${year}年の月間データを集計中... (${data.length}件)`);
    
    // 月ごとに集計
    const monthlyData = new Array(12).fill(0);
    
    // 日付のパースエラーをカウント
    let parseErrors = 0;
    
    data.forEach(file => {
      try {
        const date = new Date(file.uploaded_at);
        if (isNaN(date.getTime())) {
          parseErrors++;
          return;
        }
        const month = date.getMonth(); // 0-11
        monthlyData[month]++;
      } catch (e) {
        parseErrors++;
        console.warn('日付解析エラー:', e, file);
      }
    });
    
    if (parseErrors > 0) {
      console.warn(`${parseErrors}件の日付解析エラーが発生しました`);
    }
    
    // フォーマットを整形
    const formattedData = monthlyData.map((count, index) => ({
      month: `${index + 1}月`,
      uploads: count
    }));
    
    console.log('月間統計集計結果:', formattedData);
    
    return { success: true, data: formattedData };
  } catch (error: any) {
    console.error('統計計算エラー:', error);
    const emptyStats = await generateEmptyMonthlyStats();
    return { 
      success: false, 
      error, 
      error_message: error.message || '統計の計算に失敗しました',
      data: emptyStats.data 
    };
  }
}

/**
 * 空の月間統計データを生成
 */
async function generateEmptyMonthlyStats() {
  const emptyData = new Array(12).fill(0).map((_, index) => ({
    month: `${index + 1}月`,
    uploads: 0
  }));
  
  return { success: true, data: emptyData };
}

/**
 * ステータス別のファイル数を取得
 */
export async function getStatusStats() {
  try {
    console.log('ステータス別統計を取得中...');
    
    const { data, error } = await supabase
      .from('resume_files')
      .select('status');
    
    console.log('ステータスクエリ結果:', {
      成功: !error,
      データ数: data?.length || 0,
      エラー発生: !!error
    });
    
    if (error) {
      console.error('ステータス統計取得エラー:', {
        コード: error.code,
        メッセージ: error.message,
        詳細: error.details,
        ヒント: error.hint
      });
      return { success: false, error, error_message: error.message, data: { '添削済み': 0 } };
    }
    
    // ステータス別に集計
    const stats = data.reduce((acc: {[key: string]: number}, item) => {
      const status = item.status || '未分類';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    
    // データがない場合はデフォルト値を設定
    if (Object.keys(stats).length === 0) {
      stats['添削済み'] = 0;
    }
    
    console.log('ステータス集計結果:', stats);
    
    return { success: true, data: stats };
  } catch (error: any) {
    console.error('ステータス統計取得エラー（例外）:', {
      メッセージ: error?.message,
      スタック: error?.stack?.substring(0, 200),
      名前: error?.name
    });
    return { 
      success: false, 
      error, 
      error_message: error?.message || 'ステータス統計の取得に失敗しました',
      data: { '添削済み': 0 } 
    };
  }
}

/**
 * キーワード一覧を取得
 */
export async function getAllKeywords() {
  try {
    const { data, error } = await supabase
      .from('keywords')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('キーワード一覧取得エラー:', error);
      return { success: false, error, error_message: error.message, data: [] };
    }
    
    return { success: true, data: data as Keyword[] };
  } catch (error: any) {
    console.error('キーワード取得エラー:', error);
    return { 
      success: false, 
      error, 
      error_message: error.message || 'キーワード一覧の取得に失敗しました',
      data: [] as Keyword[] 
    };
  }
}

/**
 * キーワードを保存
 */
export async function saveKeyword(keyword: string, action: string) {
  try {
    const { data, error } = await supabase
      .from('keywords')
      .insert([
        { keyword, action }
      ])
      .select();
    
    if (error) {
      console.error('キーワード保存エラー:', error);
      return { success: false, error, error_message: error.message };
    }
    
    return { success: true, data: data[0] as Keyword };
  } catch (error: any) {
    console.error('キーワード保存エラー:', error);
    return { 
      success: false, 
      error, 
      error_message: error.message || 'キーワードの保存に失敗しました' 
    };
  }
}

/**
 * キーワードを更新
 */
export async function updateKeyword(id: number, keyword: string, action: string) {
  try {
    const { data, error } = await supabase
      .from('keywords')
      .update({ keyword, action })
      .eq('id', id)
      .select();
    
    if (error) {
      console.error('キーワード更新エラー:', error);
      return { success: false, error, error_message: error.message };
    }
    
    return { success: true, data: data[0] as Keyword };
  } catch (error: any) {
    console.error('キーワード更新エラー:', error);
    return { 
      success: false, 
      error, 
      error_message: error.message || 'キーワードの更新に失敗しました' 
    };
  }
}

/**
 * キーワードを削除
 */
export async function deleteKeyword(id: number) {
  try {
    const { error } = await supabase
      .from('keywords')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('キーワード削除エラー:', error);
      return { success: false, error, error_message: error.message };
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('キーワード削除エラー:', error);
    return { 
      success: false, 
      error, 
      error_message: error.message || 'キーワードの削除に失敗しました' 
    };
  }
}