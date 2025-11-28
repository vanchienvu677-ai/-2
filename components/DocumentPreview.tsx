
import React from 'react';

interface DocumentPreviewProps {
  fileUrl: string | null;
  fileType: string;
  fileName?: string;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({ fileUrl, fileType, fileName }) => {
  if (!fileUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400 border-r border-slate-200">
        <p>请选择或上传文件以预览</p>
      </div>
    );
  }

  const isPdf = fileType === 'application/pdf' || fileName?.toLowerCase().endsWith('.pdf');

  // Handle PDF
  if (isPdf) {
    return (
      <div className="w-full h-full bg-slate-200 flex flex-col">
        <embed 
            key={fileUrl} // Add key to force re-render on file change
            src={`${fileUrl}#toolbar=0&navpanes=0`}
            type="application/pdf"
            className="w-full h-full flex-grow"
        />
      </div>
    );
  }

  // Handle Images
  return (
    <div className="w-full h-full bg-slate-800 flex items-center justify-center overflow-auto p-4">
      <img 
        src={fileUrl} 
        alt="Preview" 
        className="max-w-full max-h-full object-contain shadow-lg"
      />
    </div>
  );
};
