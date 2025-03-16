import React, { useState, useEffect, JSX } from 'react';
import defaultDesignInfo from '../lib/defaultDesignInfo';  // パスは実際の場所に合わせて調整

const diff = require('diff');

interface DesignInfo {
  fonts: string[];
  layout: {
    pageCount: number;
    margins: {
      top: string;
      right: string;
      bottom: string;
      left: string;
    };
  };
  styles: {
    [key: string]: {
      fontSize: string;
      fontFamily?: string;
      fontWeight?: string;
      color?: string;
      lineHeight?: string;
      textAlign?: string;
    };
  };
  cssRules: Array<{
    selector: string;
    properties: { [key: string]: string | undefined;};
  }>;
}

interface ComparisonViewProps {
  originalText: string;
  correctedText: string; // JSONテキストでも通常のテキストでも受け付ける
  designInfo?: DesignInfo; // 別途designInfoが提供される場合
  jsonResponse?: string; // 元のJSON文字列全体（オプション）
}

interface DiffPart {
  text: string;
  type: 'added' | 'removed' | 'unchanged';
}

interface ParagraphWithDiff {
  text: string;
  diffParts: DiffPart[];
  matchedWith?: number; // 対応する段落のインデックス
  elementType: 'h1' | 'h2'| 'h3' | 'p' | 'li' | 'blockquote'; // 段落の種類
  specialStyle?: string; // 特別なスタイルを適用するためのフラグ
  position?: 'left' | 'center' | 'right'; // 位置情報
  isHeader?: boolean; // ヘッダー部分かどうか
  isSection?: boolean; // セクション見出しかどうか
}

/**
 * Gemini APIレスポンスからテキストとデザイン情報を抽出する関数
 */
export function parseGeminiResponse(response: string): {
  correctedText: string;
  designInfo?: DesignInfo;
} {
  try {
    // マークダウンのコードブロックがあるか確認
    const jsonMatch = response.match(/```json\s*({[\s\S]*?})\s*```/) || 
                      response.match(/```\s*({[\s\S]*?})\s*```/) || 
                      response.match(/({[\s\S]*?})/);
                            
    let jsonStr = '';
    
    if (jsonMatch && jsonMatch[1]) {
      // コードブロック内のJSONを抽出
      jsonStr = jsonMatch[1].trim();
      console.log("マークダウンコードブロックからJSONを抽出しました");
    } else {
      // JSONっぽい文字列を探す
      const potentialJsonMatch = response.match(/{[^{]*"correctedText"\s*:/);
      if (potentialJsonMatch) {
        const startIndex = potentialJsonMatch.index || 0;
        // 対応する最後の}を見つける
        let depth = 1;
        let endIndex = startIndex + potentialJsonMatch[0].length;
        while (depth > 0 && endIndex < response.length) {
          if (response[endIndex] === '{') depth++;
          if (response[endIndex] === '}') depth--;
          endIndex++;
        }
        jsonStr = response.slice(startIndex, endIndex).trim();
      }
    }
    
    // JSONとしてパース
    if (jsonStr) {
      const parsedData = JSON.parse(jsonStr);
      
      // correctedTextとdesignInfoを抽出
      if (parsedData && typeof parsedData === 'object') {
        return {
          correctedText: parsedData.correctedText || parsedData.text || "",
          designInfo: parsedData.designInfo || undefined
        };
      }
    }
    
    // 形式が期待と異なる場合
    console.warn("警告: 予期しないレスポンス形式、テキストとして処理します");
    return { 
      correctedText: response,
      designInfo: undefined
    };
  } catch (error) {
    console.error("JSONパースエラー:", error);
    // JSONパースに失敗した場合、そのままテキストとして返す
    return { 
      correctedText: response,
      designInfo: undefined
    };
  }
}

/**
 * テキストの特徴に基づいて適切な要素タイプを判定する
 */
const determineElementType = (text: string, index: number, allLines: string[]): 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'blockquote' => {
  // テキストの前処理
  const trimmedText = text.trim();
  const lowerText = trimmedText.toLowerCase();
  
  // 見出しレベル1の判定 (主要セクション見出し)
  if (
    // 明示的なマークダウン形式
    trimmedText.startsWith('# ') ||
    
    // 職務経歴書の主要セクション見出し (日本語)
    /^(職務経歴書)$/.test(trimmedText) ||
    
    // 英語版の主要セクション見出し
    /^(resume)$/i.test(lowerText) ||
    
    // すべて大文字で短い (30文字未満) テキスト
    (trimmedText.length < 30 && trimmedText === trimmedText.toUpperCase() && /[A-Z]/.test(trimmedText)) ||
    
    // 独立した短いセンテンスで、周囲に空行がある
    (trimmedText.length < 50 && !trimmedText.includes('.') && 
     ((index > 0 && allLines[index-1].trim() === '') || index === 0) &&
     ((index < allLines.length-1 && allLines[index+1].trim() === '') || index === allLines.length-1))
  ) {
    return 'h1';
  }
  
  // 見出しレベル2の判定 (サブセクション見出し)
  if (
    // 明示的なマークダウン形式
    trimmedText.startsWith('## ') ||
    
    // 会社名や職位など (日本語)
    /^【.+】$/.test(trimmedText) ||
    /^■\s*[^■]+$/.test(trimmedText) ||
    
    // 年月や期間を含む見出し
    /^(20\d{2}年|平成\d{1,2}年|令和\d{1,2}年)/.test(trimmedText) ||
    /^(\d{4}\/\d{1,2}|\d{4}\.\d{1,2})/.test(trimmedText) ||
    
    // 中程度の長さ (80文字未満) で特徴的なパターン
    (trimmedText.length < 80 && (
      // 会社名パターン
      /^株式会社|合同会社|有限会社/.test(trimmedText) ||
      // 役職名で始まる
      /^(シニア|リード|チーフ|プロジェクト|テクニカル|シニア|マネージャー|リーダー|エンジニア|デザイナー)/.test(trimmedText) ||
      // 英語の役職名
      /^(senior|lead|chief|project|technical|manager|leader|engineer|designer)/i.test(lowerText)
    ))
  ) {
    return 'h2';
  }
  
  // 見出しレベル3の判定 (小見出し、プロジェクト名など)
  if (
    // 明示的なマークダウン形式
    trimmedText.startsWith('### ') ||
    
    // プロジェクト名パターン
    /^・\s*[^・]{10,}$/.test(trimmedText) ||
    /^[\d０-９][\.)）]\s+.{5,}$/.test(trimmedText) ||
    
    // 「プロジェクト」「案件」などのキーワードを含む
    /^(プロジェクト|案件|システム開発|業務|担当)/.test(trimmedText) ||
    
    // 中程度の長さで特定の記号で終わる（項目名など）
    (trimmedText.length < 100 && /[:：]$/.test(trimmedText))
  ) {
    return 'h3';
  }
  
  // リスト項目の判定
  if (
    // 明示的なマークダウン形式
    /^[-*•]\s+/.test(trimmedText) ||
    /^[\d０-９]+[\.)）]\s+/.test(trimmedText) ||
    
    // 和文の箇条書きパターン
    /^・\s*/.test(trimmedText) ||
    /^※\s*/.test(trimmedText) ||
    /^→\s*/.test(trimmedText) ||
    
    // インデントされたテキスト (前の行と比較して4文字以上のインデント)
    (index > 0 && text.match(/^\s{4,}/) && !allLines[index-1].match(/^\s{4,}/))
  ) {
    return 'li';
  }
  
  // 引用の判定
  if (
    // 明示的なマークダウン形式
    trimmedText.startsWith('> ') ||
    
    // 他者からのフィードバックや評価を示す表現
    /^「.+」$/.test(trimmedText) ||
    /^『.+』$/.test(trimmedText) ||
    /^".*"$/.test(trimmedText) ||
    
    // 囲み枠のような表現（例：評価コメントなど）
    /^【評価】/.test(trimmedText) ||
    /^<.+>$/.test(trimmedText)
  ) {
    return 'blockquote';
  }
  
  // それ以外は段落として扱う
  return 'p';
};

