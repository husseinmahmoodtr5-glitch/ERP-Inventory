import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  FolderTree, Plus, ChevronRight, ChevronDown, Package, 
  Layers, ShieldAlert 
} from 'lucide-react';

// تكييف رابط Supabase والـ Key مع متغيرات مشروعك البيئية
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface InventoryItem {
  id: string;
  code: string;
  name: string;
  type: 'category' | 'raw_material' | 'finished_product' | 'spare_part' | 'consumable' | 'service';
  unit: string;
  parent_id: string | null;
  qc_required: boolean;
  min_stock: number;
  cost_price: number;
  is_active: boolean;
}

export default function InventoryTree() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);

  // نموذج الإضافة الجديد
  const [newItem, setNewItem] = useState({
    code: '',
    name: '',
    type: 'raw_material',
    unit: 'كجم',
    parent_id: '',
    qc_required: false,
    min_stock: 0,
    cost_price: 0
  });

  useEffect(() => {
    fetchTreeData();
  }, []);

  const fetchTreeData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory_tree')
      .select('*')
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (!error && data) {
      setItems(data);
    }
    setLoading(false);
  };

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...newItem,
      parent_id: newItem.parent_id === '' ? null : newItem.parent_id
    };

    const { error } = await supabase.from('inventory_tree').insert([payload]);

    if (!error) {
      setShowModal(false);
      fetchTreeData(); // تحديث الشجرة بعد الإضافة
    } else {
      alert('حدث خطأ أثناء الإضافة: ' + error.message);
    }
  };

  // دالة لفتح نافذة إضافة بند رئيسي جديد وتصفير البيانات
  const openNewMainCategoryModal = () => {
    setNewItem({
      code: '',
      name: '',
      type: 'category',
      unit: '',
      parent_id: '',
      qc_required: false,
      min_stock: 0,
      cost_price: 0
    });
    setShowModal(true);
  };

  // دالة لفتح نافذة إضافة فرع تابع وتحديد الأب تلقائياً
  const openNewBranchModal = (parentId: string) => {
    setNewItem({
      code: '',
      name: '',
      type: 'raw_material',
      unit: 'كجم',
      parent_id: parentId,
      qc_required: false,
      min_stock: 0,
      cost_price: 0
    });
    setShowModal(true);
  };

  // المساعدة في عرض الأيقونات حسب النوع
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'category': return <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-md font-semibold">فئة رئيسية</span>;
      case 'raw_material': return <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-md font-semibold">مادة خام</span>;
      case 'finished_product': return <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded-md font-semibold">منتج تام</span>;
      case 'spare_part': return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md font-semibold">قطعة غيار</span>;
      case 'consumable': return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-md font-semibold">مادة استهلاكية</span>;
      default: return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-md font-semibold">{type}</span>;
    }
  };

  // بناء العرض الشجري التكراري
  const renderTree = (parentId: string | null = null, level = 0) => {
    const children = items.filter(item => item.parent_id === parentId);
    if (children.length === 0) return null;

    return (
      <div className={`space-y-2 ${level > 0 ? 'mr-6 border-r-2 border-slate-200 pr-3 my-1' : ''}`}>
        {children.map(item => {
          const hasChildren = items.some(child => child.parent_id === item.id);
          const isExpanded = expandedNodes[item.id];

          return (
            <div key={item.id} className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:border-slate-300 transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {hasChildren ? (
                    <button onClick={() => toggleNode(item.id)} className="p-1 text-slate-500 hover:bg-slate-100 rounded">
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  ) : (
                    <div className="w-6" />
                  )}

                  <div className="p-2 bg-slate-50 rounded-md text-slate-700">
                    {item.type === 'category' ? <FolderTree size={20} className="text-purple-600" /> : <Package size={20} className="text-blue-600" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{item.name}</span>
                      <span className="text-xs text-slate-400 font-mono" dir="ltr">[{item.code}]</span>
                      {getTypeBadge(item.type)}
                      {item.qc_required && (
                        <span className="flex items-center gap-1 text-xs bg-rose-50 text-rose-600 px-2 py-0.5 rounded border border-rose-200">
                          <ShieldAlert size={12} /> فحص مختبري
                        </span>
                      )}
                    </div>
                    {item.type !== 'category' && (
                      <div className="text-xs text-slate-500 mt-1 flex gap-4">
                        <span>وحدة القياس: <b>{item.unit}</b></span>
                        <span>الحد الأدنى: <b>{item.min_stock}</b></span>
                       <span>التكلفة التقديرية: <b>{item.cost_price.toLocaleString()} د.ع</b></span>
                      </div>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => openNewBranchModal(item.id)}
                  className="text-xs flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded transition"
                >
                  <Plus size={14} /> إضافة فرع
                </button>
              </div>

              {isExpanded && renderTree(item.id, level + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div dir="rtl" className="p-6 bg-slate-50 min-h-screen font-sans">
      {/* الهيدر الأعلـى */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FolderTree className="text-blue-600" /> شجرة المخزون والهيكل التصنيعي
          </h1>
          <p className="text-sm text-slate-500 mt-1">إدارة وتقسيم المواد الخام، المنتجات التامة، وقطع الغيار بشكل شجري متعدد المستويات.</p>
        </div>

        <button 
          onClick={openNewMainCategoryModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm transition"
        >
          <Plus size={18} /> إضافة بند رئيسي جديد
        </button>
      </div>

      {/* منطقة عرض الشجرة */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">جاري تحميل شجرة المخزون...</div>
      ) : items.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-12 text-center">
          <Layers size={48} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-600 font-medium">لا توجد مواد أو فئات في شجرة المخزون حتى الآن.</p>
          <button 
            onClick={openNewMainCategoryModal}
            className="mt-4 bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            إضافة أول فئة للمخزن
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {renderTree(null)}
        </div>
      )}

      {/* نافذة الإضافة (Modal) */}
      {showModal && (
        <div dir="rtl" className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-3">
              <Plus className="text-blue-600" /> إضافة بند جديد إلى الشجرة
            </h3>

            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">اسم المادة / الفئة *</label>
                <input 
                  type="text" 
                  required
                  placeholder="مثال: نحاس أصفر، كيبل 4 ملم، قسم قطع الغيار"
                  value={newItem.name}
                  onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">الكود / الباركود *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="مثال: RAW-001"
                    value={newItem.code}
                    onChange={e => setNewItem({ ...newItem, code: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">النوع *</label>
                  <select 
                    value={newItem.type}
                    onChange={e => setNewItem({ ...newItem, type: e.target.value as any })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="category">فئة رئيسية (مجلد)</option>
                    <option value="raw_material">مادة خام</option>
                    <option value="finished_product">منتج تام الصنع</option>
                    <option value="spare_part">قطعة غيار</option>
                    <option value="consumable">مادة استهلاكية</option>
                  </select>
                </div>
              </div>

              {newItem.type !== 'category' && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">وحدة القياس</label>
                      <input 
                        type="text" 
                        placeholder="كجم، متر، حبة..."
                        value={newItem.unit}
                        onChange={e => setNewItem({ ...newItem, unit: e.target.value })}
                        className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">الحد الأدنى</label>
                      <input 
                        type="number" 
                        value={newItem.min_stock}
                        onChange={e => setNewItem({ ...newItem, min_stock: Number(e.target.value) })}
                        className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">التكلفة التقديرية</label>
                      <input 
                        type="number" 
                        step="0.001"
                        value={newItem.cost_price}
                        onChange={e => setNewItem({ ...newItem, cost_price: Number(e.target.value) })}
                        className="w-full border border-slate-300 rounded-lg p-2 text-sm outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 p-3 rounded-lg mt-2">
                    <input 
                      type="checkbox"
                      id="qc_check"
                      checked={newItem.qc_required}
                      onChange={e => setNewItem({ ...newItem, qc_required: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <label htmlFor="qc_check" className="text-xs font-semibold text-amber-900 cursor-pointer">
                      تطلب فحص جودة مختبري (QC) قبل الدخول للمخزن أو الاستخدام
                    </label>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 border-t pt-4 mt-6">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition"
                >
                  حفظ في الشجرة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}