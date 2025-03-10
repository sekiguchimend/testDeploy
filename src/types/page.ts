/**
 * デザイン情報の型定義
 */
export interface DesignInfo {
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