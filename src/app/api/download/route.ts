import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Readable } from 'stream';
import { finished } from 'stream/promises';
import { updateFileWithReviewedText } from '@/lib/file-processor'; // パスを適宜調整

// 一時ディレクトリパス
const TEMP_DIR = path.join(os.tmpdir(), 'file-processor');

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const file = searchParams.get('file');
    const convertTo = searchParams.get('convertTo');

    if (!file) {
      return NextResponse.json({ error: 'ファイルパラメータが必要です' }, { status: 400 });
    }

    // セキュリティ対策: ファイルパスを検証（パストラバーサル攻撃などを防ぐ）
    const baseName = path.basename(file);
    
    // 一時ディレクトリからファイルを読み込む
    const filePath = path.join(TEMP_DIR, baseName);
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 404 });
    }

    // 元のファイルの拡張子を特定
    const fileExtension = path.extname(filePath).toLowerCase().substring(1);
    
    // ファイルの内容を読み込む（UTF-8でエンコード）
    const fileContents = fs.readFileSync(filePath, 'utf-8');
    
    // 変換処理
    let downloadFilePath = filePath;
    let downloadFileName = baseName;
    
    // 変換が必要な場合
    if (convertTo && convertTo !== fileExtension) {
      try {
        // 元のファイル名から拡張子を除去
        const fileNameWithoutExt = path.basename(baseName, path.extname(baseName));
        // 新しい拡張子でファイル名を作成
        const newFileName = `${fileNameWithoutExt}_converted.${convertTo}`;
        
        // ダミーのファイル情報オブジェクトを作成
        const fileInfo = {
          originalText: fileContents,
          fileName: path.basename(filePath),
          filePath: filePath,
          fileType: `.${fileExtension}`
        };
        
        // 変換処理（updateFileWithReviewedText関数を利用）
        const convertedFilePath = await updateFileWithReviewedText(
          fileContents, 
          fileInfo, 
          convertTo
        );
        
        downloadFilePath = convertedFilePath;
        downloadFileName = path.basename(convertedFilePath);
      } catch (convertError) {
        console.error('形式変換エラー:', convertError);
        return NextResponse.json({ error: 'ファイル形式の変換に失敗しました' }, { status: 500 });
      }
    }
    
    // ファイルの拡張子を特定
    const finalFileExtension = path.extname(downloadFilePath).toLowerCase().substring(1);
    
    // Content-Typeの設定
    let contentType = 'text/plain; charset=utf-8';
    if (finalFileExtension === 'pdf') {
      contentType = 'application/pdf';
    } else if (finalFileExtension === 'docx') {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (finalFileExtension === 'html') {
      contentType = 'text/html; charset=utf-8';
    } else if (finalFileExtension === 'md' || finalFileExtension === 'markdown') {
      contentType = 'text/markdown; charset=utf-8';
    }
    
    // ファイルをStreamで読み込み、レスポンスとして返す
    const fileStream = fs.createReadStream(downloadFilePath);
    const chunks: Buffer[] = [];
    
    for await (const chunk of fileStream) {
      chunks.push(Buffer.from(chunk));
    }
    
    const buffer = Buffer.concat(chunks);

    // ファイルをダウンロードさせる
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(downloadFileName)}"`,
      },
    });
  } catch (error) {
    console.error('ダウンロードエラー:', error);
    return NextResponse.json({ error: 'ファイルのダウンロード中にエラーが発生しました' }, { status: 500 });
  }
}