/**
 * 文書の全体構造を解析し、コンテキストに基づいて要素タイプを最適化する
 * h1要素は添削後のドキュメント内で必ず1つだけ（先頭）になるよう制御する
 */
export const analyzeDocumentStructure = (lines: string[]): ('h1' | 'h2' | 'h3' | 'p' | 'li' | 'blockquote')[] => {
  // 各行の初期要素タイプを判定
  const initialTypes = lines.map((line, index) => determineElementType(line, index, lines));
  
  // 最適化されたタイプを格納する配列
  const optimizedTypes = [...initialTypes];
  
  // h1を最初の1つだけに制限する明示的な処理
  let foundFirstH1 = false;
  for (let i = 0; i < optimizedTypes.length; i++) {
    if (optimizedTypes[i] === 'h1') {
      if (!foundFirstH1) {
        // 最初のh1を見つけた場合はフラグを立てるだけ
        foundFirstH1 = true;
      } else {
        // 2つ目以降のh1は全てh2に変換
        optimizedTypes[i] = 'h2';
      }
    }
  }
  
  // その他の文書構造の最適化ルールを適用
  for (let i = 0; i < lines.length; i++) {
    // 1. 連続する見出しの調整（同じレベルの見出しが連続する場合、2つ目以降を調整）
    if (i > 0 && optimizedTypes[i] === 'h2' && optimizedTypes[i-1] === 'h2') {
      // ただし、非常に短い (20文字未満) テキストは見出しのままにする
      if (lines[i].trim().length >= 20) {
        optimizedTypes[i] = 'p';
      }
    }
    
    // 2. 孤立したリスト項目の調整
    if (optimizedTypes[i] === 'li') {
      const isPreviousItemList = i > 0 && optimizedTypes[i-1] === 'li';
      const isNextItemList = i < lines.length-1 && optimizedTypes[i+1] === 'li';
      
      // リスト項目が孤立していて、前後に別のリスト項目がない場合
      if (!isPreviousItemList && !isNextItemList) {
        // ただし、明示的なリスト記号がある場合はリスト項目のままにする
        if (!/^[-*•・※→]/.test(lines[i].trim()) && !/^[\d０-９]+[\.)）]/.test(lines[i].trim())) {
          optimizedTypes[i] = 'p';
        }
      }
    }
    
    // 3. 見出し後の短いテキストをサブ見出しにする場合がある
    if (i > 0 && optimizedTypes[i] === 'p' && 
        (optimizedTypes[i-1] === 'h1' || optimizedTypes[i-1] === 'h2')) {
      const trimmedText = lines[i].trim();
      // 短く、特徴的なテキストの場合（例：「役割：」「期間：」など）
      if (trimmedText.length < 30 && /[:：]/.test(trimmedText)) {
        optimizedTypes[i] = 'h3';
      }
    }
  }
  
  return optimizedTypes;
};

/**
 * テキストの位置パターンを分析する関数
 * 特に職務経歴書の特定フォーマット対応
 */
