import { useEffect, useState } from 'react';

interface WordFileViewerProps {
  fileUrl: string;  // OneDriveで公開したファイルのURL
}

const FileViewer: React.FC<WordFileViewerProps> = ({ fileUrl }) => {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (fileUrl) {
      // 公開URLをエンコード
      const encodedFileUrl = encodeURIComponent(fileUrl);  
      // Office365 Embed API用のURLを構築
      const officeEmbedUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodedFileUrl}`;
      setEmbedUrl(officeEmbedUrl);  // 埋め込み用URLを設定
    }
  }, [fileUrl]);

  if (!embedUrl) return <div>読み込み中...</div>;

  return (
    <div className="w-full h-full min-h-[500px]">
      {/* iframeでWordファイルを表示 */}
      <iframe
        src={embedUrl}
        width="100%"
        height="600px"
        frameBorder="0"
        title="Word Document Viewer"
      />
    </div>
  );
};

export default FileViewer;
