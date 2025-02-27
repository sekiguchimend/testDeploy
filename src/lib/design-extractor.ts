import { exec, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 一時ファイル保存用のディレクトリパス
const TEMP_DIR = path.join(os.tmpdir(), 'file-processor');

// 抽出されたデザイン情報のインターフェース
interface DesignInfo {
  fonts: string[];
  styles: {
    [key: string]: any;
  };
  layout: {
    pageCount: number;
    pageSize?: {
      width: number;
      height: number;
    };
    margins?: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  };
  colors: string[];
  images?: {
    count: number;
    locations: string[];
  };
}

/**
 * LibreOfficeを使ってドキュメント情報を抽出
 * Word文書（.docx）などのOffice形式に適用
 */
export async function extractDesignWithLibreOffice(filePath: string): Promise<DesignInfo> {
  try {
    // 出力ディレクトリを作成
    const outputDir = path.join(TEMP_DIR, `lo_extract_${path.basename(filePath, path.extname(filePath))}`);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // LibreOfficeを使用してメタデータを抽出するPythonスクリプトを一時ファイルに保存
    const pythonScriptPath = path.join(TEMP_DIR, 'extract_metadata.py');
    const pythonScript = `
import uno
import sys
import json
from com.sun.star.connection import NoConnectException

# LibreOfficeへの接続パラメータ
url = "uno:socket,host=localhost,port=2002;urp;StarOffice.ComponentContext"
input_file = sys.argv[1]
output_file = sys.argv[2]

try:
    # LibreOfficeに接続
    local_context = uno.getComponentContext()
    resolver = local_context.ServiceManager.createInstanceWithContext(
        "com.sun.star.bridge.UnoUrlResolver", local_context)
    context = resolver.resolve(url)
    desktop = context.ServiceManager.createInstanceWithContext(
        "com.sun.star.frame.Desktop", context)
    
    # ドキュメントを開く
    document = desktop.loadComponentFromURL(
        uno.systemPathToFileUrl(input_file), "_blank", 0, ())
    
    # ドキュメント情報を抽出
    result = {
        "fonts": [],
        "styles": {},
        "layout": {
            "pageCount": 0,
            "pageSize": {"width": 0, "height": 0},
            "margins": {"top": 0, "right": 0, "bottom": 0, "left": 0}
        },
        "colors": []
    }
    
    # フォント情報の抽出
    if document.supportsService("com.sun.star.text.TextDocument"):
        # テキストドキュメントの場合
        enum = document.Text.createEnumeration()
        fonts = set()
        
        while enum.hasMoreElements():
            para = enum.nextElement()
            if para:
                paraEnum = para.createEnumeration()
                while paraEnum.hasMoreElements():
                    textPortion = paraEnum.nextElement()
                    if hasattr(textPortion, "CharFontName"):
                        fonts.add(textPortion.CharFontName)
        
        result["fonts"] = list(fonts)
        
        # ページレイアウト情報
        if document.supportsService("com.sun.star.text.TextDocument"):
            cursor = document.Text.createTextCursor()
            pages = document.getPageCount()
            result["layout"]["pageCount"] = pages
            
            # ページサイズを取得
            pageStyles = document.StyleFamilies.getByName("PageStyles")
            defaultStyle = pageStyles.getByName("Standard")
            result["layout"]["pageSize"]["width"] = defaultStyle.Width
            result["layout"]["pageSize"]["height"] = defaultStyle.Height
            
            # マージン情報
            result["layout"]["margins"]["top"] = defaultStyle.TopMargin
            result["layout"]["margins"]["right"] = defaultStyle.RightMargin
            result["layout"]["margins"]["bottom"] = defaultStyle.BottomMargin
            result["layout"]["margins"]["left"] = defaultStyle.LeftMargin
    
    # スタイル情報
    styleFamilies = document.StyleFamilies
    for i in range(styleFamilies.count):
        familyName = styleFamilies.getElementNames()[i]
        family = styleFamilies.getByName(familyName)
        styles = {}
        
        for j in range(family.count):
            try:
                styleName = family.getElementNames()[j]
                style = family.getByName(styleName)
                
                # 各スタイルのプロパティを取得
                styleProperties = {}
                for prop in dir(style):
                    if not prop.startswith("__") and prop != "PropertyValues":
                        try:
                            value = getattr(style, prop)
                            if isinstance(value, (str, int, float, bool)):
                                styleProperties[prop] = value
                        except:
                            pass
                
                styles[styleName] = styleProperties
            except:
                pass
        
        result["styles"][familyName] = styles
    
    # 結果をJSONファイルに保存
    with open(output_file, 'w') as f:
        json.dump(result, f, indent=2)
    
    # ドキュメントを閉じる
    document.close(True)
    
except NoConnectException:
    print("LibreOfficeをバックグラウンドで起動してください")
    sys.exit(1)
except Exception as e:
    print(f"エラー: {str(e)}")
    sys.exit(1)

sys.exit(0)
    `;
    
    fs.writeFileSync(pythonScriptPath, pythonScript);
    
    // LibreOfficeをバックグラウンドで起動
    await execAsync('soffice --headless --accept="socket,host=localhost,port=2002;urp;" --nofirststartwizard');
    
    // 数秒待機してLibreOfficeの起動を確認
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Pythonスクリプトを実行してメタデータを抽出
    const outputFilePath = path.join(outputDir, 'metadata.json');
    await execAsync(`python ${pythonScriptPath} "${filePath}" "${outputFilePath}"`);
    
    // 結果を読み取る
    const jsonData = fs.readFileSync(outputFilePath, 'utf-8');
    const designInfo = JSON.parse(jsonData) as DesignInfo;
    
    // LibreOfficeのプロセスを終了
    await execAsync('killall soffice.bin || killall soffice || echo "No LibreOffice process found"');
    
    return designInfo;
  } catch (error) {
    console.error('LibreOfficeでの抽出中にエラーが発生しました:', error);
    throw error;
  }
}

/**
 * Apache PDFBoxを使ってPDFのデザイン情報を抽出
 */
export async function extractDesignWithPDFBox(filePath: string): Promise<DesignInfo> {
  try {
    // PDFBoxのJARファイルパス（インストールされていることを前提）
    // 実際の環境に合わせてパスを調整する必要があります
    const pdfboxPath = '/usr/local/lib/pdfbox-app-2.0.27.jar';
    
    // 出力ディレクトリを作成
    const outputDir = path.join(TEMP_DIR, `pdfbox_extract_${path.basename(filePath, '.pdf')}`);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // フォント情報を抽出
    const fontOutputPath = path.join(outputDir, 'fonts.txt');
    await execAsync(`java -jar ${pdfboxPath} ExtractFontInfo "${filePath}" > "${fontOutputPath}"`);
    
    // 色情報を抽出（カスタムJavaクラスが必要）
    const colorOutputPath = path.join(outputDir, 'colors.txt');
    await execAsync(`java -jar ${pdfboxPath} ExtractColors "${filePath}" > "${colorOutputPath}"`);
    
    // ページ情報を抽出
    const metadataOutputPath = path.join(outputDir, 'metadata.txt');
    await execAsync(`java -jar ${pdfboxPath} PDFDebugger "${filePath}" > "${metadataOutputPath}"`);
    
    // 画像を抽出
    const imagesDir = path.join(outputDir, 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    await execAsync(`java -jar ${pdfboxPath} ExtractImages -i "${filePath}" -o "${imagesDir}"`);
    
    // 抽出したデータを解析
    const fontData = fs.readFileSync(fontOutputPath, 'utf-8');
    const metadataData = fs.readFileSync(metadataOutputPath, 'utf-8');
    
    // フォント情報を解析
    const fonts: string[] = [];
    const fontLines = fontData.split('\n');
    for (const line of fontLines) {
      if (line.includes('Font:')) {
        const fontName = line.split('Font:')[1].trim();
        if (!fonts.includes(fontName)) {
          fonts.push(fontName);
        }
      }
    }
    
    // ページ数、サイズなどのメタデータを解析
    let pageCount = 0;
    const pageSizeRegex = /Page\s+size:\s+(\d+(\.\d+)?)\s*x\s*(\d+(\.\d+)?)/;
    const pageSizeMatch = metadataData.match(pageSizeRegex);
    
    let pageWidth = 0;
    let pageHeight = 0;
    
    if (pageSizeMatch) {
      pageWidth = parseFloat(pageSizeMatch[1]);
      pageHeight = parseFloat(pageSizeMatch[3]);
    }
    
    const pageCountRegex = /Pages:\s+(\d+)/;
    const pageCountMatch = metadataData.match(pageCountRegex);
    
    if (pageCountMatch) {
      pageCount = parseInt(pageCountMatch[1], 10);
    }
    
    // 画像の数をカウント
    const imageFiles = fs.readdirSync(imagesDir).filter(file => 
      file.endsWith('.jpg') || file.endsWith('.png') || file.endsWith('.jpeg')
    );
    
    // 結果を構築
    const designInfo: DesignInfo = {
      fonts,
      styles: {}, // PDFBoxでは詳細なスタイル情報は取得しにくい
      layout: {
        pageCount,
        pageSize: {
          width: pageWidth,
          height: pageHeight
        },
        margins: {
          top: 0, // PDFでは正確なマージン情報を取得するのは難しい
          right: 0,
          bottom: 0,
          left: 0
        }
      },
      colors: [], // 抽出された色情報を解析して追加する必要がある
      images: {
        count: imageFiles.length,
        locations: imageFiles.map(file => path.join(imagesDir, file))
      }
    };
    
    return designInfo;
  } catch (error) {
    console.error('PDFBoxでの抽出中にエラーが発生しました:', error);
    throw error;
  }
}

/**
 * ファイルの種類に応じて適切なツールでデザイン情報を抽出
 */
export async function extractDesignInfo(filePath: string): Promise<DesignInfo> {
  const fileExt = path.extname(filePath).toLowerCase();
  
  switch (fileExt) {
    case '.pdf':
      return extractDesignWithPDFBox(filePath);
    case '.docx':
    case '.doc':
    case '.odt':
    case '.rtf':
      return extractDesignWithLibreOffice(filePath);
    default:
      throw new Error(`サポートされていないファイル形式です: ${fileExt}`);
  }
}