export const analyzePositionPatterns = (lines: string[]): ParagraphWithDiff[] => {
  console.log("位置パターン分析開始:", lines.length, "行");
  const result: ParagraphWithDiff[] = [];
  
  // 空の配列のチェック
  if (!lines || lines.length === 0) {
    console.warn("空の行配列が渡されました");
    return [];
  }
  
  // ヘッダー部分の検出（最初の数行を分析）
  let headerEndIndex = -1;
  let foundTitle = false;
  let foundDate = false;
  let foundName = false;
  
  // まずタイトル「職務経歴書」を検索
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (lines[i].trim() === '職務経歴書') {
      result.push({
        text: lines[i],
        diffParts: [{ text: lines[i], type: 'unchanged' }],
        elementType: 'h1',
        specialStyle: 'resume-title',
        position: 'center',
        isHeader: true
      });
      foundTitle = true;
      headerEndIndex = i;
      break;
    }
  }
  
  // タイトルの後に日付と名前を位置ベースで検索
  if (foundTitle) {
    const titleIndex = headerEndIndex;
    
    // 位置固定で検出：タイトルの次の行は日付
    if (titleIndex + 1 < lines.length) {
      const dateLine = lines[titleIndex + 1];
      result.push({
        text: dateLine,
        diffParts: [{ text: dateLine, type: 'unchanged' }],
        elementType: 'p',
        specialStyle: 'resume-date',
        position: 'right',
        isHeader: true
      });
      foundDate = true;
      headerEndIndex = Math.max(headerEndIndex, titleIndex + 1);
    }
    
    // 位置固定で検出：タイトルの次の次の行は名前
    if (titleIndex + 2 < lines.length) {
      const nameLine = lines[titleIndex + 2];
      result.push({
        text: nameLine,
        diffParts: [{ text: nameLine, type: 'unchanged' }],
        elementType: 'p',
        specialStyle: 'resume-name',
        position: 'right',
        isHeader: true
      });
      foundName = true;
      headerEndIndex = Math.max(headerEndIndex, titleIndex + 2);
    }
  }
  
  try {
    // セクション見出しとその他の要素を検出
    const elementTypes = analyzeDocumentStructure(lines);
    
    for (let i = 0; i < lines.length; i++) {
      // すでにヘッダーとして処理した行はスキップ
      if (result.some(item => item.text === lines[i])) {
        continue;
      }
      
      const line = lines[i].trim();
      
      // セクション見出し（■で始まる行）を検出
      if (line.startsWith('■')) {
        result.push({
          text: lines[i],
          diffParts: [{ text: lines[i], type: 'unchanged' }],
          elementType: 'h2',
          specialStyle: 'section-heading',
          isSection: true
        });
        continue;
      }
      
      // 会社概要行（◎で始まる行）を検出
      if (line.startsWith('◎') || (line.match(/^\d{4}年\d{1,2}月\s*[~～]\s*\d{4}年\d{1,2}月/) && line.includes('社員'))) {
        result.push({
          text: lines[i],
          diffParts: [{ text: lines[i], type: 'unchanged' }],
          elementType: 'h3',
          specialStyle: 'company-heading'
        });
        continue;
      }
      
      // 会社情報（【で始まる行）を検出
      if (line.startsWith('【')) {
        result.push({
          text: lines[i],
          diffParts: [{ text: lines[i], type: 'unchanged' }],
          elementType: 'p',
          specialStyle: 'company-info'
        });
        continue;
      }
      
      // その他の要素は通常処理
      // elementTypesの範囲外のインデックスを参照しないようにチェック
      const elementType = i < elementTypes.length ? elementTypes[i] : 'p';
      
      result.push({
        text: lines[i],
        diffParts: [{ text: lines[i], type: 'unchanged' }],
        elementType: elementType
      });
    }
  } catch (error) {
    console.error("解析中にエラーが発生しました:", error);
    // エラーが発生しても、最低限の結果を返す
    if (result.length === 0) {
      // 結果が空の場合は、すべての行を段落として追加
      for (let i = 0; i < lines.length; i++) {
        result.push({
          text: lines[i],
          diffParts: [{ text: lines[i], type: 'unchanged' }],
          elementType: 'p'
        });
      }
    }
  }
  
  console.log("位置パターン分析完了:", result.length, "要素");
  return result;
};
/**
 * テキストの各行を解析し、適切な要素タイプを決定して要素オブジェクトに変換する
 */
export const parseTextToElements = (
  text: string
): Array<{
  text: string;
  elementType: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'blockquote';
}> => {
  // テキストを行に分割し、空行を除外
  const lines = text.split('\n').filter(line => line.trim() !== '');
  
  // 文書構造を分析して最適化された要素タイプを取得
  const elementTypes = analyzeDocumentStructure(lines);
  
  // テキストと要素タイプの組み合わせを作成
  return lines.map((line, index) => ({
    text: line,
    elementType: elementTypes[index]
  }));
};

/**
 * マークダウン記法を解析して適切なHTML表現に変換する
 */
export const parseMarkdownText = (text: string): string => {
  // 各種マークダウン記法を解析して変換するための処理
  let processedText = text;
  
  // 見出しのマークダウン記法を削除
  processedText = processedText.replace(/^# /, '').replace(/^## /, '').replace(/^### /, '');
  
  // リスト項目のマークダウン記法を削除
  processedText = processedText.replace(/^[-*•・] /, '');
  processedText = processedText.replace(/^[\d０-９][\.)）]\s*/, '');
  
  // 引用のマークダウン記法を削除
  processedText = processedText.replace(/^> /, '');
  
  // 強調構文を変換 (** **、* *、_ _など)
  processedText = processedText.replace(/\*\*(.*?)\*\*/g, '$1');
  processedText = processedText.replace(/\*(.*?)\*/g, '$1');
  processedText = processedText.replace(/__(.*?)__/g, '$1');
  processedText = processedText.replace(/_(.*?)_/g, '$1');
  
  return processedText;
};

// レーベンシュタイン距離（編集距離）を計算する関数
const levenshteinDistance = (str1: string, str2: string): number => {
  const m = str1.length;
  const n = str2.length;
  
  // 空の文字列の場合は単純に長さを返す
  if (m === 0) return n;
  if (n === 0) return m;
  
  // 動的計画法で編集距離を計算
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // 削除
        dp[i][j - 1] + 1,      // 挿入
        dp[i - 1][j - 1] + cost // 置換
      );
    }
  }
  
  return dp[m][n];
};

// 文字列の類似度を計算（0.0〜1.0）
const calculateSimilarity = (str1: string, str2: string): number => {
  if (str1 === str2) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0.0;
  
  // 正規化されたレーベンシュタイン距離を使用
  const maxLength = Math.max(str1.length, str2.length);
  const distance = levenshteinDistance(str1, str2);
  
  return 1 - distance / maxLength;
};

// トークン化関数（単語分割を改善）
const tokenize = (text: string): string[] => {
  // 単語、句読点、空白を個別のトークンとして扱う
  return text.match(/\b\w+\b|[^\w\s]|\s+/g) || [];
};

