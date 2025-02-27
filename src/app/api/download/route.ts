// app/api/download/route.ts
import { NextRequest, NextResponse } from "next/server";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 一時ディレクトリのパス
const TEMP_DIR = path.join(os.tmpdir(), 'file-processor');

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const fileName = searchParams.get('file');

    if (!fileName) {
      return NextResponse.json(
        { error: "ファイル名が指定されていません" },
        { status: 400 }
      );
    }

    const filePath = path.join(TEMP_DIR, fileName);

    // ファイルの存在確認
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: "ファイルが見つかりません" },
        { status: 404 }
      );
    }

    // ファイルの読み込み
    const fileBuffer = fs.readFileSync(filePath);
    
    // ファイルタイプを決定
    const fileExtension = path.extname(fileName).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (fileExtension === '.pdf') {
      contentType = 'application/pdf';
    } else if (fileExtension === '.docx') {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (fileExtension === '.doc') {
      contentType = 'application/msword';
    }

    // レスポンスの作成
    const response = new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(path.basename(fileName))}"`,
      },
    });

    return response;
  } catch (error) {
    console.error("Error downloading file:", error);
    return NextResponse.json(
      { error: "ファイルのダウンロード中にエラーが発生しました" },
      { status: 500 }
    );
  }
}