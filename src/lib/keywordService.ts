// /lib/keywordService.ts
import { createClient } from '@supabase/supabase-js';

// Supabaseの設定
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// キーワード型定義
export interface Keyword {
  id: number;
  keyword: string;
  action: string;
  created_at?: string;
}

/**
 * キーワード一覧を取得する
 */
export async function getAllKeywords() {
  try {
    // Supabase接続情報をチェック
    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase設定エラー: 環境変数が不足しています');
      return { 
        success: false, 
        data: null, 
        error_message: 'Supabase接続情報が正しく設定されていません' 
      };
    }

    // キーワードテーブルからデータを取得
    const { data, error } = await supabase
      .from('keywords')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('キーワード取得エラー:', JSON.stringify(error));
      return { 
        success: false, 
        data: null, 
        error_message: error.message || 'キーワード取得中に不明なエラーが発生しました' 
      };
    }

    // データが存在しない場合は空の配列を返す
    if (!data || !Array.isArray(data)) {
      console.warn('キーワードデータが見つかりません（空または無効な形式）');
      return { success: true, data: [], error_message: null };
    }

    return { success: true, data, error_message: null };
  } catch (error: any) {
    console.error('キーワード取得例外:', error);
    return { 
      success: false, 
      data: null, 
      error_message: error?.message || '予期せぬエラーが発生しました' 
    };
  }
}

/**
 * キーワードを追加する
 */
export async function addKeyword(keyword: string, action: string) {
  try {
    if (!keyword.trim()) {
      return { 
        success: false, 
        data: null, 
        error_message: 'キーワードが空です' 
      };
    }

    const { data, error } = await supabase
      .from('keywords')
      .insert([{ keyword, action }])
      .select()
      .single();

    if (error) {
      console.error('キーワード追加エラー:', JSON.stringify(error));
      return { 
        success: false, 
        data: null, 
        error_message: error.message || 'キーワードの追加に失敗しました' 
      };
    }

    return { success: true, data, error_message: null };
  } catch (error: any) {
    console.error('キーワード追加例外:', error);
    return { 
      success: false, 
      data: null, 
      error_message: error?.message || '予期せぬエラーが発生しました' 
    };
  }
}

/**
 * キーワードを更新する
 */
export async function updateKeyword(id: number, keyword: string, action: string) {
  try {
    if (!keyword.trim()) {
      return { 
        success: false, 
        data: null, 
        error_message: 'キーワードが空です.' 
      };
    }

    const { data, error } = await supabase
      .from('keywords')
      .update({ keyword, action })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('キーワード更新エラー:', JSON.stringify(error));
      return { 
        success: false, 
        data: null, 
        error_message: error.message || 'キーワードの更新に失敗しました' 
      };
    }

    return { success: true, data, error_message: null };
  } catch (error: any) {
    console.error('キーワード更新例外:', error);
    return { 
      success: false, 
      data: null, 
      error_message: error?.message || '予期せぬエラーが発生しました' 
    };
  }
}

/**
 * キーワードを削除する
 */
export async function deleteKeyword(id: number) {
  try {
    const { error } = await supabase
      .from('keywords')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('キーワード削除エラー:', JSON.stringify(error));
      return { 
        success: false, 
        error_message: error.message || 'キーワードの削除に失敗しました' 
      };
    }

    return { success: true, error_message: null };
  } catch (error: any) {
    console.error('キーワード削除例外:', error);
    return { 
      success: false, 
      error_message: error?.message || '予期せぬエラーが発生しました' 
    };
  }
}

/**
 * テキスト内の禁止キーワードを検出し、処理する
 */
export async function processRestrictedKeywords(text: string) {
  try {
    // キーワードがない場合は元のテキストをそのまま返す
    if (!text || typeof text !== 'string') {
      return { 
        text: text || '', 
        containsRestricted: false, 
        actions: {},
        success: true,
        error_message: null
      };
    }

    // すべてのキーワードを取得
    const result = await getAllKeywords();
    
    // キーワード取得に失敗した場合でも処理を続行
    const keywords = result.success && result.data ? result.data : [];
    
    // キーワードがない場合
    if (keywords.length === 0) {
      return { 
        text, 
        containsRestricted: false, 
        actions: {},
        success: true,
        error_message: result.success ? null : result.error_message
      };
    }
    
    let modifiedText = text;
    const detectedKeywords: Record<string, string> = {};
    let containsRestricted = false;
    
    // 各キーワードをチェック
    for (const keywordObj of keywords) {
      // キーワードが存在し、空でないことを確認
      if (!keywordObj.keyword || typeof keywordObj.keyword !== 'string') {
        continue;
      }
      
      // 安全な正規表現を作成（特殊文字をエスケープ）
      const safeKeyword = keywordObj.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safeKeyword, 'gi');
      
      if (regex.test(text)) {
        // キーワードが見つかった
        containsRestricted = true;
        detectedKeywords[keywordObj.keyword] = keywordObj.action;
        
        // 「添削対象外」のキーワードは置換する（例：[機密情報]に置換）
        if (keywordObj.action === '添削対象外') {
          modifiedText = modifiedText.replace(regex, `[${keywordObj.keyword}]`);
        }
      }
    }
    
    return {
      text: modifiedText,
      containsRestricted,
      actions: detectedKeywords,
      success: true,
      error_message: null
    };
  } catch (error: any) {
    console.error('キーワード処理例外:', error);
    // エラーがあっても元のテキストは返す
    return { 
      text, 
      containsRestricted: false, 
      actions: {},
      success: false,
      error_message: error?.message || '予期せぬエラーが発生しました'
    };
  }
}