// 修正された高精度な段落比較を行う関数
const compareDocumentsHighAccuracy = (
  originals: string[], 
  correcteds: string[],
  setOriginalParagraphs: React.Dispatch<React.SetStateAction<ParagraphWithDiff[]>>,
  setCorrectedParagraphs: React.Dispatch<React.SetStateAction<ParagraphWithDiff[]>>
) => {
  console.log("比較開始: ", originals.length, "行と", correcteds.length, "行を比較");
  
  // originalElementsとcorrectedElementsを生成
  const originalElements = analyzePositionPatterns(originals);
  const correctedElements = analyzePositionPatterns(correcteds);
  
  console.log("解析結果: ", originalElements.length, "要素と", correctedElements.length, "要素");
  
  const similarityMatrix: Array<{origIdx: number; corrIdx: number; similarity: number}> = [];
  
  // 各段落間の類似度を計算し、類似度マトリックスを作成
  for (let i = 0; i < originalElements.length; i++) {
    for (let j = 0; j < correctedElements.length; j++) {
      const similarity = calculateSimilarity(originalElements[i].text, correctedElements[j].text);
      similarityMatrix.push({ origIdx: i, corrIdx: j, similarity });
    }
  }
  
  // 類似度の高い順にソート
  similarityMatrix.sort((a, b) => b.similarity - a.similarity);
  
  const origMatched = new Set<number>();
  const corrMatched = new Set<number>();
  const matches: Array<{origIdx: number; corrIdx: number; similarity: number}> = [];
  
  // 類似度の高いペアから順にマッチングを行う
  for (const match of similarityMatrix) {
    if (match.similarity < 0.6) continue; // 類似度が低い場合はスキップ
    
    // インデックスが範囲内かチェック
    if (match.origIdx >= originalElements.length || match.corrIdx >= correctedElements.length) {
      console.warn("範囲外のインデックス:", match.origIdx, match.corrIdx);
      continue;
    }
    
    if (!origMatched.has(match.origIdx) && !corrMatched.has(match.corrIdx)) {
      matches.push(match);
      origMatched.add(match.origIdx);
      corrMatched.add(match.corrIdx);
    }
  }
  
  console.log("マッチング数:", matches.length);
  
  // マッチしていない段落は削除または追加として処理
  const origResult: ParagraphWithDiff[] = originalElements.map((element, idx) => ({
    ...element,
    diffParts: [{ text: element.text, type: 'removed' }],
    matchedWith: undefined
  }));
  
  const corrResult: ParagraphWithDiff[] = correctedElements.map((element, idx) => ({
    ...element,
    diffParts: [{ text: element.text, type: 'added' }],
    matchedWith: undefined
  }));
  
  // マッチしたペアについて詳細な差分比較を行う
  for (const match of matches) {
    // 再度インデックスの範囲チェック
    if (match.origIdx >= origResult.length || match.corrIdx >= corrResult.length) {
      console.warn("処理中に範囲外のインデックス:", match.origIdx, match.corrIdx);
      continue;
    }
    
    try {
      const origText = originalElements[match.origIdx].text;
      const corrText = correctedElements[match.corrIdx].text;
      
      const origTokens = tokenize(origText);
      const corrTokens = tokenize(corrText);
      
      interface DiffResult<T> {
        value: T[];
        added?: boolean;
        removed?: boolean;
      }
      
      const tokenDiffs: DiffResult<string>[] = diff.diffArrays(origTokens, corrTokens);
      
      const origDiffParts: DiffPart[] = [];
      const corrDiffParts: DiffPart[] = [];
      
      // トークン単位の差分を部分ごとに処理
      tokenDiffs.forEach((part: DiffResult<string>) => {
        const text = part.value.join('');
        
        if (part.added) {
          corrDiffParts.push({ text, type: 'added' });
        } else if (part.removed) {
          origDiffParts.push({ text, type: 'removed' });
        } else {
          origDiffParts.push({ text, type: 'unchanged' });
          corrDiffParts.push({ text, type: 'unchanged' });
        }
      });
      
      // 差分情報とマッチング情報を設定
      origResult[match.origIdx].diffParts = origDiffParts;
      corrResult[match.corrIdx].diffParts = corrDiffParts;
      
      origResult[match.origIdx].matchedWith = match.corrIdx;
      corrResult[match.corrIdx].matchedWith = match.origIdx;
      
      // スタイル情報の継承(特別スタイルがない場合のみ)
      if (!corrResult[match.corrIdx].specialStyle) {
        corrResult[match.corrIdx].elementType = origResult[match.origIdx].elementType;
      }
    } catch (error) {
      console.error("差分処理中にエラー:", error);
      console.error("問題のあるマッチ:", match);
    }
  }
  
  setOriginalParagraphs(origResult);
  setCorrectedParagraphs(corrResult);
};

