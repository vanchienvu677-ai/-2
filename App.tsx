
import React, { useState, useEffect } from 'react';
import { Equipment, AppView, UploadedFile, ProjectState } from './types';
import { SmartImporter } from './components/SmartImporter';
import { BudgetView } from './components/BudgetView';
import { EquipmentDirectory } from './components/EquipmentDirectory';
import { AIChat } from './components/AIChat';
import { LayoutDashboard, FileText, ShieldCheck, Database, Save, Download } from 'lucide-react';

export default function App() {
  const [view, setView] = useState<AppView>(AppView.IMPORTER);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  
  // Params
  const [laborCost, setLaborCost] = useState(15.0); 
  const [overhead, setOverhead] = useState(15); 

  // --- Persistence Logic ---
  useEffect(() => {
    const savedData = localStorage.getItem('vesselCostProject');
    if (savedData) {
        try {
            const parsed: ProjectState = JSON.parse(savedData);
            // Re-hydrate the equipments with an empty drawings array for type consistency
            if (parsed.equipments) {
                const hydratedEquipments = parsed.equipments.map(eq => ({
                    ...eq,
                    drawings: [] // Add empty drawings array back as it's not saved
                }));
                setEquipments(hydratedEquipments);
            }
            if (parsed.laborCostPerKg) setLaborCost(parsed.laborCostPerKg);
            if (parsed.overheadPercent) setOverhead(parsed.overheadPercent);
            if (parsed.lastSaved) setLastSaved(parsed.lastSaved);

            // If there's saved data, start at the directory view
            if(parsed.equipments && parsed.equipments.length > 0) {
              setView(AppView.DIRECTORY);
            }
        } catch (e) {
            console.error("Failed to load project", e);
            localStorage.removeItem('vesselCostProject'); // Clear corrupted data
        }
    }
  }, []);

  const saveProject = () => {
    // Create a version of the state that is safe to save, without large base64 strings.
    const equipmentsToSave = equipments.map(eq => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { drawings, ...rest } = eq; // Destructure to remove 'drawings'
      return rest;
    });

    const state: ProjectState = {
        id: 'proj-1',
        name: 'Default Project',
        files: [], // Files are not saved to prevent quota errors
        equipments: equipmentsToSave as Equipment[], // Save the stripped-down version
        laborCostPerKg: laborCost,
        overheadPercent: overhead,
        lastSaved: Date.now()
    };
    try {
        localStorage.setItem('vesselCostProject', JSON.stringify(state));
        setLastSaved(Date.now());
    } catch (e) {
        console.error("Failed to save project:", e);
        alert("保存项目失败！浏览器存储空间已满。请导出项目文件备份。");
    }
  };

  const exportProject = () => {
      const jsonString = JSON.stringify({ equipments, laborCost, overhead }, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `VesselCostAI_Project_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  const handleImportComplete = (newEquipments: Equipment[]) => {
    // Merge strategy: Add new ones, but maybe we should replace for simplicity in this flow
    setEquipments(newEquipments);
    setView(AppView.DIRECTORY);
    saveProject();
  };

  const handleSelectEquipment = (eq: Equipment) => {
    setSelectedEquipmentId(eq.id);
    setView(AppView.DETAIL);
  };

  const handleDeleteEquipment = (id: string) => {
    setEquipments(prev => prev.filter(e => e.id !== id));
    if (selectedEquipmentId === id) {
      setView(AppView.DIRECTORY);
      setSelectedEquipmentId(null);
    }
    // No need to save immediately, let user save manually or on update
  };

  const handleUpdateEquipment = (updatedEq: Equipment) => {
    setEquipments(prev => prev.map(e => e.id === updatedEq.id ? updatedEq : e));
    saveProject(); // Auto-save on detailed changes
  };

  const selectedEquipment = equipments.find(e => e.id === selectedEquipmentId);
  const allMaterials = equipments.flatMap(e => e.materials.map(m => ({...m, name: `${e.tag} - ${m.name}`})));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 h-16 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => equipments.length > 0 && setView(AppView.DIRECTORY)}>
            <div className="bg-blue-600 p-1.5 rounded-lg">
                <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-800 tracking-tight">Vessel<span className="text-blue-600">CostAI</span></span>
        </div>
        
        <div className="flex items-center gap-3">
             <div className="hidden md:flex text-xs text-slate-400 mr-2">
                 {lastSaved ? `上次保存: ${new Date(lastSaved).toLocaleTimeString()}` : "未保存"}
             </div>
             <button onClick={saveProject} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition" title="保存进度">
                 <Save className="w-5 h-5" />
             </button>
             <button onClick={exportProject} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition" title="导出项目 JSON">
                 <Download className="w-5 h-5" />
             </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
         {/* Sidebar Navigation */}
         <aside className="w-16 md:w-64 bg-slate-900 text-slate-300 flex-shrink-0 flex flex-col">
             <div className="flex-1 py-6 space-y-2">
                 <button 
                    onClick={() => setView(AppView.IMPORTER)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 transition border-l-4 ${view === AppView.IMPORTER ? 'border-blue-500 bg-slate-800 text-white' : 'border-transparent'}`}
                 >
                     <FileText className="w-5 h-5" />
                     <span className="hidden md:block font-medium">图纸分析</span>
                 </button>
                 <button 
                    onClick={() => equipments.length > 0 && setView(AppView.DIRECTORY)}
                    disabled={equipments.length === 0}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 transition border-l-4 disabled:opacity-50 disabled:cursor-not-allowed ${view === AppView.DIRECTORY || view === AppView.DETAIL ? 'border-blue-500 bg-slate-800 text-white' : 'border-transparent'}`}
                 >
                     <Database className="w-5 h-5" />
                     <span className="hidden md:block font-medium">设备台账</span>
                 </button>
             </div>
         </aside>

         {/* Content Area */}
         <main className="flex-1 overflow-auto p-4 md:p-8 relative">
            
            {view === AppView.IMPORTER && (
                <div className="animate-fade-in max-w-6xl mx-auto h-full">
                    <SmartImporter 
                        onImportComplete={handleImportComplete} 
                        onFilesChanged={setUploadedFiles}
                    />
                </div>
            )}

            {view === AppView.DIRECTORY && (
                <div className="animate-fade-in max-w-6xl mx-auto">
                    <div className="flex justify-between items-end mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">项目设备台账</h1>
                            <p className="text-slate-500 mt-1">管理所有已提取的设备和估算数据。</p>
                        </div>
                        <button onClick={() => setView(AppView.IMPORTER)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-sm flex items-center gap-2">
                             <FileText className="w-4 h-4"/> 新增提取
                        </button>
                    </div>
                    <EquipmentDirectory 
                        equipments={equipments}
                        onSelectEquipment={handleSelectEquipment}
                        onDeleteEquipment={handleDeleteEquipment}
                        laborCostPerKg={laborCost}
                        overheadPercent={overhead}
                    />
                </div>
            )}

            {view === AppView.DETAIL && selectedEquipment && (
                <div className="animate-fade-in max-w-6xl mx-auto">
                    <BudgetView 
                        equipment={selectedEquipment} 
                        onUpdateEquipment={handleUpdateEquipment}
                        onBack={() => setView(AppView.DIRECTORY)}
                        laborCostPerKg={laborCost}
                        setLaborCostPerKg={setLaborCost}
                        overheadPercent={overhead}
                        setOverheadPercent={setOverhead}
                    />
                </div>
            )}
         </main>
      </div>

      <AIChat materials={allMaterials} />
    </div>
  );
}
