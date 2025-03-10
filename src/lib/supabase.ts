import { createClient } from '@supabase/supabase-js';

// 環境変数からSupabase設定を取得
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// サーバーサイドでの使用かどうかを判定（Nextjs限定）
const isServer = typeof window === 'undefined';

// 匿名キーを使用してSupabaseクライアントを作成
// 認証不要でアクセス可能にする
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: !isServer,  // サーバーサイドではセッション永続化を無効化
    autoRefreshToken: !isServer // サーバーサイドではトークン自動更新を無効化
  }
});

// デバッグ情報（開発環境のみ）
if (process.env.NODE_ENV !== 'production' && isServer) {
  console.log('Supabase client initialized with:');
  console.log('- URL:', supabaseUrl ? 'Set' : 'Not set');
  console.log('- Key type:', supabaseAnonKey ? 'Anonymous key' : 'Not set');
}

export default supabase;