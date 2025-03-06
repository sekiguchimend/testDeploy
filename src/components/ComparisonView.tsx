import React, { useState, useEffect, JSX } from 'react';
// import * as diff from 'diff';
const diff = require('diff')
import { convertCorrectedDocumentToFile, downloadBlob } from './documentConverter';

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
    properties: { [key: string]: string };
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
/**
 * 職務経歴書や履歴書の構造を高精度に分析し、適切なHTML要素タイプを判定する関数
 * より詳細なパターンマッチングとコンテキスト分析を行う
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
 * 孤立したリスト項目や、連続する見出しなどを調整する
 */
export const analyzeDocumentStructure = (lines: string[]): ('h1' | 'h2' | 'h3' | 'p' | 'li' | 'blockquote')[] => {
  // 各行の初期要素タイプを判定
  const initialTypes = lines.map((line, index) => determineElementType(line, index, lines));
  
  // 最適化されたタイプを格納する配列
  const optimizedTypes = [...initialTypes];
  
  // 文書構造の最適化ルールを適用
  for (let i = 0; i < lines.length; i++) {
    // 1. 連続する見出しの調整（同じレベルの見出しが連続する場合、2つ目以降を段落に変更）
    if (i > 0 && 
        (optimizedTypes[i] === 'h1' && optimizedTypes[i-1] === 'h1') ||
        (optimizedTypes[i] === 'h2' && optimizedTypes[i-1] === 'h2')) {
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
    
    // 4. 日付や期間を含む行を見出しまたは強調テキストとして扱う
    if (optimizedTypes[i] === 'p') {
      const trimmedText = lines[i].trim();
      if (/^\d{4}年\d{1,2}月(\d{1,2}日)?/.test(trimmedText) || 
          /^\d{4}\/\d{1,2}(\/\d{1,2})?/.test(trimmedText) ||
          /^\d{4}\.\d{1,2}(\.\d{1,2})?/.test(trimmedText)) {
        // 日付が含まれているが行が長い場合は段落のまま
        if (trimmedText.length < 40) {
          optimizedTypes[i] = 'h3';
        }
      }
    }
  }
  
  return optimizedTypes;
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
  const activeDesignInfo = propDesignInfo || extractedDesignInfo;

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

      const styleElement = document.createElement('style');
      styleElement.id = 'document-compare-styles';
      styleElement.innerHTML = cssStyles + diffStyles;
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
        // フォールバックスタイルを適用
      }
      // デザイン情報がない場合は差分ハイライトのみ追加
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
      styleElement.innerHTML = diffStyles;
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
      compareDocumentsHighAccuracy(originals, correcteds);
    }
  }, [originalText, extractedText]);
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

  // 高精度な段落比較を行う関数
  const compareDocumentsHighAccuracy = (
    originals: string[], 
    correcteds: string[]
  ) => {
    // originalElementsとcorrectedElementsを関数内で生成
    const originalElements = parseTextToElements(originals.join('\n'));
    const correctedElements = parseTextToElements(correcteds.join('\n'));
    
    const similarityMatrix: Array<{origIdx: number; corrIdx: number; similarity: number}> = [];
    
    for (let i = 0; i < originals.length; i++) {
      for (let j = 0; j < correcteds.length; j++) {
        const similarity = calculateSimilarity(originals[i], correcteds[j]);
        similarityMatrix.push({ origIdx: i, corrIdx: j, similarity });
      }
    }
    
    similarityMatrix.sort((a, b) => b.similarity - a.similarity);
    
    const origMatched = new Set<number>();
    const corrMatched = new Set<number>();
    const matches: Array<{origIdx: number; corrIdx: number; similarity: number}> = [];
    
    for (const match of similarityMatrix) {
      if (match.similarity < 0.6) continue;
      
      if (!origMatched.has(match.origIdx) && !corrMatched.has(match.corrIdx)) {
        matches.push(match);
        origMatched.add(match.origIdx);
        corrMatched.add(match.corrIdx);
      }
    }
    
    const origResult: ParagraphWithDiff[] = originalElements.map((element, idx) => ({
      text: element.text,
      diffParts: [{ text: element.text, type: 'removed' }],
      matchedWith: undefined,
      elementType: element.elementType
    }));
    
    const corrResult: ParagraphWithDiff[] = correctedElements.map((element, idx) => ({
      text: element.text,
      diffParts: [{ text: element.text, type: 'added' }],
      matchedWith: undefined,
      elementType: element.elementType
    }));
    
    for (const match of matches) {
      const origText = originals[match.origIdx];
      const corrText = correcteds[match.corrIdx];
      
      const origTokens = tokenize(origText);
      const corrTokens = tokenize(corrText);
      
      
      const origDiffParts: DiffPart[] = [];
      const corrDiffParts: DiffPart[] = [];
      
     // diff.jsの型定義を追加
interface DiffResult<T> {
  value: T[];
  added?: boolean;
  removed?: boolean;
}

// compareDocumentsHighAccuracy関数内で型を明示
const tokenDiffs: DiffResult<string>[] = diff.diffArrays(origTokens, corrTokens);

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
      
      origResult[match.origIdx].diffParts = origDiffParts;
      corrResult[match.corrIdx].diffParts = corrDiffParts;
      
      origResult[match.origIdx].matchedWith = match.corrIdx;
      corrResult[match.corrIdx].matchedWith = match.origIdx;
      
      corrResult[match.corrIdx].elementType = origResult[match.origIdx].elementType;
    }
    
    setOriginalParagraphs(origResult);
    setCorrectedParagraphs(corrResult);
  };
  
  // useEffectの呼び出し部分も修正
  useEffect(() => {
    if (originalText && extractedText) {
      const originals = originalText.split('\n').filter(p => p.trim() !== '');
      const correcteds = extractedText.split('\n').filter(p => p.trim() !== '');
      
      compareDocumentsHighAccuracy(originals, correcteds);
    }
  }, [originalText, extractedText]);
  // スタイルを決定する関数
  const getElementClassAndStyle = (paragraph: ParagraphWithDiff) => {
    if (!activeDesignInfo?.styles || !applyCss) return { className: '', style: {} };

    let className = '';
    let style = {};
    
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
    const { className, style } = getElementClassAndStyle(paragraph);
    const movedClass = isParagraphMoved(paragraph, isOriginal) ? 'paragraph-moved' : '';
    const diffContent = renderDiffParts(paragraph.diffParts);
    
    // クラス名を定義（スタイル適用とHTMLクラス名の両方）
    const combinedClassName = `${className} ${movedClass}`.trim();
    
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
  const handleDownloadDocument = async (format: 'pdf' | 'docx' | 'txt' | 'html' | 'markdown') => {
    try {
      // 添削後のコンテンツを含む要素を取得
      const correctedDocumentElement = document.querySelector('.corrected-document .content');
      
      if (!correctedDocumentElement) {
        throw new Error('ドキュメントコンテンツが見つかりません');
      }

      // ファイル名を生成
      const fileName = `添削済み職務経歴書_${new Date().toISOString().split('T')[0]}`;

      // ドキュメントを変換
      const blob = await convertCorrectedDocumentToFile(
        correctedDocumentElement as HTMLElement, 
        { 
          format, 
          fileName,
          designInfo: activeDesignInfo // デザイン情報を渡す
        }
      );

      // ダウンロード
      downloadBlob(blob, `${fileName}.${format}`);

    } catch (error) {
      console.error('ダウンロード中にエラーが発生しました:', error);
      alert('ダウンロードに失敗しました。');
    }
  };
  // リスト項目を適切にグループ化
  const renderParagraphsWithListGrouping = (paragraphs: ParagraphWithDiff[], isOriginal: boolean) => {
    const result: JSX.Element[] = [];
    let currentListItems: ParagraphWithDiff[] = [];
    
    // 段落を順に処理し、リスト項目は<ul>でグループ化
    paragraphs.forEach((paragraph, idx) => {
      if (paragraph.elementType === 'li') {
        currentListItems.push(paragraph);
      } else {
        // リスト項目が溜まっていれば、<ul>でまとめる
        if (currentListItems.length > 0) {
          const { style } = getElementClassAndStyle(currentListItems[0]);
          result.push(
            <ul key={`${isOriginal ? 'original' : 'corrected'}-list-${result.length}`} style={style}>
              {currentListItems.map((item, itemIdx) => 
                renderParagraphWithAppropriateTag(item, idx - currentListItems.length + itemIdx, isOriginal)
              )}
            </ul>
          );
          currentListItems = [];
        }
        
        // 通常の段落を追加
        result.push(renderParagraphWithAppropriateTag(paragraph, idx, isOriginal));
      }
    });
    
    // 最後のリスト項目があれば追加
    if (currentListItems.length > 0) {
      const { style } = getElementClassAndStyle(currentListItems[0]);
      result.push(
        <ul key={`${isOriginal ? 'original' : 'corrected'}-list-${result.length}`} style={style}>
          {currentListItems.map((item, itemIdx) => 
            renderParagraphWithAppropriateTag(item, paragraphs.length - currentListItems.length + itemIdx, isOriginal)
          )}
        </ul>
      );
    }
    
    return result;
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
          <div className="content">
            {renderParagraphsWithListGrouping(originalParagraphs, true)}
          </div>
        </div>

        <div className="corrected-document border p-4 rounded">
          <h3 className="text-lg font-bold mb-3">添削後</h3>
          <div className="content">
            {renderParagraphsWithListGrouping(correctedParagraphs, false)}
          </div>
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
      <div className="flex flex-wrap gap-2">
      <button
    onClick={() => handleDownloadDocument('pdf')}
    className="bg-primary text-white px-3 py-2 rounded-lg transition-all 
               hover:bg-primary/90 active:scale-95 flex items-center 
               justify-center gap-2 text-sm font-medium"
  >
    PDF
  </button>
  <button
    onClick={() => handleDownloadDocument('docx')}
    className="bg-secondary text-gray-800 px-3 py-2 rounded-lg transition-all 
               hover:bg-secondary/90 active:scale-95 flex items-center 
               justify-center gap-2 text-sm font-medium"
  >
    Word
  </button>
  <button
    onClick={() => handleDownloadDocument('txt')}
    className="bg-gray-100 text-gray-800 px-3 py-2 rounded-lg transition-all 
               hover:bg-gray-200 active:scale-95 flex items-center 
               justify-center gap-2 text-sm font-medium"
  >
    テキスト
  </button>
  <button
    onClick={() => handleDownloadDocument('html')}
    className="bg-gray-100 text-gray-800 px-3 py-2 rounded-lg transition-all 
               hover:bg-gray-200 active:scale-95 flex items-center 
               justify-center gap-2 text-sm font-medium"
  >
    HTML
  </button>
  <button
    onClick={() => handleDownloadDocument('markdown')}
    className="bg-gray-100 text-gray-800 px-3 py-2 rounded-lg transition-all 
               hover:bg-gray-200 active:scale-95 flex items-center 
               justify-center gap-2 text-sm font-medium"
  >
    Markdown
  </button>
        </div>
    </div>
  );
};

export default ComparisonView;