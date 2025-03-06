declare module 'html2pdf.js' {
    interface Html2PdfOptions {
      margin?: number | [number, number];
      filename?: string;
      image?: {
        type?: string;
        quality?: number;
      };
      html2canvas?: {
        scale?: number;
        useCORS?: boolean;
      };
      jsPDF?: {
        unit?: string;
        format?: string;
        orientation?: 'portrait' | 'landscape';
      };
      pagebreak?: {
        mode?: 'avoid-all' | 'css' | 'legacy';
      };
    }
  
    interface Html2PdfInstance {
      from(element: string | HTMLElement): Html2PdfChain;
      set(options: Html2PdfOptions): Html2PdfChain;
    }
  
    interface Html2PdfChain {
      outputPdf(type?: 'blob' | 'datauristring' | 'arraybuffer'): Promise<Blob | string | ArrayBuffer>;
      save(callback?: (pdf: string) => void): void;
      output(type?: 'blob' | 'datauristring' | 'arraybuffer'): Promise<Blob | string | ArrayBuffer>;
    }
  
    function html2pdf(): Html2PdfInstance;
  
    export default html2pdf;
  }