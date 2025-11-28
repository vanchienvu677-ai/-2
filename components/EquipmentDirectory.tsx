
import React from 'react';
import { Equipment } from '../types';
import { FileText, ArrowRight, Database, Trash2, Scale, Download } from 'lucide-react';

interface EquipmentDirectoryProps {
  equipments: Equipment[];
  onSelectEquipment: (eq: Equipment) => void;
  onDeleteEquipment: (id: string) => void;
  laborCostPerKg: number;
  overheadPercent: number;
}

export const EquipmentDirectory: React.FC<EquipmentDirectoryProps> = ({ 
  equipments, 
  onSelectEquipment, 
  onDeleteEquipment,
  laborCostPerKg,
  overheadPercent
}) => {
  
  const calculateCost = (eq: Equipment) => {
    const totalWeight = eq.materials.reduce((sum, item) => sum + (item.weight * item.quantity), 0);
    const materialCost = eq.materials.reduce((sum, item) => sum + (item.weight * item.quantity * item.unitPrice), 0);
    const labor = totalWeight * laborCostPerKg;
    const overhead = (materialCost + labor) * (overheadPercent / 100);
    return materialCost + labor + overhead;
  };

  const grandTotal = equipments.reduce((sum, eq) => sum + calculateCost(eq), 0);
  const totalDesignWeight = equipments.reduce((sum, eq) => sum + (eq.designWeight || 0), 0);

  const exportToCSV = () => {
      // Create CSV Header
      let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // Add BOM for Excel Chinese support
      csvContent += "位号,名称,规格,主体材质,图纸重量(kg),BOM重量(kg),预估造价(¥)\n";
      
      equipments.forEach(eq => {
          const bomWeight = eq.materials.reduce((sum, item) => sum + (item.weight * item.quantity), 0);
          const cost = calculateCost(eq);
          const row = [
              eq.tag,
              eq.name,
              eq.specification || '',
              eq.mainMaterial || '',
              eq.designWeight || 0,
              bomWeight.toFixed(2),
              cost.toFixed(2)
          ].join(",");
          csvContent += row + "\n";
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "equipment_list.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">设备总数</p>
          <p className="text-2xl font-bold text-slate-800">{equipments.length} <span className="text-sm font-normal text-slate-400">台</span></p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">总图纸重量</p>
          <p className="text-2xl font-bold text-slate-800">{totalDesignWeight > 0 ? totalDesignWeight.toLocaleString() : '-'} <span className="text-sm font-normal text-slate-400">kg</span></p>
        </div>
        <div className="bg-slate-800 text-white p-4 rounded-xl shadow-sm col-span-2 md:col-span-2 flex justify-between items-center">
          <div>
            <p className="text-sm text-slate-300 mb-1">项目预估总造价</p>
            <p className="text-3xl font-bold">¥ {grandTotal.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
          </div>
          <button onClick={exportToCSV} className="bg-slate-700 hover:bg-slate-600 p-2 rounded-lg transition" title="导出 Excel/CSV">
             <Download className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            设备清单
          </h3>
          <span className="text-xs text-slate-500">共识别出 {equipments.length} 台设备</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-medium">序号</th>
                <th className="px-6 py-3 font-medium">位号 (Tag)</th>
                <th className="px-6 py-3 font-medium">名称</th>
                <th className="px-6 py-3 font-medium">规格</th>
                <th className="px-6 py-3 font-medium">材质</th>
                <th className="px-6 py-3 font-medium text-right">
                    <div className="flex items-center justify-end gap-1" title="图纸重量 vs 提取BOM计算重量">
                        <Scale className="w-3 h-3" />
                        重量(kg)
                    </div>
                </th>
                <th className="px-6 py-3 font-medium text-right">估算造价 (¥)</th>
                <th className="px-6 py-3 font-medium text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {equipments.map((eq, index) => {
                 const bomWeight = eq.materials.reduce((sum, item) => sum + (item.weight * item.quantity), 0);
                 const cost = calculateCost(eq);
                 const designW = eq.designWeight || 0;
                 const weightWarning = designW > 0 && bomWeight > 0 && Math.abs(designW - bomWeight) / designW > 0.1;

                 return (
                  <tr key={eq.id} className="hover:bg-slate-50 transition group">
                    <td className="px-6 py-4 text-slate-400 font-mono">{index + 1}</td>
                    <td className="px-6 py-4 font-semibold text-blue-700">{eq.tag}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{eq.name}</td>
                    <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{eq.specification || '-'}</td>
                    <td className="px-6 py-4 text-slate-600">{eq.mainMaterial || '-'}</td>
                    <td className="px-6 py-4 text-right">
                        <div className="font-mono text-slate-700">{designW > 0 ? designW : '-'} <span className="text-slate-300">/</span> {bomWeight.toFixed(0)}</div>
                        {weightWarning && <div className="text-[10px] text-orange-500">偏差过大</div>}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-800">¥ {cost.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}</td>
                    <td className="px-6 py-4 flex justify-center gap-4">
                      <button 
                        onClick={() => onSelectEquipment(eq)}
                        className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 text-xs sm:text-sm px-3 py-1 bg-blue-50 hover:bg-blue-100 rounded-full transition"
                      >
                        详情 <ArrowRight className="w-3 h-3" />
                      </button>
                      <button 
                        onClick={() => onDeleteEquipment(eq.id)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                 );
              })}
              {equipments.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    暂无数据。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
