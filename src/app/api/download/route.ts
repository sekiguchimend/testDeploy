import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// サポートされる変換タイプを定義
export type ConversionType = 'pdf' | 'docx' | 'html' | 'md';

// ファイル情報の型定義
interface FileInfo {
  originalText: string;
  fileName: string;
  filePath: string;
  fileType: string;
}

// 変換可能な形式かどうかをチェックする関数
function isValidConversionType(type: string): type is ConversionType {
  const validTypes: ConversionType[] = ['pdf', 'docx', 'html', 'md'];
  return validTypes.includes(type as ConversionType);
}

// 一時ディレクトリパス
const TEMP_DIR = path.join(os.tmpdir(), 'file-processor');

// ファイル変換関数（仮の実装）
async function updateFileWithReviewedText(
  fileContents: string, 
  fileInfo: FileInfo, 
  convertTo: ConversionType
): Promise<string> {
  // 一時的な変換処理の実装
  const tempOutputDir = path.join(TEMP_DIR, 'converted');
  
  // ディレクトリが存在しない場合は作成
  await fs.mkdir(tempOutputDir, { recursive: true });

  // 新しいファイル名を生成
  const baseFileName = path.basename(fileInfo.fileName, path.extname(fileInfo.fileName));
  const newFileName = `${baseFileName}_converted.${convertTo}`;
  const newFilePath = path.join(tempOutputDir, newFileName);

  // 簡単な変換処理（実際の変換ロジックに置き換える必要があります）
  switch (convertTo) {
    case 'pdf':
      // PDFへの変換ロジック（実際の実装が必要）
      await fs.writeFile(newFilePath, fileContents);
      break;
    case 'docx':
      // DOCXへの変換ロジック（実際の実装が必要）
      await fs.writeFile(newFilePath, fileContents);
      break;
    case 'html':
      // HTMLへの変換ロジック（実際の実装が必要）
      await fs.writeFile(newFilePath, `<html><body>${fileContents}</body></html>`);
      break;
    case 'md':
      // Markdownへの変換ロジック（実際の実装が必要）
      await fs.writeFile(newFilePath, fileContents);
      break;
    default:
      throw new Error(`サポートされていない変換形式: ${convertTo}`);
  }

  return newFilePath;
}

export async function GET(request: Request) {
  try {
    // URLパラメータの解析
    const { searchParams } = new URL(request.url);
    const file = searchParams.get('file');
    const convertTo = searchParams.get('convertTo');

    // ファイルパラメータのバリデーション
    if (!file) {
      return NextResponse.json({ error: 'ファイルパラメータが必要です' }, { status: 400 });
    }

    // 変換形式のバリデーション
    if (convertTo && !isValidConversionType(convertTo)) {
      return NextResponse.json({ 
        error: `サポートされていない変換形式: ${convertTo}` 
      }, { status: 400 });
    }

    // セキュリティ対策: ファイルパスを検証
    const baseName = path.basename(file);
    const filePath = path.join(TEMP_DIR, baseName);

    // ファイルの存在確認
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 404 });
    }

    // ファイルの内容を読み込む
    const fileContents = await fs.readFile(filePath, 'utf-8');

    // 元のファイルの拡張子を特定
    const fileExtension = path.extname(filePath).toLowerCase().substring(1);

    // デフォルトのファイルパスと名前
    let downloadFilePath = filePath;
    let downloadFileName = baseName;

    // 変換が必要な場合
    if (convertTo && convertTo !== fileExtension) {
      try {
        // ファイル情報オブジェクトの作成
        const fileInfo = {
          originalText: fileContents,
          fileName: path.basename(filePath),
          filePath: filePath,
          fileType: `.${fileExtension}`
        };

        // 変換処理
        const convertedFilePath = await updateFileWithReviewedText(
          fileContents, 
          fileInfo, 
          convertTo as ConversionType
        );

        downloadFilePath = convertedFilePath;
        downloadFileName = path.basename(convertedFilePath);
      } catch (convertError) {
        console.error('形式変換エラー:', convertError);
        return NextResponse.json({ error: 'ファイル形式の変換に失敗しました' }, { status: 500 });
      }
    }

    // 最終的なファイル拡張子を特定
    const finalFileExtension = path.extname(downloadFilePath).toLowerCase().substring(1);

    // Content-Typeの設定
    const contentTypeMap: Record<string, string> = {
      'pdf': 'application/pdf',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'html': 'text/html; charset=utf-8',
      'md': 'text/markdown; charset=utf-8',
      'markdown': 'text/markdown; charset=utf-8'
    };
    const contentType = contentTypeMap[finalFileExtension] || 'text/plain; charset=utf-8';

    // ファイルを読み込んでバッファとして返す
    const fileBuffer = await fs.readFile(downloadFilePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(downloadFileName)}"`
      }
    });

  } catch (error) {
    console.error('ダウンロードエラー:', error);
    return NextResponse.json({ error: 'ファイルのダウンロード中にエラーが発生しました' }, { status: 500 });
  }
}