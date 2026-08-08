import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Factory, 
  Plus, 
  Trash2, 
  Layers, 
  ClipboardList, 
  CheckCircle2, 
  AlertCircle, 
  X,
  Settings,
  Clock,
  DollarSign,
  Save,
  Play
} from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface BOMItem {
  material_name: string;
  quantity_per_meter: number; // الكمية لكل 1 متر
  unit: string;
  waste_percent: number; // نسبة الهدر %
}

interface BOM {
  id: string;
  product_name: string;
  product_code: string;
  unit: string; // دائماً سيكون "متر" للكابلات
  items: BOMItem[];
}

interface TreeItem {
  id: string;
  name: string;
  code: string;
  type: string;
  unit: string;
}

interface Movement {
  item_name: string;
  type: 'IN' | 'OUT';
  quantity: number;
}

export default function Production() {
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'BOM'>('ORDERS');
  
  // Data States
  const [boms, setBoms] = useState<BOM[]>([]);
  const [treeItems, setTreeItems] = useState<TreeItem[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  
  // BOM Modal State
  const [showBomModal, setShowBomModal] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedMaterialsList, setSelectedMaterialsList] = useState<string[]>([]);
  const [bomItemsConfig, setBomItemsConfig] = useState<BOMItem[]>([]);
  const [bomStep, setBomStep] = useState<1 | 2>(1);

  // Production Order State
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [selectedBomId, setSelectedBomId] = useState<string>('');
  const [targetQuantity, setTargetQuantity] = useState<number>(5000); // Default 5000m

  useEffect(() => {
    fetchInitialData();
    generateOrderNumber();
  }, []);

  const generateOrderNumber = () => {
    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, '');
    const randomNum = Math.floor(100 + Math.random() * 900);
    setOrderNumber(`PROD-${dateStr}-${randomNum}`);
  };

  const fetchInitialData = async () => {
    // الوصفات
    const localBoms = localStorage.getItem('app_boms');
    if (localBoms) setBoms(JSON.parse(localBoms));

    // شجرة المواد
    try {
      const { data: tData } = await supabase.from('inventory_tree').select('*').eq('is_active', true);
      if (tData) setTreeItems(tData as TreeItem[]);
    } catch {
      // Fallback
    }

    // الحركات لحساب الرصيد
    try {
      const { data: mData } = await supabase.from('inventory_movements').select('*');
      if (mData) setMovements(mData as Movement[]);
      else {
        const localM = localStorage.getItem('app_inventory_movements');
        if (localM) setMovements(JSON.parse(localM));
      }
    } catch {
      const localM = localStorage.getItem('app_inventory_movements');
      if (localM) setMovements(JSON.parse(localM));
    }
  };

  const saveBoms = (updated: BOM[]) => {
    setBoms(updated);
    localStorage.setItem('app_boms', JSON.stringify(updated));
  };

  // حساب الرصيد المتوفر لمادة معينة من المخزن
  const getStock = (itemName: string) => {
    const itemIn = movements.filter(m => m.item_name === itemName && m.type === 'IN').reduce((a, c) => a + Number(c.quantity), 0);
    const itemOut = movements.filter(m => m.item_name === itemName && m.type === 'OUT').reduce((a, c) => a + Number(c.quantity), 0);
    return itemIn - itemOut;
  };

  // --- دوال التحكم بوصفة التصنيع المتقدمة ---
  const toggleMaterialSelection = (materialName: string) => {
    if (selectedMaterialsList.includes(materialName)) {
      setSelectedMaterialsList(prev => prev.filter(m => m !== materialName));
    } else {
      setSelectedMaterialsList(prev => [...prev, materialName]);
    }
  };

  const proceedToBomFormula = () => {
    if (!selectedProduct) return alert('الرجاء اختيار المنتج المراد تصنيعه');
    if (selectedMaterialsList.length === 0) return alert('الرجاء اختيار مادة خام واحدة على الأقل');

    // تجهيز جدول المعادلات بناءً على التحديد المتعدد
    const initialConfig = selectedMaterialsList.map(matName => {
      const found = treeItems.find(t => t.name === matName);
      return {
        material_name: matName,
        quantity_per_meter: 0,
        unit: found ? found.unit : 'كجم',
        waste_percent: 1.5 // افتراضي
      };
    });
    setBomItemsConfig(initialConfig);
    setBomStep(2);
  };

  const handleSaveBom = () => {
    // التحقق من القيم
    const hasZero = bomItemsConfig.some(item => item.quantity_per_meter <= 0);
    if (hasZero) return alert('الرجاء إدخال كميات صحيحة أكبر من صفر لكل المواد');

    const foundProd = treeItems.find(t => t.name === selectedProduct);
    const newBom: BOM = {
      id: Date.now().toString(),
      product_name: selectedProduct,
      product_code: foundProd ? foundProd.code : `PRD-${Date.now().toString().slice(-4)}`,
      unit: 'متر', // القياسي للمصنع
      items: bomItemsConfig
    };

    saveBoms([newBom, ...boms.filter(b => b.product_name !== selectedProduct)]);
    setShowBomModal(false);
    resetBomModal();
  };

  const resetBomModal = () => {
    setBomStep(1);
    setSelectedProduct('');
    setSelectedMaterialsList([]);
    setBomItemsConfig([]);
  };

  const handleDeleteBom = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذه الوصفة؟')) {
      saveBoms(boms.filter(b => b.id !== id));
    }
  };

  const selectedBomForCalc = boms.find(b => b.id === selectedBomId);
  
  // فحص هل المخزون يكفي للبدء بالإنتاج؟
  const canProduce = selectedBomForCalc?.items.every(item => {
    const grossNeeded = (item.quantity_per_meter * targetQuantity) * (1 + (item.waste_percent / 100));
    return getStock(item.material_name) >= grossNeeded;
  });

  return (
    <div dir="rtl" className="p-6 bg-slate-50 min-h-screen font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Factory className="text-blue-600" /> إدارة الإنتاج الذكية
          </h1>
          <p className="text-sm text-slate-500 mt-1">تخطيط أوامر الإنتاج، حساب استهلاك المواد الفوري، وهندسة الوصفات التصنيعية.</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-200 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('ORDERS')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'ORDERS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}
          >
            <ClipboardList size={18} /> أوامر الإنتاج
          </button>
          <button 
            onClick={() => setActiveTab('BOM')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'BOM' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}
          >
            <Layers size={18} /> وصفات التصنيع (BOM)
          </button>
        </div>
      </div>

      {/* Tab 1: Production Orders (Advanced) */}
      {activeTab === 'ORDERS' && (
        <div className="space-y-6">
          {/* Order Configuration Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-5 border-b pb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Settings className="text-blue-600" size={20} /> إعداد أمر إنتاج جديد
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-500">رقم الأمر:</span>
                <input 
                  type="text" 
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  className="bg-slate-100 border-none rounded-lg px-3 py-1.5 text-sm font-mono font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 w-48"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-xl border border-slate-200">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">المنتج المراد تصنيعه (من الوصفات المعتمدة)</label>
                <select 
                  value={selectedBomId}
                  onChange={e => setSelectedBomId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-3 text-sm bg-white font-bold text-slate-800 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  <option value="">-- يرجى اختيار المنتج / الوصفة --</option>
                  {boms.map(b => (
                    <option key={b.id} value={b.id}>{b.product_name} [{b.product_code}]</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">الكمية المستهدفة (بالمتر)</label>
                <div className="relative">
                  <input 
                    type="number"
                    min="1"
                    value={targetQuantity}
                    onChange={e => setTargetQuantity(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg p-3 text-lg font-bold text-blue-700 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  <span className="absolute left-3 top-3.5 text-sm font-bold text-slate-400">متر (m)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Live Stock Collision & Analysis */}
          {selectedBomForCalc && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800 text-lg">
                    تحليل المواد لإنتاج <span className="text-blue-600">{targetQuantity.toLocaleString()} متر</span> من {selectedBomForCalc.product_name}
                  </h3>
                  
                  {/* Future Integrations Badges */}
                  <div className="flex gap-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-xs font-bold" title="قريباً: ربط بقسم الحسابات">
                      <DollarSign size={14} /> التكلفة: جاري الحساب..
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-xs font-bold" title="قريباً: حساب زمن المكائن">
                      <Clock size={14} /> الزمن: جاري الحساب..
                    </span>
                  </div>
               </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th className="p-4 font-semibold">المادة الأولية</th>
                      <th className="p-4 text-center font-semibold text-slate-300">المعادلة (للمتر الواحد)</th>
                      <th className="p-4 text-center font-semibold">المطلوب الصافي</th>
                      <th className="p-4 text-center font-semibold text-amber-300">الإجمالي (مع الهدر)</th>
                      <th className="p-4 text-center font-semibold">متوفر في المخزن</th>
                      <th className="p-4 text-center font-semibold">حالة الرصيد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedBomForCalc.items.map((item, idx) => {
                      const netNeeded = item.quantity_per_meter * targetQuantity;
                      const grossNeeded = netNeeded * (1 + (item.waste_percent / 100));
                      const stockAvailable = getStock(item.material_name);
                      const isSufficient = stockAvailable >= grossNeeded;
                      const deficit = grossNeeded - stockAvailable;

                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition">
                          <td className="p-4 font-bold text-slate-800">{item.material_name}</td>
                          <td className="p-4 text-center font-mono text-xs text-slate-500">{item.quantity_per_meter} {item.unit}</td>
                          <td className="p-4 text-center font-bold text-slate-700">{netNeeded.toLocaleString(undefined, {maximumFractionDigits: 2})} {item.unit}</td>
                          <td className="p-4 text-center font-bold text-amber-600 bg-amber-50/50">{grossNeeded.toLocaleString(undefined, {maximumFractionDigits: 2})} {item.unit}</td>
                          <td className="p-4 text-center font-mono font-bold text-slate-700">{stockAvailable.toLocaleString(undefined, {maximumFractionDigits: 2})} {item.unit}</td>
                          <td className="p-4 text-center">
                            {isSufficient ? (
                              <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-200">
                                <CheckCircle2 size={16} /> رصيد كافٍ
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 bg-rose-100 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-rose-200 shadow-sm animate-pulse">
                                <AlertCircle size={16} /> عجز ({deficit.toLocaleString(undefined, {maximumFractionDigits: 2})} {item.unit})
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Action Button */}
              <div className="mt-6 flex justify-end">
                <button 
                  disabled={!canProduce}
                  className={`px-8 py-3 rounded-xl font-bold text-lg flex items-center gap-2 shadow-lg transition-all ${canProduce ? 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}
                >
                  <Play size={20} fill="currentColor" />
                  {canProduce ? 'تأكيد وبدء الإنتاج (سحب من المخزن)' : 'المخزون لا يكفي للإنتاج'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: BOM Management */}
      {activeTab === 'BOM' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800">وصفات ومعادلات التصنيع المعتمدة</h2>
              <p className="text-sm text-slate-500 mt-1">إعداد المقادير المعيارية لإنتاج متر واحد من كل كابل.</p>
            </div>
            <button 
              onClick={() => {
                resetBomModal();
                setShowBomModal(true);
              }}
              className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md transition"
            >
              <Plus size={20} /> إنشاء وصفة تصنيع جديدة
            </button>
          </div>

          {boms.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Layers size={32} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-700 mb-1">لا توجد وصفات تصنيع بعد</h3>
              <p className="text-sm text-slate-500">قم ببناء هندسة المنتجات لتمكين النظام من حساب الاحتياجات تلقائياً.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {boms.map(bom => (
                <div key={bom.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden">
                  <div className="bg-slate-800 p-4 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-white text-lg">{bom.product_name}</h3>
                      <p className="text-xs text-slate-300 font-mono mt-1">الكود: {bom.product_code} | القياس الأساسي: 1 {bom.unit}</p>
                    </div>
                    <button 
                      onClick={() => handleDeleteBom(bom.id)} 
                      className="text-rose-400 hover:text-white hover:bg-rose-500 p-2 rounded-lg transition"
                      title="حذف الوصفة"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="p-5">
                    <p className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">مقادير المتر الواحد:</p>
                    <div className="space-y-3">
                      {bom.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="font-bold text-slate-700 text-sm flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            {item.material_name}
                          </span>
                          <div className="text-right">
                            <div className="font-mono font-bold text-blue-700 text-sm">
                              {item.quantity_per_meter} {item.unit}
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 mt-0.5">هدر: {item.waste_percent}%</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modern BOM Multi-Step Modal */}
      {showBomModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-slate-800 p-5 flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Settings className="text-blue-400" /> 
                {bomStep === 1 ? 'الخطوة 1: تحديد المنتج والمواد الخام' : 'الخطوة 2: هندسة مقادير المتر الواحد'}
              </h3>
              <button onClick={() => setShowBomModal(false)} className="text-slate-400 hover:text-white transition">
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto grow">
              
              {/* STEP 1: Selection */}
              {bomStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">المنتج المراد بناء وصفة له (المنتج التام)</label>
                    <select 
                      value={selectedProduct}
                      onChange={e => setSelectedProduct(e.target.value)}
                      className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm bg-slate-50 font-bold text-blue-700 focus:border-blue-500 focus:bg-white outline-none transition"
                    >
                      <option value="">-- اختر من قائمة المنتجات --</option>
                      {treeItems.map(item => (
                        <option key={item.id} value={item.name}>{item.name} [{item.code}]</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-3 border-b pb-2">حدد جميع المواد الأولية المطلوبة لصناعة هذا الكابل (Multi-Select)</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {treeItems.map(item => (
                        <div 
                          key={item.id}
                          onClick={() => toggleMaterialSelection(item.name)}
                          className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${
                            selectedMaterialsList.includes(item.name) 
                            ? 'border-blue-500 bg-blue-50 shadow-sm' 
                            : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                            selectedMaterialsList.includes(item.name) ? 'bg-blue-500 text-white' : 'bg-slate-200'
                          }`}>
                            {selectedMaterialsList.includes(item.name) && <CheckCircle2 size={14} />}
                          </div>
                          <div className="text-sm font-bold text-slate-700 leading-tight">{item.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Formulation */}
              {bomStep === 2 && (
                <div className="space-y-5">
                  <div className="bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                    <AlertCircle className="shrink-0 mt-0.5" size={20} />
                    <p className="text-sm font-semibold">
                      أدخل الكمية المطلوبة بالوحدة المحددة لإنتاج <strong className="text-lg">متر واحد (1m)</strong> فقط من {selectedProduct}. <br/>
                      (ملاحظة: للبكرات الخشبية، إذا كانت البكرة تتسع لـ 1000 متر، أدخل الكمية 0.001)
                    </p>
                  </div>

                  <div className="space-y-3">
                    {bomItemsConfig.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-4 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <div className="col-span-12 md:col-span-5">
                          <div className="font-bold text-slate-800">{item.material_name}</div>
                          <div className="text-xs text-slate-400 font-mono mt-1">وحدة القياس: {item.unit}</div>
                        </div>

                        <div className="col-span-6 md:col-span-4">
                          <label className="text-xs font-bold text-slate-500 block mb-1">الكمية لكل 1 متر</label>
                          <input 
                            type="number"
                            step="0.0001"
                            value={item.quantity_per_meter || ''}
                            onChange={e => {
                              const updated = [...bomItemsConfig];
                              updated[index].quantity_per_meter = Number(e.target.value);
                              setBomItemsConfig(updated);
                            }}
                            className="w-full border-2 border-slate-200 rounded-lg p-2 text-sm font-bold text-blue-700 outline-none focus:border-blue-500 text-center"
                            placeholder="مثال: 0.850"
                          />
                        </div>

                        <div className="col-span-6 md:col-span-3">
                          <label className="text-xs font-bold text-slate-500 block mb-1">نسبة الهدر %</label>
                          <input 
                            type="number"
                            step="0.1"
                            value={item.waste_percent}
                            onChange={e => {
                              const updated = [...bomItemsConfig];
                              updated[index].waste_percent = Number(e.target.value);
                              setBomItemsConfig(updated);
                            }}
                            className="w-full border-2 border-slate-200 rounded-lg p-2 text-sm font-bold text-amber-600 outline-none focus:border-amber-500 text-center"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-5 border-t border-slate-200 flex justify-between shrink-0">
              {bomStep === 1 ? (
                <>
                  <button onClick={() => setShowBomModal(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition">إلغاء</button>
                  <button onClick={proceedToBomFormula} className="px-6 py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition flex items-center gap-2">
                    التالي: هندسة المقادير
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setBomStep(1)} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition">رجوع</button>
                  <button onClick={handleSaveBom} className="px-6 py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition flex items-center gap-2">
                    <Save size={18} /> حفظ واعتماد الوصفة
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}