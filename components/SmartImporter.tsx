import React, { useState, useRef, useEffect } from 'react';
import { UploadedFile, Equipment } from '../types';
import { scanDocumentStructure, extractEquipmentDetails } from '../services/gemini';
import { DocumentPreview } from './DocumentPreview';
import { Loader2, Upload, FileText, CheckCircle, ChevronRight, AlertCircle, Play, Save } from 'lucide-react';

interface SmartImporterProps {
  onImportComplete: (newEquipments: Equipment[]) => void;
  onFilesChanged: (files: UploadedFile[]) => void; // To persist file blobs if needed
}

type Step = 'upload' | 'scan' | 'verify' | 'extract';

export const SmartImporter: React.FC<SmartImporterProps> = ({ onImportComplete, onFilesChanged }) => {
  const [activeStep, setActiveStep] = useState<Step>('upload');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  
  // Staging area for identified equipments before final extraction
  const [identifiedEquipments, setIdentifiedEquipments] = useState<Equipment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-select first file
  useEffect(() => {
    if (files.length > 0 && !selectedFileId) {
      setSelectedFileId(files[0].id);
    }
  }, [files, selectedFileId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // FIX: Explicitly type 'f' as File to resolve properties 'name', 'type' and allow use in URL.createObjectURL.
      const newFiles: UploadedFile[] = Array.from(e.target.files).map((f: File) => ({
        id: `file-${Date.now()}-${Math.random()}`,
        name: f.name,
        mimeType: f.type,
        data: "", // Will be filled
        previewUrl: URL.createObjectURL(f)
      }));

      // Process base64
      newFiles.forEach((nf, idx) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          setFiles(prev => {
             const updated = [...prev];
             const target = updated.find(x => x.id === nf.id);
             if (target) target.data = base64;
             return updated;
          });
        };
        reader.readAsDataURL(e.target.files![idx]);
      });

      setFiles(prev => {
        const combined = [...prev, ...newFiles];
        onFilesChanged(combined);
        return combined;
      });
    }
  };

  // --- Step 1: Scan Structure ---
  const startStructureScan = async () => {
    setActiveStep('scan');
    setIsProcessing(true);
    setProgress('正在分析文档结构...');
    
    const newIdentified: Equipment[] = [];

    for (const file of files) {
        if (!file.data) continue; // Not ready yet
        try {
            setProgress(`正在扫描文件: ${file.name}...`);
            const results = await scanDocumentStructure(file.data, file.mimeType);
            
            results.forEach(res => {
                newIdentified.push({
                    id: `eq-${Date.now()}-${Math.random()}`,
                    tag: res.tag || "Unknown",
                    name: res.name || "未命名设备",
                    pageRange: res.pageRange || "全文件",
                    sourceFileId: file.id,
                    materials: [],
                    drawings: [file.data], // Store ref to source
                    lastModified: Date.now(),
                    status: 'identified'
                });
            });
        } catch (e) {
            console.error(e);
        }
    }

    setIdentifiedEquipments(newIdentified);
    setIsProcessing(false);
    setActiveStep('verify');
  };

  // --- Step 2: Extract Details ---
  const startDetailExtraction = async () => {
    setActiveStep('extract');
    setIsProcessing(true);
    
    const total = identifiedEquipments.length;
    let completed = 0;

    const updatedList = [...identifiedEquipments];

    for (let i = 0; i < updatedList.length; i++) {
        const eq = updatedList[i];
        const file = files.find(f => f.id === eq.sourceFileId);
        
        if (!file) continue;

        setProgress(`(${completed + 1}/${total}) 正在解析: ${eq.tag} (${eq.pageRange})...`);
        
        // Update UI status
        updatedList[i].status = 'extracting';
        setIdentifiedEquipments([...updatedList]);

        try {
            const details = await extractEquipmentDetails(file.data, file.mimeType, eq.tag, eq.pageRange || "");
            
            // Merge details
            updatedList[i] = {
                ...eq,
                specification: details.specification || eq.specification,
                mainMaterial: details.mainMaterial || eq.mainMaterial,
                designWeight: details.designWeight || eq.designWeight,
                materials: (details.materials || []).map((m: any, idx: number) => ({
                    ...m, 
                    id: `${eq.id}-mat-${idx}`,
                    unitPrice: 0, 
                    totalPrice: 0,
                    category: m.category || 'other'
                })),
                status: 'complete'
            };

        } catch (e) {
            console.error(e);
            updatedList[i].status = 'error';
        }

        completed++;
        setIdentifiedEquipments([...updatedList]);
    }

    setIsProcessing(false);
    onImportComplete(updatedList);
  };

  const currentFile = files.find(f => f.id === selectedFileId);

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col md:flex-row border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
      
      {/* LEFT PANEL: Document Viewer */}
      <div className="w-full md:w-1/2 lg:w-3/5 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col relative h-[50vh] md:h-auto">
        {/* File Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 flex overflow-x-auto">
            {files.map(f => (
                <button
                    key={f.id}
                    onClick={() => setSelectedFileId(f.id)}
                    className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-r border-slate-200 ${selectedFileId === f.id ? 'bg-white text-blue-600 border-b-2 border-b-blue-600' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                    {f.name}
                </button>
            ))}
            {files.length === 0 && <div className="p-2 text-xs text-slate-400">暂无文件预览</div>}
        </div>
        
        {/* Preview Area */}
        <div className="flex-grow overflow-hidden relative bg-slate-100">
             <DocumentPreview 
                fileUrl={currentFile?.previewUrl || null} 
                fileType={currentFile?.mimeType || ''} 
                fileName={currentFile?.name}
             />
             {/* Hint overlay */}
             {activeStep === 'upload' && files.length === 0 && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/90 z-10">
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="cursor-pointer flex flex-col items-center p-8 border-2 border-dashed border-slate-300 rounded-xl hover:bg-white hover:border-blue-400 transition"
                    >
                        <Upload className="w-10 h-10 text-blue-500 mb-3" />
                        <h3 className="text-lg font-semibold text-slate-700">点击上传图纸</h3>
                        <p className="text-sm text-slate-500">支持 PDF, JPG, PNG (可多选)</p>
                    </div>
                 </div>
             )}
        </div>
      </div>

      {/* RIGHT PANEL: Wizard & Data */}
      <div className="w-full md:w-1/2 lg:w-2/5 bg-white flex flex-col h-[50vh] md:h-auto">
        
        {/* Stepper Header */}
        <div className="p-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-800">智能提取向导</h2>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} accept="application/pdf,image/*" />
                {activeStep === 'upload' && (
                    <button onClick={() => fileInputRef.current?.click()} className="text-sm text-blue-600 hover:underline">
                        + 添加更多文件
                    </button>
                )}
            </div>
            
            <div className="flex items-center text-xs font-medium text-slate-500 space-x-2">
                <span className={`px-2 py-1 rounded ${activeStep === 'upload' ? 'bg-blue-100 text-blue-700' : ''}`}>1.上传</span>
                <ChevronRight className="w-3 h-3" />
                <span className={`px-2 py-1 rounded ${activeStep === 'scan' ? 'bg-blue-100 text-blue-700' : ''}`}>2.扫描目录</span>
                <ChevronRight className="w-3 h-3" />
                <span className={`px-2 py-1 rounded ${activeStep === 'verify' ? 'bg-blue-100 text-blue-700' : ''}`}>3.确认</span>
                <ChevronRight className="w-3 h-3" />
                <span className={`px-2 py-1 rounded ${activeStep === 'extract' ? 'bg-blue-100 text-blue-700' : ''}`}>4.解析BOM</span>
            </div>
        </div>

        {/* Wizard Content */}
        <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
            
            {/* Step 1: Upload Status */}
            {activeStep === 'upload' && (
                <div className="space-y-4">
                    {files.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            <p>请先在左侧上传图纸文件。</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                             {files.map(f => (
                                 <div key={f.id} className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 p-2 rounded">
                                     <FileText className="w-4 h-4 text-blue-500" />
                                     <span className="truncate flex-1">{f.name}</span>
                                     <CheckCircle className="w-4 h-4 text-green-500" />
                                 </div>
                             ))}
                        </div>
                    )}
                </div>
            )}

            {/* Step 2: Processing Indicator */}
            {isProcessing && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    <div>
                        <h3 className="font-semibold text-slate-800">AI 处理中</h3>
                        <p className="text-sm text-slate-500">{progress}</p>
                    </div>
                </div>
            )}

            {/* Step 3: Verify Directory */}
            {activeStep === 'verify' && (
                <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded text-sm text-amber-800 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 mt-0.5" />
                        <p>AI 已识别出以下设备。请确认列表，如有遗漏可稍后手动添加。</p>
                    </div>
                    
                    <div className="space-y-2">
                        {identifiedEquipments.map((eq, idx) => (
                            <div key={eq.id} className="border border-slate-200 p-3 rounded hover:bg-slate-50 flex justify-between items-center group">
                                <div>
                                    <div className="font-bold text-blue-700">{eq.tag}</div>
                                    <div className="text-xs text-slate-500">{eq.name} • {eq.pageRange}</div>
                                </div>
                                <button 
                                    onClick={() => setIdentifiedEquipments(prev => prev.filter(x => x.id !== eq.id))}
                                    className="text-slate-300 hover:text-red-500 px-2"
                                >
                                    &times;
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

             {/* Step 4: Extraction Progress */}
             {activeStep === 'extract' && !isProcessing && (
                 <div className="text-center py-10">
                     <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                     <h3 className="text-lg font-bold text-slate-800">解析完成</h3>
                     <p className="text-slate-500 mb-6">已成功提取 {identifiedEquipments.length} 台设备的 BOM 数据。</p>
                 </div>
             )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
            {activeStep === 'upload' && (
                <button 
                    onClick={startStructureScan} 
                    disabled={files.length === 0}
                    className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    <Play className="w-4 h-4" /> 开始目录扫描
                </button>
            )}

            {activeStep === 'verify' && (
                <div className="flex gap-2">
                    <button 
                        onClick={() => setActiveStep('upload')}
                        className="flex-1 bg-white border border-slate-300 text-slate-700 py-2.5 rounded-lg font-medium hover:bg-slate-50"
                    >
                        重选文件
                    </button>
                    <button 
                        onClick={startDetailExtraction}
                        className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                        <Play className="w-4 h-4" /> 开始 BOM 提取
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
