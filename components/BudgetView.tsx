
import React, { useState } from 'react';
import { MaterialItem, Equipment } from '../types';
import { findMaterialPrices } from '../services/gemini';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { RefreshCw, Calculator, DollarSign, Plus, ArrowLeft, Save, Tag, Weight, Ruler } from 'lucide-react';

interface BudgetViewProps {
  equipment: Equipment;
  onUpdateEquipment: (updatedEq: Equipment) => void;
  onBack: () => void;
  laborCostPerKg: number;
  setLaborCostPerKg: (val: number) => void;
  overheadPercent: number;
  setOverheadPercent: (val: number) => void;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const CATEGORY_LABELS: Record<string, string> = {
  'plate': '板材',
  'forging': '锻件',
  'pipe': '管材',
  'consumable': '耗材',
  'other': '其他'
};

export const BudgetView: React.FC<BudgetViewProps> = ({
  equipment,
  onUpdateEquipment,
  onBack,
  laborCostPerKg,
  setLaborCostPerKg,
  overheadPercent,
  setOverheadPercent
}) => {
  const [loadingPrices, setLoadingPrices] = useState(false);
  const materials = equipment.materials;
  
  // Calculate totals
  const totalBOMWeight = materials.reduce((sum, item) => sum + (item.weight * item.quantity), 0);
  const totalMaterialCost = materials.reduce((sum, item) => sum + (item.weight * item.quantity * item.unitPrice), 0);
  const laborCost = totalBOMWeight * laborCostPerKg;
  const overheadCost = (totalMaterialCost + laborCost) * (overheadPercent / 100);
  const grandTotal = totalMaterialCost + laborCost + overheadCost;

  // Chart Data Preparation
  const categoryData = materials.reduce((acc, item) => {
    const cost = item.weight * item.quantity * item.unitPrice;
    const catLabel = CATEGORY_LABELS[item.category] || '其他';
    const existing = acc.find(x => x.name === catLabel);
    if (existing) {
      existing.value += cost;
    } else {
      acc.push({ name: catLabel, value: cost });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  const costBreakdownData = [
    { name: '材料费', value: totalMaterialCost },
    { name: '人工/制造', value: laborCost },
    { name: '综合管理费', value: overheadCost },
  ];

  const updateMaterials = (newMaterials: MaterialItem[]) => {
    onUpdateEquipment({ ...equipment, materials: newMaterials });
  };

  const handleFetchPrices = async () => {
    setLoadingPrices(true);
    const materialNames = materials.map(m => m.material).filter(m => m !== 'N/A' && m !== '');
    try {
      const prices = await findMaterialPrices(materialNames);
      const updatedMaterials = materials.map(item => {
        const foundPriceKey = Object.keys(prices).find(key => 
          item.material.toLowerCase().includes(key.toLowerCase()) || 
          key.toLowerCase().includes(item.material.toLowerCase())
        );
        if (foundPriceKey) {
            return { ...item, unitPrice: prices[foundPriceKey] };
        }
        return item;
      });
      updateMaterials(updatedMaterials);
    } finally {
      setLoadingPrices(false);
    }
  };

  const handlePriceChange = (id: string, newPrice: number) => {
    const updated = materials.map(m => m.id === id ? { ...m, unitPrice: newPrice } : m);
    updateMaterials(updated);
  };

  const handleWeightChange = (id: string, newWeight: number) => {
     const updated = materials.map(m => m.id === id ? { ...m, weight: newWeight } : m);
    updateMaterials(updated);
  };
  
  const handleQuantityChange = (id: string, newQty: number) => {
     const updated = materials.map(m => m.id === id ? { ...m, quantity: newQty } : m);
    updateMaterials(updated);
  };

    const addNewRow = () => {
        const newItem: MaterialItem = {
            id: `manual-${Date.now()}`,
            name: "新组件",
            material: "",
            specification: "",
            weight: 0,
            quantity: 1,
            unitPrice: 0,
            totalPrice: 0,
            category: 'other'
        };
        updateMaterials([...materials, newItem]);
    };

    const removeRow = (id: string) => {
        updateMaterials(materials.filter(m => m.id !== id));
    };

  return (
    <div className="space-y-6">
      {/* Header with Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
             <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition text-slate-600">
                <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
                 <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                     {equipment.tag} 
                     <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{equipment.name}</span>
                 </h2>
            </div>
        </div>
        
        {/* Quick Specs View */}
        <div className="flex flex-wrap gap-3 text-sm text-slate-600">
            {equipment.specification && (
                <div className="flex items-center gap-1 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">
                    <Ruler className="w-3 h-3 text-blue-500"/> {equipment.specification}
                </div>
            )}
            {equipment.mainMaterial && (
                <div className="flex items-center gap-1 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm">
                    <Tag className="w-3 h-3 text-purple-500"/> {equipment.mainMaterial}
                </div>
            )}
            {equipment.designWeight && equipment.designWeight > 0 && (
                <div className="flex items-center gap-1 bg-white border border-slate-200 px-3 py-1 rounded-full shadow-sm" title="图纸设计重量">
                    <Weight className="w-3 h-3 text-green-500"/> 设计重: {equipment.designWeight} kg
                </div>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Cost Table */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-blue-600" />
              材料清单 (BOM)
            </h3>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                 <button 
                onClick={addNewRow}
                className="flex-1 sm:flex-none justify-center flex items-center gap-1 text-sm bg-white border border-slate-300 px-3 py-1.5 rounded hover:bg-slate-50 transition"
              >
                <Plus className="w-4 h-4" /> 添加
              </button>
              <button 
                onClick={handleFetchPrices}
                disabled={loadingPrices}
                className="flex-1 sm:flex-none justify-center flex items-center gap-1 text-sm bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded hover:bg-indigo-100 transition disabled:opacity-50"
              >
                {loadingPrices ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {loadingPrices ? '正在获取...' : '智能填充单价'}
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto flex-grow">
            <table className="w-full text-sm text-left min-w-[800px]">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">组件名称</th>
                  <th className="px-4 py-3 font-medium">材质</th>
                  <th className="px-4 py-3 font-medium">规格</th>
                  <th className="px-4 py-3 font-medium text-right">数量</th>
                  <th className="px-4 py-3 font-medium text-right">单重 (kg)</th>
                  <th className="px-4 py-3 font-medium text-right">总重 (kg)</th>
                  <th className="px-4 py-3 font-medium text-right w-32">单价 (¥/kg)</th>
                  <th className="px-4 py-3 font-medium text-right">成本 (¥)</th>
                  <th className="px-2 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {materials.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 group">
                    <td className="px-4 py-2 font-medium text-slate-800">
                        <input type="text" value={item.name} onChange={(e) => {
                             const updated = materials.map(m => m.id === item.id ? { ...m, name: e.target.value } : m);
                             updateMaterials(updated);
                        }} className="bg-transparent w-full focus:outline-none focus:border-b focus:border-blue-500" />
                    </td>
                    <td className="px-4 py-2 text-slate-600">{item.material}</td>
                    <td className="px-4 py-2 text-slate-500 text-xs">{item.specification}</td>
                    <td className="px-4 py-2 text-right">
                         <input 
                        type="number" 
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(item.id, parseFloat(e.target.value) || 0)}
                        className="w-16 text-right border border-slate-200 rounded px-1 py-0.5 focus:ring-2 focus:ring-blue-200 outline-none"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input 
                        type="number" 
                        value={item.weight}
                        onChange={(e) => handleWeightChange(item.id, parseFloat(e.target.value) || 0)}
                        className="w-20 text-right border border-slate-200 rounded px-1 py-0.5 focus:ring-2 focus:ring-blue-200 outline-none"
                      />
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600 font-mono">
                      {(item.weight * item.quantity).toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="relative">
                        <span className="absolute left-2 top-1 text-slate-400 text-xs">¥</span>
                        <input 
                          type="number" 
                          value={item.unitPrice} 
                          onChange={(e) => handlePriceChange(item.id, parseFloat(e.target.value) || 0)}
                          className="w-full text-right pl-4 border border-slate-200 rounded px-1 py-0.5 focus:ring-2 focus:ring-blue-200 outline-none"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-slate-800">
                      ¥{(item.weight * item.quantity * item.unitPrice).toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-center">
                        <button onClick={() => removeRow(item.id)} className="text-slate-300 hover:text-red-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition p-1">
                            &times;
                        </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {materials.length === 0 && (
                <div className="p-8 text-center text-slate-400">
                    此设备暂无材料数据。
                </div>
            )}
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-end gap-2 sm:gap-6 text-sm">
             <div className="flex justify-between sm:block">项目总数: <span className="font-semibold">{materials.reduce((s,i) => s + i.quantity, 0)}</span></div>
             <div className="flex justify-between sm:block">计算总重: <span className="font-semibold">{totalBOMWeight.toFixed(1)} kg</span></div>
             <div className="flex justify-between sm:block">材料成本: <span className="font-semibold text-blue-700">¥{totalMaterialCost.toFixed(2)}</span></div>
          </div>
        </div>

        {/* Summary & Params */}
        <div className="space-y-6">
          
          {/* Controls */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                计价参数
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">人工及制造成本 (¥/kg)</label>
                <input 
                  type="number" 
                  value={laborCostPerKg}
                  onChange={(e) => setLaborCostPerKg(parseFloat(e.target.value) || 0)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-200 outline-none"
                />
                <p className="text-xs text-slate-400 mt-1">
                    基于总重 {totalBOMWeight.toFixed(0)} kg
                    {(equipment.designWeight || 0) > 0 && <span> (图纸重: {equipment.designWeight})</span>}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">管理费及利润 (%)</label>
                <input 
                  type="range" 
                  min="0" max="50" 
                  value={overheadPercent}
                  onChange={(e) => setOverheadPercent(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>0%</span>
                  <span className="font-semibold text-slate-700">{overheadPercent}%</span>
                  <span>50%</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100">
               <div className="flex justify-between items-center mb-2">
                 <span className="text-slate-600">材料合计</span>
                 <span className="font-medium">¥{totalMaterialCost.toFixed(2)}</span>
               </div>
               <div className="flex justify-between items-center mb-2">
                 <span className="text-slate-600">人工费</span>
                 <span className="font-medium">¥{laborCost.toFixed(2)}</span>
               </div>
               <div className="flex justify-between items-center mb-4">
                 <span className="text-slate-600">管理费</span>
                 <span className="font-medium">¥{overheadCost.toFixed(2)}</span>
               </div>
               <div className="flex justify-between items-center p-3 bg-slate-800 text-white rounded-lg">
                 <span className="font-semibold">单台造价</span>
                 <span className="font-bold text-lg">¥{grandTotal.toFixed(2)}</span>
               </div>
            </div>
          </div>

          {/* Charts */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[300px]">
             <h3 className="font-semibold text-slate-800 mb-4">成本分布</h3>
             <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={costBreakdownData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {costBreakdownData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `¥${value.toFixed(2)}`} />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};