// スタイルを決定する関数
const getElementClassAndStyle = (paragraph: ParagraphWithDiff, activeDesignInfo: DesignInfo) => {
  if (!activeDesignInfo?.styles) return { className: '', style: {} };

  let className = '';
  let style = {};
  
  // 特別なスタイルが設定されている場合は優先
  if (paragraph.specialStyle) {
    className = paragraph.specialStyle;
    return { className, style };
  }
  
  // 要素タイプに対応するスタイルを選択
  switch (paragraph.elementType) {
    case 'h1':
      className = 'heading1';
      if (activeDesignInfo.styles['heading1']) {
        style = {
          fontSize: activeDesignInfo.styles['heading1'].fontSize,
          fontFamily: activeDesignInfo.styles['heading1'].fontFamily,
          fontWeight: activeDesignInfo.styles['heading1'].fontWeight,
          color: activeDesignInfo.styles['heading1'].color,
          lineHeight: activeDesignInfo.styles['heading1'].lineHeight,
          textAlign: activeDesignInfo.styles['heading1'].textAlign
        };
      }
      break;
    case 'h2':
      className = 'heading2';
      if (activeDesignInfo.styles['heading2']) {
        style = {
          fontSize: activeDesignInfo.styles['heading2'].fontSize,
          fontFamily: activeDesignInfo.styles['heading2'].fontFamily,
          fontWeight: activeDesignInfo.styles['heading2'].fontWeight,
          color: activeDesignInfo.styles['heading2'].color,
          lineHeight: activeDesignInfo.styles['heading2'].lineHeight,
          textAlign: activeDesignInfo.styles['heading2'].textAlign
        };
      }
      break;
    case 'h3':
      className = 'heading3';
      if (activeDesignInfo.styles['heading3']) {
        style = {
          fontSize: activeDesignInfo.styles['heading3'].fontSize,
          fontFamily: activeDesignInfo.styles['heading3'].fontFamily,
          fontWeight: activeDesignInfo.styles['heading3'].fontWeight,
          color: activeDesignInfo.styles['heading3'].color,
          lineHeight: activeDesignInfo.styles['heading3'].lineHeight,
          textAlign: activeDesignInfo.styles['heading3'].textAlign
        };
      }
      break;
    case 'li':
      className = 'listItem';
      if (activeDesignInfo.styles['listItem']) {
        style = {
          fontSize: activeDesignInfo.styles['listItem'].fontSize,
          fontFamily: activeDesignInfo.styles['listItem'].fontFamily,
          fontWeight: activeDesignInfo.styles['listItem'].fontWeight,
          color: activeDesignInfo.styles['listItem'].color,
          lineHeight: activeDesignInfo.styles['listItem'].lineHeight,
          textAlign: activeDesignInfo.styles['listItem'].textAlign
        };
      } else if (activeDesignInfo.styles['paragraph']) {
        // リスト項目用のスタイルがない場合は段落のスタイルを使用
        style = {
          fontSize: activeDesignInfo.styles['paragraph'].fontSize,
          fontFamily: activeDesignInfo.styles['paragraph'].fontFamily,
          fontWeight: activeDesignInfo.styles['paragraph'].fontWeight,
          color: activeDesignInfo.styles['paragraph'].color,
          lineHeight: activeDesignInfo.styles['paragraph'].lineHeight,
          textAlign: activeDesignInfo.styles['paragraph'].textAlign
        };
      }
      break;
    case 'blockquote':
      className = 'blockquote';
      if (activeDesignInfo.styles['blockquote']) {
        style = {
          fontSize: activeDesignInfo.styles['blockquote'].fontSize,
          fontFamily: activeDesignInfo.styles['blockquote'].fontFamily,
          fontWeight: activeDesignInfo.styles['blockquote'].fontWeight,
          color: activeDesignInfo.styles['blockquote'].color,
          lineHeight: activeDesignInfo.styles['blockquote'].lineHeight,
          textAlign: activeDesignInfo.styles['blockquote'].textAlign
        };
      } else if (activeDesignInfo.styles['paragraph']) {
        // 引用用のスタイルがない場合は段落のスタイルを使用
        style = {
          fontSize: activeDesignInfo.styles['paragraph'].fontSize,
          fontFamily: activeDesignInfo.styles['paragraph'].fontFamily,
          fontWeight: activeDesignInfo.styles['paragraph'].fontWeight,
          color: activeDesignInfo.styles['paragraph'].color,
          lineHeight: activeDesignInfo.styles['paragraph'].lineHeight,
          textAlign: activeDesignInfo.styles['paragraph'].textAlign
        };
      }
      break;
    case 'p':
    default:
      className = 'paragraph';
      if (activeDesignInfo.styles['paragraph']) {
        style = {
          fontSize: activeDesignInfo.styles['paragraph'].fontSize,
          fontFamily: activeDesignInfo.styles['paragraph'].fontFamily,
          fontWeight: activeDesignInfo.styles['paragraph'].fontWeight,
          color: activeDesignInfo.styles['paragraph'].color,
          lineHeight: activeDesignInfo.styles['paragraph'].lineHeight,
          textAlign: activeDesignInfo.styles['paragraph'].textAlign
        };
      }
      break;
  }
  
  return { className, style };
};

// 職務経歴書用CSS定義の修正版
// タイトル、日付、名前以外のすべての要素を左寄せに設定
const resumeStyles = `
  /* ヘッダーレイアウト */
  .header-container {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2em;
    width: 100%;
  }
  
  /* タイトル「職務経歴書」用スタイル */
  .resume-title {
    font-size: 1.5rem;
    font-weight: bold;
    text-align: center;
    border-bottom: 1px solid #000;
    margin: 0 auto;
    padding-bottom: 0.25em;
  }
  
  /* 右側の日付と名前をまとめるコンテナ */
  .header-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  
  /* 日付用スタイル */
  .resume-date {
    text-align: right;
    margin-bottom: 0.5em;
  }
  
  /* 名前用スタイル */
  .resume-name {
    text-align: right;
    font-weight: bold;
  }
  
  /* 本文コンテンツの共通スタイル - すべて左寄せ */
  .content p, .content h2, .content h3, .content li, .content blockquote {
    text-align: left;
    padding-left: 0;
    margin-left: 0;
  }
  
  /* セクション見出し用スタイル（■職務要約、■職務経歴①など） */
  .section-heading {
    font-weight: bold;
    margin: 1.5em 0 0.75em;
    padding-left: 0;
    text-align: left;
  }
  
  /* 会社名/期間行用スタイル */
  .company-heading {
    font-weight: bold;
    margin: 1em 0 0.5em;
    padding-left: 0;
    text-align: left;
  }
  
  /* 会社情報用スタイル */
  .company-info {
    background-color: #f8f9fa;
    padding: 0.5em;
    margin: 0.5em 0;
    border-radius: 4px;
    text-align: left;
  }
  
  /* 業務内容見出し用スタイル */
  .job-title {
    font-weight: bold;
    margin-top: 1em;
    padding-left: 0;
    text-align: left;
  }
  
  /* リスト項目用スタイル - インデントなし、左寄せ */
  .resume-list-item {
    position: relative;
    padding-left: 0;
    text-align: left;
  }
  
  /* リスト記号のスタイル */
  .resume-list-item::before {
    content: '';
    position: static;
  }
  
  /* ulとolのデフォルトスタイルをリセット */
  .content ul, .content ol {
    padding-left: 0;
    margin-left: 0;
    list-style-position: inside;
    text-align: left;
  }
  
  /* リスト内の項目を左寄せに */
  ul li, ol li {
    text-align: left;
    padding-left: 0;
    margin-left: 0;
  }
  
  /* 連続するリスト項目のスタイル */
  ul li + li, ol li + li {
    margin-top: 0.25em;
    margin-left: 0;
  }
  
  /* その他のコンテンツも左寄せに */
  .corrected-document .content, .original-document .content {
    text-align: left;
  }
`;

