
import React, { useState, useRef } from 'react';
import { MaterialItem, Equipment } from '../types';
import { analyzeDrawingForMaterials } from '../services/gemini';
import { Loader2, Upload, FileText, CheckCircle, AlertCircle, Search, DollarSign, Layers } from 'lucide-react';

interface ExtractionViewProps {
  onAnalysisComplete: (equipments: Equipment[]) => void;
}

interface FileStatus {
  file: File;
  status: 'pending' | 'processing' | 'success' | 'error';
  errorMsg?: string;
  results?: {
    tag: string;
    name: string;
    itemCount: number;
  }[];
}

export const ExtractionView: React.FC<ExtractionViewProps> = ({ onAnalysisComplete }) => {
  const [fileQueue, setFileQueue] = useState<FileStatus[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map(f => ({
        file: f,
        status: 'pending' as const
      }));
      setFileQueue(prev => [...prev, ...newFiles]);
    }
  };

  const processQueue = async () => {
    setIsProcessing(true);
    const equipmentMap = new Map<string, Equipment>();

    // We process the queue but we need to keep track of the results for the UI
    // and also accumulate the equipment data for the final callback.
    const updatedQueue = [...fileQueue];

    for (let i = 0; i < updatedQueue.length; i++) {
      if (updatedQueue[i].status === 'success') continue; 

      updatedQueue[i].status = 'processing';
      setFileQueue([...updatedQueue]);

      try {
        const file = updatedQueue[i].file;
        const reader = new FileReader();
        
        // Wrap FileReader in Promise
        const resultPromise = new Promise<{base64: string, equipments: any[]}>((resolve, reject) => {
          reader.onloadend = async () => {
            try {
              const base64String = reader.result as string;
              const base64Data = base64String.split(',')[1];
              // Call Gemini Service
              const rawResult = await analyzeDrawingForMaterials(base64Data, file.type);
              
              resolve({
                base64: base64String,
                equipments: rawResult.equipments
              });
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const data = await resultPromise;
        
        // Update Status
        updatedQueue[i].status = 'success';
        updatedQueue[i].results = data.equipments.map((eq: any) => ({
          tag: eq.tag,
          name: eq.name,
          itemCount: eq.materials?.length || 0
        }));

        // Processing / Merging Logic
        data.equipments.forEach((eqData: any, eqIdx: number) => {
            const rawItems: MaterialItem[] = (eqData.materials || []).map((item: any, itemIdx: number) => ({
                id: `mat-${Date.now()}-${i}-${eqIdx}-${itemIdx}`,
                name: item.name || "未知组件",
                material: item.material || "N/A",
                specification: item.specification || "-",
                weight: item.weight || 0,
                quantity: item.quantity || 1,
                unitPrice: 0,
                totalPrice: 0,
                category: item.category || 'other'
            }));

            // Normalize Tag: If unknown, combine with filename to ensure uniqueness unless explicitly named
            const tagKey = (eqData.tag === 'Unknown' || !eqData.tag) 
                ? `Unknown-${file.name}-${eqIdx}` 
                : eqData.tag;

            if (equipmentMap.has(tagKey)) {
                // Merge into existing
                const existing = equipmentMap.get(tagKey)!;
                existing.materials = [...existing.materials, ...rawItems];
                if (!existing.drawings.includes(data.base64)) {
                    existing.drawings.push(data.base64);
                }
                // Overwrite meta info if the new one looks better (e.g. has spec when prev didn't)
                if (!existing.specification && eqData.specification) existing.specification = eqData.specification;
                if (!existing.mainMaterial && eqData.mainMaterial) existing.mainMaterial = eqData.mainMaterial;
                if (!existing.designWeight && eqData.designWeight) existing.designWeight = eqData.designWeight;
                
            } else {
                // Create new
                equipmentMap.set(tagKey, {
                    id: `eq-${Date.now()}-${i}-${eqIdx}`,
                    tag: tagKey.startsWith('Unknown-') ? '未命名设备' : tagKey,
                    name: eqData.name,
                    specification: eqData.specification,
                    mainMaterial: eqData.mainMaterial,
                    designWeight: eqData.designWeight,
                    materials: rawItems,
                    drawings: [data.base64],
                    lastModified: Date.now(),
                    status: 'complete'
                });
            }
        });

      } catch (err) {
        console.error(err);
        updatedQueue[i].status = 'error';
        updatedQueue[i].errorMsg = "提取失败";
      }

      setFileQueue([...updatedQueue]);
    }

    setIsProcessing(false);
    
    if (equipmentMap.size > 0) {
      onAnalysisComplete(Array.from(equipmentMap.values()));
    }
  };

  const removeFile = (index: number) => {
    setFileQueue(prev => prev.filter((_, i) => i !== index));
  };

  const pendingCount = fileQueue.filter(f => f.status === 'pending').length;
  const successCount = fileQueue.filter(f => f.status === 'success').length;

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 sm:p-8 rounded-xl shadow-sm border border-slate-200 text-center">
        <div 
          className="border-2 border-dashed border-slate-300 rounded-lg p-6 sm:p-10 cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex justify-center -space-x-4 mb-4">
             <div className="bg-blue-100 p-3 rounded-full border-2 border-white z-0"><Upload className="w-6 h-6 text-blue-500" /></div>
             <div className="bg-purple-100 p-3 rounded-full border-2 border-white z-10"><Layers className="w-6 h-6 text-purple-500" /></div>
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-slate-700">批量上传图纸</h3>
          <p className="text-sm text-slate-500 mb-4">
              支持多选 PDF, JPG, PNG。<br className="sm:hidden"/>
              系统自动识别单文件中的多台设备。
          </p>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition w-full sm:w-auto text-sm sm:text-base shadow-sm">
            选择文件 ({fileQueue.length})
          </button>
          <input 
            ref={fileInputRef} 
            type="file" 
            accept="image/*,application/pdf" 
            multiple 
            className="hidden" 
            onChange={handleFileSelect} 
          />
        </div>

        {fileQueue.length > 0 && (
          <div className="mt-6 text-left">
            <h4 className="font-semibold text-slate-700 mb-3 flex justify-between items-center">
              <span>待处理文件队列</span>
              {pendingCount > 0 && !isProcessing && (
                <button 
                  onClick={processQueue}
                  className="text-sm bg-green-600 text-white px-4 py-1.5 rounded hover:bg-green-700 flex items-center gap-2 animate-bounce-subtle"
                >
                  <Loader2 className="w-4 h-4" /> 开始提取 ({pendingCount})
                </button>
              )}
            </h4>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {fileQueue.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between bg-slate-50 p-3 rounded border border-slate-100">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    <span className="text-sm text-slate-600 truncate max-w-[200px] sm:max-w-xs">{item.file.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.status === 'pending' && <span className="text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded">等待</span>}
                    {item.status === 'processing' && <span className="text-xs text-blue-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> 分析中...</span>}
                    {item.status === 'success' && (
                       <div className="flex flex-col items-end">
                         <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> 完成</span>
                         {item.results && (
                             <span className="text-[10px] text-slate-400">
                                 发现 {item.results.length} 台设备
                             </span>
                         )}
                       </div>
                    )}
                    {item.status === 'error' && <span className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> 失败</span>}
                    
                    {!isProcessing && (
                      <button onClick={() => removeFile(idx)} className="text-slate-300 hover:text-red-500">
                        &times;
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {successCount > 0 && !isProcessing && (
               <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-center">
                 <p className="text-green-800 text-sm font-medium mb-2">已成功处理 {successCount} 个文件。</p>
                 <p className="text-green-600 text-xs">系统已自动拆分文件内的多台设备，并合并了相同位号的数据。</p>
               </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-start gap-3">
          <div className="p-2 bg-purple-100 rounded-lg text-purple-600 flex-shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-800">多设备拆分</h4>
            <p className="text-sm text-slate-500">单张图纸若包含多台设备，AI 将自动识别并拆分为独立条目。</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-start gap-3">
          <div className="p-2 bg-blue-100 rounded-lg text-blue-600 flex-shrink-0">
             <Search className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-slate-800">参数提取</h4>
            <p className="text-sm text-slate-500">自动读取规格、材质、图纸设计重量等关键参数。</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-start gap-3">
           <div className="p-2 bg-green-100 rounded-lg text-green-600 flex-shrink-0">
             <DollarSign className="w-5 h-5" />
           </div>
          <div>
            <h4 className="font-semibold text-slate-800">成本汇总</h4>
            <p className="text-sm text-slate-500">对比图纸重量与BOM计算重量，精确控制成本。</p>
          </div>
        </div>
      </div>
    </div>
  );
};
