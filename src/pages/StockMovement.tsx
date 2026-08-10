import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  ArrowDownLeft, ArrowUpRight, Scale, ListCheck, Printer, 
  FileSpreadsheet, Search, Edit, Trash2, X, FileText, Filter,
  FolderTree, Plus, ChevronRight, ChevronDown, Package, Layers, ShieldAlert
} from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Movement {
  id: string;
  date: string;
  type: 'IN' | 'OUT';
  item_name: string;
  quantity: number;
  unit: string;
  doc_number?: string;
  qc_status?: string;
  notes?: string;
}

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

export default function StockMovement() {
  const [activeView, setActiveView] = useState<'MOVEMENTS' | 'TREE'>('MOVEMENTS');

  // --- States ---
  const [movements, setMovements] = useState<Movement[]>([]);
  const [treeItems, setTreeItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Movement States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [materialFilter, setMaterialFilter] = useState<string>('ALL');
  const [showMoveModal, setShowMoveModal] = useState<boolean>(false);
  const [isEditingMove, setIsEditingMove] = useState<boolean>(false);
  const [editMoveId, setEditMoveId] = useState<string>('');
  const [activeVoucher, setActiveVoucher] = useState<Movement | null>(null);

  // Tree States
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [showTreeModal, setShowTreeModal] = useState<boolean>(false);
  const [isEditingTree, setIsEditingTree] = useState<boolean>(false);
  const [editTreeId, setEditTreeId] = useState<string>('');

  // Forms Data
  const [moveFormData, setMoveFormData] = useState<Omit<Movement, 'id'>>({
    date: new Date().toISOString().split('T')[0],
    type: 'IN', item_name: '', quantity: 0, unit: 'كجم', doc_number: '', qc_status: 'مقبول (مطابق)', notes: ''
  });

  const [treeFormData, setTreeFormData] = useState({
    code: '', name: '', type: 'raw_material', unit: 'كجم', parent_id: '', qc_required: false, min_stock: 0, cost_price: 0
  });

  // --- Fetch Data ---
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // جلب الحركات
    try {
      const { data: movData } = await supabase.from('inventory_movements').select('*').order('date', { ascending: false });
      if (movData) setMovements(movData as Movement[]);
      else {
        const local = localStorage.getItem('app_inventory_movements');
        if (local) setMovements(JSON.parse(local));
      }
    } catch {
      const local = localStorage.getItem('app_inventory_movements');
      if (local) setMovements(JSON.parse(local));
    }

    // جلب الشجرة (جميع العناصر بما فيها الفئات)
    try {
      const { data: tData } = await supabase.from('inventory_tree').select('*').eq('is_active', true).order('code', { ascending: true });
      if (tData) setTreeItems(tData as InventoryItem[]);
    } catch {
      console.log('تعذر جلب عناصر الشجرة');
    }
    setLoading(false);
  };

  // ==========================================
  // --- Movement Functions ---
  // ==========================================
  const saveToLocalAndDB = (updatedList: Movement[]) => {
    setMovements(updatedList);
    localStorage.setItem('app_inventory_movements', JSON.stringify(updatedList));
  };

  const getItemStock = (itemName: string) => {
    const itemIn = movements.filter(m => m.item_name === itemName && m.type === 'IN').reduce((acc, c) => acc + Number(c.quantity), 0);
    const itemOut = movements.filter(m => m.item_name === itemName && m.type === 'OUT').reduce((acc, c) => acc + Number(c.quantity), 0);
    return itemIn - itemOut;
  };

  const openNewMoveModal = (type: 'IN' | 'OUT') => {
    setIsEditingMove(false);
    setEditMoveId('');
    const selectableItems = treeItems.filter(item => item.type !== 'category');
    const defaultItem = selectableItems.length > 0 ? selectableItems[0].name : '';
    const defaultUnit = selectableItems.length > 0 ? selectableItems[0].unit : 'كجم';

    setMoveFormData({
      date: new Date().toISOString().split('T')[0],
      type: type, item_name: defaultItem, quantity: 0, unit: defaultUnit, doc_number: '', qc_status: 'مقبول (مطابق)', notes: ''
    });
    setShowMoveModal(true);
  };

  const openEditMoveModal = (item: Movement) => {
    setIsEditingMove(true);
    setEditMoveId(item.id);
    setMoveFormData({
      date: item.date, type: item.type, item_name: item.item_name, quantity: item.quantity, 
      unit: item.unit, doc_number: item.doc_number || '', qc_status: item.qc_status || 'مقبول (مطابق)', notes: item.notes || ''
    });
    setShowMoveModal(true);
  };

  const handleItemSelect = (selectedName: string) => {
    const found = treeItems.find(t => t.name === selectedName);
    setMoveFormData(prev => ({ ...prev, item_name: selectedName, unit: found && found.unit ? found.unit : prev.unit }));
  };

  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveFormData.item_name.trim()) return alert('يرجى اختيار المادة');
    if (moveFormData.quantity <= 0) return alert('يرجى إدخال كمية أكبر من صفر');

    if (moveFormData.type === 'OUT' && !isEditingMove) {
      const currentStock = getItemStock(moveFormData.item_name);
      if (moveFormData.quantity > currentStock) {
        alert(`عذراً، الرصيد المتوفر لمادة "${moveFormData.item_name}" هو (${currentStock.toLocaleString()} ${moveFormData.unit}) فقط!`);
        return;
      }
    }

    if (isEditingMove) {
      await supabase.from('inventory_movements').update(moveFormData).eq('id', editMoveId);
      const updated = movements.map(m => m.id === editMoveId ? { ...moveFormData, id: editMoveId } : m);
      saveToLocalAndDB(updated);
    } else {
      const newRecord: Movement = { id: Date.now().toString(), ...moveFormData };
      await supabase.from('inventory_movements').insert([newRecord]);
      saveToLocalAndDB([newRecord, ...movements]);
    }
    setShowMoveModal(false);
  };

  const handleMoveDelete = async (id: string, name: string) => {
    if (window.confirm(`هل أنت متأكد من حذف حركة المادة "${name}"؟`)) {
      await supabase.from('inventory_movements').delete().eq('id', id);
      const updated = movements.filter(m => m.id !== id);
      saveToLocalAndDB(updated);
    }
  };

  // ==========================================
  // --- Tree Functions ---
  // ==========================================
  const toggleNode = (id: string) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const openNewCategoryModal = () => {
    setIsEditingTree(false);
    setTreeFormData({ code: '', name: '', type: 'category', unit: '', parent_id: '', qc_required: false, min_stock: 0, cost_price: 0 });
    setShowTreeModal(true);
  };

  const openNewBranchModal = (parentId: string) => {
    setIsEditingTree(false);
    setTreeFormData({ code: '', name: '', type: 'raw_material', unit: 'كجم', parent_id: parentId, qc_required: false, min_stock: 0, cost_price: 0 });
    setShowTreeModal(true);
  };

  const openEditTreeModal = (item: InventoryItem) => {
    setIsEditingTree(true);
    setEditTreeId(item.id);
    setTreeFormData({
      code: item.code, name: item.name, type: item.type, unit: item.unit, 
      parent_id: item.parent_id || '', qc_required: item.qc_required, 
      min_stock: item.min_stock, cost_price: item.cost_price
    });
    setShowTreeModal(true);
  };

  const handleTreeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...treeFormData, parent_id: treeFormData.parent_id === '' ? null : treeFormData.parent_id };
    
    if (isEditingTree) {
      await supabase.from('inventory_tree').update(payload).eq('id', editTreeId);
    } else {
      await supabase.from('inventory_tree').insert([payload]);
    }
    setShowTreeModal(false);
    fetchData(); 
  };

  const handleTreeDelete = async (id: string, name: string) => {
    const hasChildren = treeItems.some(child => child.parent_id === id);
    if (hasChildren) {
      alert(`عذراً، لا يمكن حذف "${name}" لأنه يحتوي على مواد داخله. احذف الفروع أولاً.`);
      return;
    }
    if (window.confirm(`هل أنت متأكد من حذف "${name}" نهائياً؟`)) {
      await supabase.from('inventory_tree').delete().eq('id', id);
      fetchData();
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'category': return <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-md font-semibold">فئة رئيسية</span>;
      case 'raw_material': return <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-md font-semibold">مادة خام</span>;
      case 'finished_product': return <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs rounded-md font-semibold">منتج تام</span>;
      default: return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-md font-semibold">{type}</span>;
    }
  };

  const renderTree = (parentId: string | null = null, level = 0) => {
    const children = treeItems.filter(item => item.parent_id === parentId);
    if (children.length === 0) return null;

    return (
      <div className={`space-y-2 ${level > 0 ? 'mr-6 border-r-2 border-slate-200 pr-3 my-1' : ''}`}>
        {children.map(item => {
          const hasChildren = treeItems.some(child => child.parent_id === item.id);
          const isExpanded = expandedNodes[item.id];

          return (
            <div key={item.id} className="bg-white rounded-lg border border-slate-200 p-3 shadow-sm hover:border-slate-300 transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {hasChildren ? (
                    <button onClick={() => toggleNode(item.id)} className="p-1 text-slate-500 hover:bg-slate-100 rounded">
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                  ) : <div className="w-6" />}

                  <div className="p-2 bg-slate-50 rounded-md text-slate-700">
                    {item.type === 'category' ? <FolderTree size={20} className="text-purple-600" /> : <Package size={20} className="text-blue-600" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{item.name}</span>
                      <span className="text-xs text-slate-400 font-mono">[{item.code}]</span>
                      {getTypeBadge(item.type)}
                      {item.qc_required && (
                        <span className="flex items-center gap-1 text-xs bg-rose-50 text-rose-600 px-2 py-0.5 rounded border border-rose-200">
                          <ShieldAlert size={12} /> فحص مختبري
                        </span>
                      )}
                    </div>
                    {item.type !== 'category' && (
                      <div className="text-xs text-slate-500 mt-1 flex gap-4">
                        <span>الوحدة: <b>{item.unit}</b></span>
                        <span>الرصيد المتوفر: <b className="text-emerald-600">{getItemStock(item.name).toLocaleString()}</b></span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {item.type === 'category' && (
                    <button onClick={() => openNewBranchModal(item.id)} className="text-xs flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1.5 rounded transition font-medium"><Plus size={14} /> إضافة فرع</button>
                  )}
                  <button onClick={() => openEditTreeModal(item)} className="text-xs flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1.5 rounded transition font-medium"><Edit size={14} /> تعديل</button>
                  <button onClick={() => handleTreeDelete(item.id, item.name)} className="text-xs flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 px-2 py-1.5 rounded transition font-medium"><Trash2 size={14} /> حذف</button>
                </div>
              </div>
              {isExpanded && renderTree(item.id, level + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  // ==========================================
  // --- Calculations for UI ---
  // ==========================================
  const uniqueMaterials = Array.from(new Set(movements.map(m => m.item_name))).filter(Boolean);
  const filteredMovements = movements.filter(m => {
    const matchesType = filterType === 'ALL' || m.type === filterType;
    const matchesMaterial = materialFilter === 'ALL' || m.item_name === materialFilter;
    const query = searchQuery.toLowerCase();
    const matchesSearch = (m.item_name?.toLowerCase().includes(query)) || (m.doc_number?.toLowerCase().includes(query)) || (m.notes?.toLowerCase().includes(query));
    return matchesType && matchesMaterial && matchesSearch;
  });

  const displayIn = filteredMovements.filter(m => m.type === 'IN').reduce((acc, curr) => acc + Number(curr.quantity), 0);
  const displayOut = filteredMovements.filter(m => m.type === 'OUT').reduce((acc, curr) => acc + Number(curr.quantity), 0);
  const displayNet = displayIn - displayOut;

  const exportToCSV = () => {
    if (filteredMovements.length === 0) return alert('لا توجد بيانات لتصديرها');
    let csv = '\uFEFFالتاريخ,نوع الحركة,اسم المادة,الكمية,الوحدة,رقم المستند,فحص الجودة,الملاحظات\n';
    filteredMovements.forEach(m => {
      csv += `${m.date},${m.type === 'IN' ? 'وارد' : 'صادر'},"${m.item_name}",${m.quantity},${m.unit},"${m.doc_number || ''}","${m.qc_status || ''}","${m.notes || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `حركة_المخزن_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div dir="rtl" className="p-6 bg-slate-50 min-h-screen font-sans pb-24">
      
      {/* قسم طباعة الوصل */}
      {activeVoucher && (
        <div className="hidden print:block p-8 bg-white text-black font-sans">
          <div className="border-2 border-black p-6 rounded-lg">
            <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold">مصنع الكابلات والأسلاك الكهربائية</h1>
                <p className="text-sm">قسم إدارة المخازن والجودة</p>
              </div>
              <div className="text-left">
                <h2 className="text-xl font-bold border-2 border-black px-4 py-1 inline-block rounded">
                  {activeVoucher.type === 'IN' ? 'إذن إدخال مخزني (وارد)' : 'إذن صرف مخزني (صادر)'}
                </h2>
                <p className="text-xs mt-1 font-mono">رقم المستند: {activeVoucher.doc_number || activeVoucher.id}</p>
                <p className="text-xs font-mono">التاريخ: {activeVoucher.date}</p>
              </div>
            </div>
            <table className="w-full border-collapse border border-black mb-6 text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-black p-2">اسم المادة</th>
                  <th className="border border-black p-2">الكمية المسجلة</th>
                  <th className="border border-black p-2">وحدة القياس</th>
                  <th className="border border-black p-2">فحص الجودة (QC)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black p-3 font-bold text-center">{activeVoucher.item_name}</td>
                  <td className="border border-black p-3 font-bold text-center">{Number(activeVoucher.quantity).toLocaleString()}</td>
                  <td className="border border-black p-3 text-center">{activeVoucher.unit}</td>
                  <td className="border border-black p-3 text-center">{activeVoucher.qc_status}</td>
                </tr>
              </tbody>
            </table>
            {activeVoucher.notes && <div className="mb-6 border border-black p-3 text-sm"><b>ملاحظات:</b> {activeVoucher.notes}</div>}
          </div>
        </div>
      )}

      <div className="print:hidden">
        
        {/* أزرار التبديل العلوية (التصميم الزجاجي الأنيق) */}
        <div className="flex justify-center mb-8 relative z-10">
          <div className="bg-white/40 backdrop-blur-xl border border-white/60 p-1.5 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.04)] inline-flex gap-1">
            <button
              onClick={() => setActiveView('MOVEMENTS')}
              className={`px-8 py-2.5 rounded-full text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
                activeView === 'MOVEMENTS' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-slate-500 hover:text-blue-600 hover:bg-white/50'
              }`}
            >
              <ListCheck size={18} /> سجل حركات المخزن
            </button>
            <button
              onClick={() => setActiveView('TREE')}
              className={`px-8 py-2.5 rounded-full text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
                activeView === 'TREE' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-slate-500 hover:text-blue-600 hover:bg-white/50'
              }`}
            >
              <FolderTree size={18} /> الهيكل الشجري للمواد
            </button>
          </div>
        </div>

        {/* ========================================= */}
        {/* واجهة سجل الحركات */}
        {/* ========================================= */}
        {activeView === 'MOVEMENTS' && (
          <div className="animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">سجل حركات المخزون</h1>
                <p className="text-sm text-slate-500 mt-1">تسجيل الوارد والصادر ومتابعة الأرصدة وفحوصات الجودة.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => openNewMoveModal('IN')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm transition"><ArrowDownLeft size={18} /> وارد جديد</button>
                <button onClick={() => openNewMoveModal('OUT')} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm transition"><ArrowUpRight size={18} /> صادر جديد</button>
                <button onClick={exportToCSV} className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-3 py-2 rounded-lg font-medium flex items-center gap-2 transition"><FileSpreadsheet size={18} className="text-emerald-600" /> CSV</button>
                <button onClick={() => { setActiveVoucher(null); setTimeout(() => window.print(), 100); }} className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-3 py-2 rounded-lg font-medium flex items-center gap-2 transition"><Printer size={18} className="text-blue-600" /> طباعة التقرير</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                <div><p className="text-xs text-slate-500 font-semibold mb-1">إجمالي الوارد العام</p><p className="text-xl font-bold text-emerald-600">{displayIn.toLocaleString()} <span className="text-xs font-normal">وحدة</span></p></div>
                <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600"><ArrowDownLeft size={22} /></div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                <div><p className="text-xs text-slate-500 font-semibold mb-1">إجمالي الصادر العام</p><p className="text-xl font-bold text-rose-600">{displayOut.toLocaleString()} <span className="text-xs font-normal">وحدة</span></p></div>
                <div className="p-3 bg-rose-50 rounded-lg text-rose-600"><ArrowUpRight size={22} /></div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                <div><p className="text-xs text-slate-500 font-semibold mb-1">صافي الرصيد الحالي</p><p className="text-xl font-bold text-blue-600">{displayNet.toLocaleString()} <span className="text-xs font-normal">وحدة</span></p></div>
                <div className="p-3 bg-blue-50 rounded-lg text-blue-600"><Scale size={22} /></div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                <div><p className="text-xs text-slate-500 font-semibold mb-1">الحركات المعروضة</p><p className="text-xl font-bold text-purple-600">{filteredMovements.length} <span className="text-xs font-normal">عملية</span></p></div>
                <div className="p-3 bg-purple-50 rounded-lg text-purple-600"><ListCheck size={22} /></div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row justify-between gap-4">
              <div className="relative flex-1">
                <Search size={18} className="absolute right-3 top-3 text-slate-400" />
                <input type="text" placeholder="ابحث برقم المستند أو الملاحظات..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pr-10 pl-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"/>
              </div>
              <div className="flex-1 flex items-center relative">
                <Filter size={18} className="absolute right-3 text-slate-400 pointer-events-none" />
                <select value={materialFilter} onChange={e => setMaterialFilter(e.target.value)} className="w-full pr-10 pl-4 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none font-semibold text-slate-700 cursor-pointer">
                  <option value="ALL">جميع المواد (عرض الكل)</option>
                  {uniqueMaterials.map(mat => <option key={mat} value={mat}>{mat}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setFilterType('ALL')} className={`px-4 py-2 text-xs font-bold rounded-lg transition ${filterType === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>الكل</button>
                <button onClick={() => setFilterType('IN')} className={`px-4 py-2 text-xs font-bold rounded-lg transition ${filterType === 'IN' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>الوارد فقط</button>
                <button onClick={() => setFilterType('OUT')} className={`px-4 py-2 text-xs font-bold rounded-lg transition ${filterType === 'OUT' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>الصادر فقط</button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">نوع الحركة</th>
                      <th className="p-3">اسم المادة</th>
                      <th className="p-3 text-center">الكمية</th>
                      <th className="p-3">رقم المستند / الإذن</th>
                      <th className="p-3">فحص الجودة (QC)</th>
                      <th className="p-3">الملاحظات</th>
                      <th className="p-3 text-center">الإجراءات والوصل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? <tr><td colSpan={8} className="p-8 text-center text-slate-400">جاري التحميل...</td></tr> : 
                     filteredMovements.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-slate-400">لا توجد حركات مخزنية</td></tr> : 
                     filteredMovements.map(m => (
                      <tr key={m.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 text-slate-600 font-mono text-xs">{m.date}</td>
                        <td className="p-3">{m.type === 'IN' ? <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded font-semibold"><ArrowDownLeft size={14} /> وارد</span> : <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-xs px-2 py-0.5 rounded font-semibold"><ArrowUpRight size={14} /> صادر</span>}</td>
                        <td className="p-3 font-bold text-slate-800">{m.item_name}</td>
                        <td className="p-3 text-center font-bold text-slate-900">{Number(m.quantity).toLocaleString()} <span className="text-xs text-slate-500 font-normal">{m.unit}</span></td>
                        <td className="p-3 text-slate-600 font-mono text-xs">{m.doc_number || '-'}</td>
                        <td className="p-3"><span className="text-xs px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700">{m.qc_status}</span></td>
                        <td className="p-3 text-slate-500 text-xs truncate max-w-xs">{m.notes || '-'}</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => printVoucher(m)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"><FileText size={16} /></button>
                            <button onClick={() => openEditMoveModal(m)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit size={16} /></button>
                            <button onClick={() => handleMoveDelete(m.id, m.item_name)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================= */}
        {/* واجهة الهيكل الشجري */}
        {/* ========================================= */}
        {activeView === 'TREE' && (
          <div className="animate-fade-in">
             <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <FolderTree className="text-blue-600" /> الهيكل الشجري وتصنيف المواد
                  </h1>
                  <p className="text-sm text-slate-500 mt-1">إدارة الفئات، المواد الخام، والمنتجات بشكل متسلسل.</p>
                </div>
                <button onClick={openNewCategoryModal} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm transition">
                  <Plus size={18} /> إضافة فئة رئيسية
                </button>
             </div>

             {loading ? (
                <div className="text-center py-12 text-slate-500">جاري التحميل...</div>
             ) : treeItems.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-12 text-center">
                  <Layers size={48} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-600 font-medium">الشجرة فارغة. ابدأ بإضافة فئة.</p>
                  <button onClick={openNewCategoryModal} className="mt-4 bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-sm font-semibold">إضافة فئة الآن</button>
                </div>
             ) : (
                <div className="bg-slate-50 p-2">
                  {renderTree(null)}
                </div>
             )}
          </div>
        )}

        {/* --- المودال الخاص بالحركات --- */}
        {showMoveModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
              <div className="flex justify-between items-center border-b pb-3 mb-4">
                <h3 className="text-lg font-bold text-slate-800">{isEditingMove ? 'تعديل حركة' : moveFormData.type === 'IN' ? 'تسجيل وارد جديد' : 'تسجيل صادر جديد'}</h3>
                <button onClick={() => setShowMoveModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>
              <form onSubmit={handleMoveSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">نوع الحركة</label>
                    <select value={moveFormData.type} onChange={e => setMoveFormData({ ...moveFormData, type: e.target.value as any })} className="w-full border rounded-lg p-2 text-sm bg-white">
                      <option value="IN">وارد</option>
                      <option value="OUT">صادر</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">التاريخ</label>
                    <input type="date" required value={moveFormData.date} onChange={e => setMoveFormData({ ...moveFormData, date: e.target.value })} className="w-full border rounded-lg p-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">اختر المادة (مفلترة بدون الفئات)</label>
                  <select value={moveFormData.item_name} onChange={e => handleItemSelect(e.target.value)} className="w-full border rounded-lg p-2 text-sm bg-white font-bold">
                    {treeItems.filter(i => i.type !== 'category').map(item => (
                      <option key={item.id} value={item.name}>{item.name} [{item.code}]</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">الكمية</label>
                    <input type="number" step="0.001" required value={moveFormData.quantity} onChange={e => setMoveFormData({ ...moveFormData, quantity: Number(e.target.value) })} className="w-full border rounded-lg p-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">الوحدة</label>
                    <input type="text" readOnly value={moveFormData.unit} className="w-full border rounded-lg p-2 text-sm bg-slate-50 text-slate-500 cursor-not-allowed" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">الملاحظات</label>
                  <textarea rows={2} value={moveFormData.notes} onChange={e => setMoveFormData({ ...moveFormData, notes: e.target.value })} className="w-full border rounded-lg p-2 text-sm" />
                </div>
                <div className="flex justify-end gap-2 border-t pt-4">
                  <button type="button" onClick={() => setShowMoveModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">إلغاء</button>
                  <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">حفظ</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- المودال الخاص بالشجرة --- */}
        {showTreeModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
              <div className="flex justify-between items-center border-b pb-3 mb-4">
                <h3 className="text-lg font-bold text-slate-800">{isEditingTree ? 'تعديل بيانات البند' : 'إضافة بند جديد إلى الشجرة'}</h3>
                <button onClick={() => setShowTreeModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>
              <form onSubmit={handleTreeSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">اسم المادة / الفئة *</label>
                  <input type="text" required value={treeFormData.name} onChange={e => setTreeFormData({ ...treeFormData, name: e.target.value })} className="w-full border rounded-lg p-2 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">الكود / الباركود *</label>
                    <input type="text" required value={treeFormData.code} onChange={e => setTreeFormData({ ...treeFormData, code: e.target.value })} className="w-full border rounded-lg p-2 text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">النوع *</label>
                    <select value={treeFormData.type} onChange={e => setTreeFormData({ ...treeFormData, type: e.target.value as any })} className="w-full border rounded-lg p-2 text-sm bg-white">
                      <option value="category">فئة رئيسية (مجلد)</option>
                      <option value="raw_material">مادة خام</option>
                      <option value="finished_product">منتج تام الصنع</option>
                      <option value="spare_part">قطعة غيار</option>
                      <option value="consumable">مادة استهلاكية</option>
                    </select>
                  </div>
                </div>
                {treeFormData.type !== 'category' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">وحدة القياس</label>
                      <input type="text" value={treeFormData.unit} onChange={e => setTreeFormData({ ...treeFormData, unit: e.target.value })} className="w-full border rounded-lg p-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">الحد الأدنى للرصيد</label>
                      <input type="number" value={treeFormData.min_stock} onChange={e => setTreeFormData({ ...treeFormData, min_stock: Number(e.target.value) })} className="w-full border rounded-lg p-2 text-sm" />
                    </div>
                  </div>
                )}
                {treeFormData.type !== 'category' && (
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 p-3 rounded-lg mt-2">
                    <input type="checkbox" id="qc_check" checked={treeFormData.qc_required} onChange={e => setTreeFormData({ ...treeFormData, qc_required: e.target.checked })} className="w-4 h-4 text-blue-600 rounded"/>
                    <label htmlFor="qc_check" className="text-xs font-semibold text-amber-900 cursor-pointer">تطلب فحص جودة (QC)</label>
                  </div>
                )}
                <div className="flex justify-end gap-2 border-t pt-4 mt-6">
                  <button type="button" onClick={() => setShowTreeModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">إلغاء</button>
                  <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg">حفظ في الشجرة</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}