// リスト項目用のスタイル定義
const additionalListStyles = `
  /* リストコンテナの余白削除 */
  .custom-list-container {
    padding: 0;
    margin: 0;
  }
  
  /* リスト項目の字下げ削除 */
  .custom-list-item {
    padding: 0;
    margin: 0;
    text-indent: 0;
  }
  
  /* リスト内のpタグ調整 */
  .custom-list-item p {
    padding: 0;
    margin: 0;
    text-indent: 0;
  }
  
  /* ブラウザのデフォルトスタイル上書き */
  ul, ol {
    padding-inline-start: 0 !important;
    margin-block-start: 0 !important;
    margin-block-end: 0 !important;
  }
  
  li {
    display: block !important;
    margin-left: 0 !important;
    padding-left: 0 !important;
    text-indent: 0 !important;
  }
`;
const ComparisonView: React.FC<ComparisonViewProps> = ({
  originalText,
  correctedText,
  designInfo: propDesignInfo, // propsから渡されたdesignInfo
  jsonResponse
}) => {
  const [applyCss, setApplyCss] = useState(true);
  const [originalParagraphs, setOriginalParagraphs] = useState<ParagraphWithDiff[]>([]);
  const [correctedParagraphs, setCorrectedParagraphs] = useState<ParagraphWithDiff[]>([]);
  const [extractedText, setExtractedText] = useState<string>("");
  const [extractedDesignInfo, setExtractedDesignInfo] = useState<DesignInfo | undefined>(propDesignInfo);
  const [isJsonResponse, setIsJsonResponse] = useState<boolean>(false);

  // jsonResponseが提供されている場合はそれを優先して処理
  useEffect(() => {
    if (jsonResponse) {
      try {
        const parsed = parseGeminiResponse(jsonResponse);
        setExtractedText(parsed.correctedText);
        if (!propDesignInfo && parsed.designInfo) {
          setExtractedDesignInfo(parsed.designInfo);
        }
        setIsJsonResponse(true);
      } catch (error) {
        console.error("jsonResponseのパースに失敗しました:", error);
        setExtractedText(correctedText);
        setIsJsonResponse(false);
      }
    } else {
      // correctedTextを処理（JSON形式の場合は解析）
      try {
        // JSONとして解析を試みる
        const parsed = parseGeminiResponse(correctedText);
        setExtractedText(parsed.correctedText);
        
        // propDesignInfoが指定されていない場合のみJSONから抽出したdesignInfoを使用
        if (!propDesignInfo && parsed.designInfo) {
          setExtractedDesignInfo(parsed.designInfo);
          setIsJsonResponse(true);
        } else {
          setIsJsonResponse(false);
        }
      } catch (error) {
        // パースエラーの場合は、そのままテキストとして扱う
        console.warn("JSONパースエラー、テキストとして処理します:", error);
        setExtractedText(correctedText);
        setIsJsonResponse(false);
      }
    }
  }, [correctedText, propDesignInfo, jsonResponse]);

  // 実際に使用するデザイン情報
  const activeDesignInfo = propDesignInfo || extractedDesignInfo || defaultDesignInfo;

  // CSSスタイルをヘッドに追加
  useEffect(() => {
    console.log("ComparisonView: designInfo を受け取りました", activeDesignInfo);
    if (activeDesignInfo) {
      console.log("designInfo の内容:", JSON.stringify(activeDesignInfo, null, 2));
    }
    
    if (activeDesignInfo?.cssRules && applyCss) {
      console.log("CSSルール数:", activeDesignInfo.cssRules.length);
      const cssStyles = activeDesignInfo.cssRules.map(rule => 
        `${rule.selector} { ${Object.entries(rule.properties)
          .map(([key, value]) => `${key}: ${value};`)
          .join(' ')} }`
      ).join('\n');

      // 差分ハイライトスタイルを追加
      const diffStyles = `
        .diff-added { background-color: #c8e6c9; padding: 2px 0; }
        .diff-removed { background-color: #ffcdd2; padding: 2px 0; text-decoration: line-through; }
        .paragraph-moved { border-left: 3px solid #bbdefb; padding-left: 8px; }
        
        /* 基本要素のスタイリング */
        .content h1 { margin: 1em 0 0.5em; }
        .content h2 { margin: 0.8em 0 0.4em; }
        .content p { margin: 0.5em 0; }
        .content ul { margin: 0.5em 0; padding-left: 1.5em; }
        .content li { margin: 0.25em 0; }
        .content blockquote { margin: 0.5em 0; padding-left: 1em; border-left: 3px solid #e0e0e0; }
      `;

      // スタイルエレメントを作成し、全スタイルを適用
      const styleElement = document.createElement('style');
      styleElement.id = 'document-compare-styles';
      styleElement.innerHTML = cssStyles + diffStyles + resumeStyles + additionalListStyles;
      document.head.appendChild(styleElement);

      return () => {
        const existingStyle = document.getElementById('document-compare-styles');
        if (existingStyle) {
          document.head.removeChild(existingStyle);
        }
      };
    } else {
      if (!activeDesignInfo || !activeDesignInfo.cssRules || !Array.isArray(activeDesignInfo.cssRules) || activeDesignInfo.cssRules.length === 0) {
        console.warn("有効なデザイン情報がありません:", activeDesignInfo);
      }
      // デザイン情報がない場合は差分ハイライトと職務経歴書用スタイルのみ追加
      const diffStyles = `
        .diff-added { background-color: #c8e6c9; padding: 2px 0; }
        .diff-removed { background-color: #ffcdd2; padding: 2px 0; text-decoration: line-through; }
        .paragraph-moved { border-left: 3px solid #bbdefb; padding-left: 8px; }
        
        /* 基本要素のスタイリング */
        .content h1 { margin: 1em 0 0.5em; font-size: 1.5rem; font-weight: bold; }
        .content h2 { margin: 0.8em 0 0.4em; font-size: 1.3rem; font-weight: bold; }
        .content p { margin: 0.5em 0; }
        .content ul { margin: 0.5em 0; padding-left: 1.5em; }
        .content li { margin: 0.25em 0; }
        .content blockquote { margin: 0.5em 0; padding-left: 1em; border-left: 3px solid #e0e0e0; }
      `;
      
      const styleElement = document.createElement('style');
      styleElement.id = 'document-compare-styles';
      styleElement.innerHTML = diffStyles + resumeStyles + additionalListStyles;
      document.head.appendChild(styleElement);

      return () => {
        const existingStyle = document.getElementById('document-compare-styles');
        if (existingStyle) {
          document.head.removeChild(existingStyle);
        }
      };
    }
  }, [activeDesignInfo, applyCss]);

  // テキストの差分を計算
  useEffect(() => {
    // extractedTextが設定されたときのみ差分計算を実行
    if (originalText && extractedText) {
      const originals = originalText.split('\n').filter(p => p.trim() !== '');
      const correcteds = extractedText.split('\n').filter(p => p.trim() !== '');
      
      // 高精度な段落比較を実行
      compareDocumentsHighAccuracy(originals, correcteds, setOriginalParagraphs, setCorrectedParagraphs);
    }
  }, [originalText, extractedText]);

  // 差分を表示するレンダリング関数
  const renderDiffParts = (diffParts: DiffPart[]) => {
    return diffParts.map((part, idx) => {
      let className = '';
      if (part.type === 'added') {
        className = 'diff-added';
      } else if (part.type === 'removed') {
        className = 'diff-removed';
      }

      return (
        <span key={idx} className={className}>
          {part.text}
        </span>
      );
    });
  };
  // 段落が移動したかどうかを判断
const isParagraphMoved = (paragraph: ParagraphWithDiff, isOriginal: boolean): boolean => {
  if (paragraph.matchedWith === undefined) return false;
  
  // 対応する段落のインデックスと元の位置の差が大きい場合は移動とみなす
  const indexDiff = isOriginal 
    ? paragraph.matchedWith - originalParagraphs.indexOf(paragraph)
    : paragraph.matchedWith - correctedParagraphs.indexOf(paragraph);
  
  return Math.abs(indexDiff) > 1;
};

  // JSON変換情報表示
  const renderExtractionInfo = () => {
    if (!isJsonResponse) return null;

    return (
      <div className="info-box bg-blue-50 p-2 mb-4 rounded text-sm">
        <p>JSON形式のレスポンスから添削テキストを抽出して表示しています。</p>
        {activeDesignInfo && <p>デザイン情報も抽出されスタイルに適用されています。</p>}
      </div>
    );
  };

  // 段落を適切なHTML要素でレンダリングする
  const renderParagraphWithAppropriateTag = (paragraph: ParagraphWithDiff, idx: number, isOriginal: boolean) => {
    const { className, style } = getElementClassAndStyle(paragraph, activeDesignInfo);
    const movedClass = isParagraphMoved(paragraph, isOriginal) ? 'paragraph-moved' : '';
    const diffContent = renderDiffParts(paragraph.diffParts);
    
    // クラス名を定義（スタイル適用とHTMLクラス名の両方）
    const combinedClassName = `${className} ${movedClass}`.trim();
    
    // 特別なスタイルがある場合はそれを優先
    if (paragraph.specialStyle === 'resume-title') {
      return (
        <h1 
          key={`${isOriginal ? 'original' : 'corrected'}-${idx}`}
          className={`${paragraph.specialStyle}`}
        >
          {diffContent}
        </h1>
      );
    }
    
    if (paragraph.specialStyle === 'resume-date' || paragraph.specialStyle === 'resume-name') {
      return (
        <p 
          key={`${isOriginal ? 'original' : 'corrected'}-${idx}`}
          className={`${paragraph.specialStyle}`}
        >
          {diffContent}
        </p>
      );
    }
    
    // 要素タイプに応じて適切なHTML要素を返す
    switch (paragraph.elementType) {
      case 'h1':
        return (
          <h1 
            key={`${isOriginal ? 'original' : 'corrected'}-${idx}`}
            className={combinedClassName}
            style={style}
          >
            {diffContent}
          </h1>
        );
      case 'h2':
        return (
          <h2 
            key={`${isOriginal ? 'original' : 'corrected'}-${idx}`}
            className={combinedClassName}
            style={style}
          >
            {diffContent}
          </h2>
        );
      case 'h3':
        return (
          <h3 
            key={`${isOriginal ? 'original' : 'corrected'}-${idx}`}
            className={combinedClassName}
            style={style}
          >
            {diffContent}
          </h3>
        );
      case 'li':
        return (
          <li 
            key={`${isOriginal ? 'original' : 'corrected'}-${idx}`}
            className={combinedClassName}
            style={style}
          >
            {diffContent}
          </li>
        );
      case 'blockquote':
        return (
          <blockquote 
            key={`${isOriginal ? 'original' : 'corrected'}-${idx}`}
            className={combinedClassName}
            style={style}
          >
            {diffContent}
          </blockquote>
        );
      case 'p':
      default:
        return (
          <p 
            key={`${isOriginal ? 'original' : 'corrected'}-${idx}`}
            className={combinedClassName}
            style={style}
          >
            {diffContent}
          </p>
        );
    }
  };
 
  // リスト項目を適切にグループ化するための修正版関数
  const renderParagraphsWithListGrouping = (paragraphs: ParagraphWithDiff[], isOriginal: boolean) => {
    const result: JSX.Element[] = [];
    let currentListItems: ParagraphWithDiff[] = [];
    let currentListType: string | null = null; // リストタイプを追跡

    // リスト項目のタイプを判定する補助関数（記号に基づく）
    const getListItemType = (text: string): string => {
      const trimmedText = text.trim();
      
      // 数字や序数によるリスト
      if (/^[\d０-９]+[\.)）]\s+/.test(trimmedText)) {
        return 'ordered';
      }
      
      // 記号によるリスト - 記号ごとに分類
      if (/^[-]\s+/.test(trimmedText)) return 'dash';
      if (/^[*]\s+/.test(trimmedText)) return 'asterisk';
      if (/^[•]\s+/.test(trimmedText)) return 'bullet';
      if (/^[・]\s+/.test(trimmedText)) return 'jp-bullet';
      if (/^[※]\s+/.test(trimmedText)) return 'note';
      if (/^[→]\s+/.test(trimmedText)) return 'arrow';
      
      // デフォルトタイプ
      return 'generic';
    };

    // 段落を順に処理し、リスト項目は<ul>でグループ化
    paragraphs.forEach((paragraph, idx) => {
      if (paragraph.elementType === 'li') {
        // リスト項目のタイプを判定
        const itemType = getListItemType(paragraph.text);
        
        // 新しいリストの開始または異なるタイプのリスト項目の場合
        if (currentListItems.length === 0 || currentListType !== itemType) {
          // 以前のリスト項目があれば、先にそれを処理
          if (currentListItems.length > 0) {
            // カスタムクラスを持つdivとして処理（ulの代わり）
            result.push(
              <div 
                key={`${isOriginal ? 'original' : 'corrected'}-list-${result.length}`}
                className="custom-list-container" // 特別なコンテナクラス
              >
                {currentListItems.map((item, itemIdx) => {
                  // 字下げなしでリスト項目をレンダリング
                  return (
                    <div 
                      key={`${isOriginal ? 'original' : 'corrected'}-list-item-${itemIdx}`}
                      className="custom-list-item" // 特別なアイテムクラス
                    >
                      {renderParagraphWithAppropriateTag(item, idx - currentListItems.length + itemIdx, isOriginal)}
                    </div>
                  );
                })}
              </div>
            );
            currentListItems = [];
          }
          
          // 新しいリストタイプを設定
          currentListType = itemType;
        }
        
        // 現在のリスト項目を追加
        currentListItems.push(paragraph);
      } else {
        // リスト項目ではない場合、現在のリスト項目をフラッシュ
        if (currentListItems.length > 0) {
          // カスタムクラスを持つdivとして処理（ulの代わり）
          result.push(
            <div 
              key={`${isOriginal ? 'original' : 'corrected'}-list-${result.length}`}
              className="custom-list-container" // 特別なコンテナクラス
            >
              {currentListItems.map((item, itemIdx) => {
                // 字下げなしでリスト項目をレンダリング
                return (
                  <div 
                    key={`${isOriginal ? 'original' : 'corrected'}-list-item-${itemIdx}`}
                    className="custom-list-item" // 特別なアイテムクラス
                  >
                    {renderParagraphWithAppropriateTag(item, idx - currentListItems.length + itemIdx, isOriginal)}
                  </div>
                );
              })}
            </div>
          );
          currentListItems = [];
          currentListType = null;
        }
        
        // 通常の段落を追加
        result.push(renderParagraphWithAppropriateTag(paragraph, idx, isOriginal));
      }
    });
    
    // 最後のリスト項目があれば追加
    if (currentListItems.length > 0) {
      // カスタムクラスを持つdivとして処理（ulの代わり）
      result.push(
        <div 
          key={`${isOriginal ? 'original' : 'corrected'}-list-${result.length}`}
          className="custom-list-container" // 特別なコンテナクラス
        >
          {currentListItems.map((item, itemIdx) => {
            // 字下げなしでリスト項目をレンダリング
            return (
              <div 
                key={`${isOriginal ? 'original' : 'corrected'}-list-item-${itemIdx}`}
                className="custom-list-item" // 特別なアイテムクラス
              >
                {renderParagraphWithAppropriateTag(item, paragraphs.length - currentListItems.length + itemIdx, isOriginal)}
              </div>
            );
          })}
        </div>
      );
    }
    
    return result;
  };

  // 特別なヘッダーレイアウトを生成
  const renderHeader = (paragraphs: ParagraphWithDiff[], isOriginal: boolean) => {
    // ヘッダー部分の要素を探す
    const titleElement = paragraphs.find(p => p.specialStyle === 'resume-title');
    const dateElement = paragraphs.find(p => p.specialStyle === 'resume-date');
    const nameElement = paragraphs.find(p => p.specialStyle === 'resume-name');
    
    if (!titleElement) return null;
    
    return (
      <div className="header-container">
        {/* タイトル */}
        {renderParagraphWithAppropriateTag(titleElement, 0, isOriginal)}
        
        {/* 右側の要素（日付・名前） */}
        <div className="header-right">
          {dateElement && renderParagraphWithAppropriateTag(dateElement, 1, isOriginal)}
          {nameElement && renderParagraphWithAppropriateTag(nameElement, 2, isOriginal)}
        </div>
      </div>
    );
  };
  // 文書全体のレンダリング
  const renderDocument = (paragraphs: ParagraphWithDiff[], isOriginal: boolean) => {
    // ヘッダー要素と本文要素を分離
    const headerElements = paragraphs.filter(p => p.isHeader);
    const bodyElements = paragraphs.filter(p => !p.isHeader);
    
    // ヘッダーが検出された場合は特別レイアウトを適用
    const hasHeader = headerElements.some(p => p.specialStyle === 'resume-title');
    
    return (
      <div className="content">
        {/* 職務経歴書ヘッダー部分 */}
        {hasHeader && renderHeader(paragraphs, isOriginal)}
        
        {/* 本文部分 */}
        {renderParagraphsWithListGrouping(bodyElements, isOriginal)}
      </div>
    );
  };

  // コンポーネントのメインレンダリング
  return (
    <div className="comparison-view">
      {renderExtractionInfo()}

      {activeDesignInfo && (
        <div className="controls mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={applyCss}
              onChange={(e) => setApplyCss(e.target.checked)}
              className="mr-2"
            />
            元のドキュメントのスタイルを適用
          </label>
        </div>
      )}

      <div className="comparison-container grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="original-document border p-4 rounded">
          <h3 className="text-lg font-bold mb-3">添削前</h3>
          {renderDocument(originalParagraphs, true)}
        </div>

        <div className="corrected-document border p-4 rounded">
          <h3 className="text-lg font-bold mb-3">添削後</h3>
          {renderDocument(correctedParagraphs, false)}
        </div>
      </div>

      <div className="legend mt-4 flex flex-wrap gap-4">
        <div className="flex items-center">
          <span className="inline-block w-4 h-4 bg-red-200 mr-2"></span>
          <span>削除された部分</span>
        </div>
        <div className="flex items-center">
          <span className="inline-block w-4 h-4 bg-green-200 mr-2"></span>
          <span>追加された部分</span>
        </div>
        <div className="flex items-center">
          <span className="inline-block w-4 h-4 border-l-4 border-blue-200 pl-1 mr-2"></span>
          <span>移動された段落</span>
        </div>
      </div>
    </div>
  );
};

export default ComparisonView;