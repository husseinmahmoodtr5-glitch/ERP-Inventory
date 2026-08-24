import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  ArrowDownLeft, ArrowUpRight, Scale, ListCheck, Printer, 
  Search, Edit, Trash2, X, FileText, Filter,
  FolderTree, Plus, ChevronRight, ChevronDown, Package, Layers, ShieldAlert,
  ChevronDown as DropdownIcon, CalendarDays, LineChart, Bell, CheckCircle2, Ban
} from 'lucide-react';

// ==========================================
// --- إعدادات الاتصال بقاعدة البيانات ---
// ==========================================
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

// ==========================================
// --- TypeScript Interfaces ---
// ==========================================
interface Warehouse { id: number; warehouse_code: string; warehouse_name: string; }
interface Material { 
  id: number; material_code: string; warehouse_code: string; warehouse_name: string; 
  material_name: string; unit: string; qc_required: boolean; min_stock: number; cost_price: number; 
}
interface UnifiedMovement {
  ui_id: string; real_id: number; type: 'IN' | 'OUT'; date: string; warehouse_name: string;
  material_name: string; quantity: number; reels: number; unit: string;
  notes: string; qc_status: string; doc_number: string;
}

// واجهة الإشعارات الواردة لقسم المخازن
interface WarehouseNotification {
  id: number;
  message: string;
  reference: string;
  material_name: string;
  requested_qty: number;
  isRead: boolean;
  date: string;
}

// ==========================================
// --- القائمة المنسدلة النظيفة والسريعة (محصنة) ---
// ==========================================
const SearchableSelect = ({ 
  options = [], value, onChange, placeholder, disabled = false 
}: { 
  options: string[], value: string, onChange: (val: string) => void, placeholder: string, disabled?: boolean 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const safeOptions = Array.isArray(options) ? options : [];
  const filteredOptions = safeOptions.filter(opt => (opt || '').toLowerCase().includes((searchTerm || '').toLowerCase()));

  return (
    <div ref={wrapperRef} className={`relative w-full ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div 
        className="flex items-center justify-between w-full border border-slate-300 rounded-lg p-2 text-sm bg-white focus-within:ring-2 focus-within:ring-blue-500 cursor-pointer"
        onClick={() => setIsOpen(true)}
      >
        <input
          type="text"
          className="w-full outline-none bg-transparent text-slate-800 font-bold cursor-pointer"
          placeholder={placeholder}
          value={isOpen ? searchTerm : value}
          onChange={(e) => { setSearchTerm(e.target.value); setIsOpen(true); }}
          onFocus={() => { setSearchTerm(''); setIsOpen(true); }}
          readOnly={!isOpen}
        />
        <DropdownIcon size={16} className={`text-slate-500 transition-transform cursor-pointer ${isOpen ? 'rotate-180' : ''}`} onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} />
      </div>
      {isOpen && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, idx) => (
              <li key={idx} className="px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 cursor-pointer border-b last:border-0"
                onClick={() => { onChange(opt); setIsOpen(false); setSearchTerm(''); }}>
                {opt}
              </li>
            ))
          ) : (
            <li className="px-4 py-2 text-sm text-slate-400 text-center bg-slate-50">لا توجد نتائج</li>
          )}
        </ul>
      )}
    </div>
  );
};

// ==========================================
// --- المكون الرئيسي للمخازن (Quantum Warehouse) ---
// ==========================================
export default function QuantumWarehouse() {
  const [activeView, setActiveView] = useState<'MOVEMENTS' | 'TREE' | 'REPORTS'>('MOVEMENTS');
  const [loading, setLoading] = useState<boolean>(true);

  // --- قواعد البيانات الحية ---
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [movements, setMovements] = useState<UnifiedMovement[]>([]);
  const [liveStock, setLiveStock] = useState<any[]>([]); // 🚀 حفظ الأرصدة الحية من السيرفر

  // --- إعدادات الإشعارات (الجرس 🔔) ---
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<WarehouseNotification[]>([
    { id: 1, message: "يوجد طلب تجهيز من المبيعات لـ 1,000 متر من كابل 3*120+70+16.", reference: "101", material_name: "3*120+70+16", requested_qty: 1000, isRead: false, date: "الآن" },
    { id: 2, message: "يوجد طلب تجهيز من المبيعات لـ 3,000 متر من كابل 120/20.", reference: "103", material_name: "120/20", requested_qty: 3000, isRead: false, date: "قبل 15 دقيقة" }
  ]);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    const handleClickOutsideNotif = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideNotif);
    return () => document.removeEventListener('mousedown', handleClickOutsideNotif);
  }, []);

  // --- حالات الحركات (Movements) ---
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [showMoveModal, setShowMoveModal] = useState<boolean>(false);
  const [isEditingMove, setIsEditingMove] = useState<boolean>(false);
  const [editMoveId, setEditMoveId] = useState<number | null>(null);
  const [editMoveOriginalType, setEditMoveOriginalType] = useState<'IN' | 'OUT' | null>(null);
  const [activeVoucher, setActiveVoucher] = useState<UnifiedMovement | null>(null);

  // --- حالات الشجرة (Tree) ---
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [showTreeModal, setShowTreeModal] = useState<boolean>(false);
  const [isEditingTree, setIsEditingTree] = useState<boolean>(false);
  const [editTreeId, setEditTreeId] = useState<number | null>(null);

  // --- حالات تقارير الجرد (Reports) ---
  const [reportStartDate, setReportStartDate] = useState<string>(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]); 
  const [reportEndDate, setReportEndDate] = useState<string>(new Date().toISOString().split('T')[0]); 
  const [reportWarehouse, setReportWarehouse] = useState<string>('ALL');

  // --- بيانات النماذج (Forms) ---
  const [moveForm, setMoveForm] = useState({
    type: 'IN' as 'IN' | 'OUT', date: new Date().toISOString().split('T')[0],
    warehouse_name: '', material_name: '', quantity: 0, reels: 0,
    doc_number: '', notes: '', qc_status: 'مقبول (مطابق)'
  });

  const [treeForm, setTreeForm] = useState({
    warehouse_name: '', material_name: '', material_code: '', unit: 'كجم',
    qc_required: false, min_stock: 0, cost_price: 0
  });

  // ==========================================
  // --- دوال الإشعارات (التفاعل مع المبيعات) ---
  // ==========================================
  const handleApproveRequest = (notif: WarehouseNotification) => {
    setNotifications(notifications.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
    setIsNotifOpen(false);

    setIsEditingMove(false);
    setEditMoveId(null);
    setEditMoveOriginalType(null);
    setMoveForm({
      type: 'OUT',
      date: new Date().toISOString().split('T')[0],
      warehouse_name: '', 
      material_name: notif.material_name,
      quantity: notif.requested_qty,
      reels: 0,
      doc_number: '',
      notes: `تجهيز آلي لطلبية المبيعات رقم (${notif.reference})`,
      qc_status: 'مقبول (مطابق)'
    });
    setShowMoveModal(true);
  };

  const handleRejectRequest = (notif: WarehouseNotification) => {
    if(window.confirm('هل أنت متأكد من رفض طلب التجهيز؟ (سيتم إبلاغ قسم المبيعات بالرفض ولن يتم خصم الكمية)')) {
      setNotifications(notifications.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
      setIsNotifOpen(false);
      alert('تم رفض الطلب وإبلاغ قسم المبيعات بنجاح.');
    }
  };

  // ==========================================
  // --- جلب البيانات مع Try-Catch (Data Fetching) ---
  // ==========================================
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      // 🚀 تم دمج جلب الأرصدة الحية من السيرفر لإنهاء اللاج نهائياً
      const [whRes, matRes, inRes, outRes, stockRes] = await Promise.all([
        supabase.from('warehouses').select('*'),
        supabase.from('materials').select('*').order('material_code'),
        supabase.from('inbound').select('*'),
        supabase.from('outbound').select('*'),
        supabase.from('live_stock_view').select('*') // الأرصدة المحسوبة في السيرفر
      ]);

      if (whRes.error) throw whRes.error;
      if (matRes.error) throw matRes.error;
      if (inRes.error) throw inRes.error;
      if (outRes.error) throw outRes.error;
      if (stockRes.error) throw stockRes.error;

      if (whRes.data) setWarehouses(Array.isArray(whRes.data) ? whRes.data : []);
      if (matRes.data) setMaterials(Array.isArray(matRes.data) ? matRes.data : []);
      if (stockRes.data) setLiveStock(Array.isArray(stockRes.data) ? stockRes.data : []);

      const combinedMovements: UnifiedMovement[] = [];
      
      if (Array.isArray(inRes.data)) {
        inRes.data.forEach(item => {
          if (item) combinedMovements.push({
            ui_id: `IN-${item.id}`, real_id: item.id, type: 'IN', date: item.transaction_date,
            warehouse_name: item.warehouse_name, material_name: item.material_name,
            quantity: Number(item.quantity_received) || 0, reels: Number(item.reels_received) || 0, unit: item.unit,
            notes: item.reference_or_notes || '', qc_status: item.qc_status || '-', doc_number: item.entry_number?.toString() || ''
          });
        });
      }

      if (Array.isArray(outRes.data)) {
        outRes.data.forEach(item => {
          if (item) combinedMovements.push({
            ui_id: `OUT-${item.id}`, real_id: item.id, type: 'OUT', date: item.transaction_date,
            warehouse_name: item.warehouse_name, material_name: item.material_name,
            quantity: Number(item.quantity_issued) || 0, reels: Number(item.reels_issued) || 0, unit: item.unit,
            notes: item.notes || '', qc_status: item.qc_status || '-', doc_number: item.entry_number?.toString() || ''
          });
        });
      }

      combinedMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setMovements(combinedMovements);
    } catch (error: any) {
      console.error("Fetch Error:", error);
      alert("حدث خطأ أثناء جلب البيانات من السحابة: " + (error?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  // 🚀 دالة قراءة الرصيد السريعة (بدون المرور بحلقات التكرار المسببة للاج)
  const getMaterialStock = (matName: string) => {
    if (!matName) return 0;
    const stockRecord = liveStock.find(s => s.material_name === matName);
    return stockRecord ? Number(stockRecord.current_balance) : 0;
  };

  // ==========================================
  // --- وظائف الحركات والمحاصنة ضد الأخطاء ---
  // ==========================================
  const openNewMove = (type: 'IN' | 'OUT') => {
    setIsEditingMove(false);
    setEditMoveId(null);
    setEditMoveOriginalType(null);
    setMoveForm({
      type, date: new Date().toISOString().split('T')[0], warehouse_name: '', material_name: '',
      quantity: 0, reels: 0, doc_number: '', notes: '', qc_status: 'مقبول (مطابق)'
    });
    setShowMoveModal(true);
  };

  const openEditMove = (mov: UnifiedMovement) => {
    if (!mov) return;
    setIsEditingMove(true);
    setEditMoveId(mov.real_id);
    setEditMoveOriginalType(mov.type);
    setMoveForm({
      type: mov.type, date: mov.date, warehouse_name: mov.warehouse_name, material_name: mov.material_name,
      quantity: mov.quantity, reels: mov.reels, doc_number: mov.doc_number,
      notes: mov.notes, qc_status: mov.qc_status
    });
    setShowMoveModal(true);
  };

  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveForm.warehouse_name || !moveForm.material_name) return alert("يرجى إكمال الحقول الأساسية.");
    if (moveForm.quantity <= 0) return alert("يرجى إدخال كمية صحيحة أكبر من صفر.");
    if (!supabase) return alert("لا يوجد اتصال بقاعدة البيانات.");

    const safeMaterials = Array.isArray(materials) ? materials : [];
    const safeWarehouses = Array.isArray(warehouses) ? warehouses : [];
    
    const selectedMat = safeMaterials.find(m => m?.material_name === moveForm.material_name);
    
    if (moveForm.type === 'OUT') {
      let currentStock = getMaterialStock(moveForm.material_name);
      if (isEditingMove && editMoveOriginalType === 'OUT') {
        const safeMovements = Array.isArray(movements) ? movements : [];
        const oldMove = safeMovements.find(m => m?.real_id === editMoveId && m?.type === 'OUT');
        if (oldMove) currentStock += (Number(oldMove.quantity) || 0); 
      }
      if (moveForm.quantity > currentStock) {
        return alert(`الرصيد غير كافٍ! المتوفر الفعلي: ${currentStock.toLocaleString()} ${selectedMat?.unit || ''}`);
      }
    }

    // 🚀 التعديل الهام هنا: تم إزالة حقل source و recipient لمنع خطأ قاعدة البيانات
    const payloadInbound = {
      transaction_date: moveForm.date, 
      warehouse_name: moveForm.warehouse_name,
      warehouse_code: safeWarehouses.find(w => w?.warehouse_name === moveForm.warehouse_name)?.warehouse_code || null,
      material_name: moveForm.material_name, 
      material_code: selectedMat?.material_code || null, 
      unit: selectedMat?.unit || null, 
      quantity_received: moveForm.quantity, 
      reels_received: moveForm.reels,
      reference_or_notes: moveForm.notes, 
      qc_status: moveForm.qc_status, 
      entry_number: moveForm.doc_number
    };

    const payloadOutbound = {
      transaction_date: moveForm.date, 
      warehouse_name: moveForm.warehouse_name,
      warehouse_code: safeWarehouses.find(w => w?.warehouse_name === moveForm.warehouse_name)?.warehouse_code || null,
      material_name: moveForm.material_name, 
      material_code: selectedMat?.material_code || null, 
      unit: selectedMat?.unit || null, 
      quantity_issued: moveForm.quantity, 
      reels_issued: moveForm.reels,
      notes: moveForm.notes, 
      qc_status: moveForm.qc_status, 
      entry_number: moveForm.doc_number
    };

    try {
      if (isEditingMove && editMoveId && editMoveOriginalType) {
        const table = editMoveOriginalType === 'IN' ? 'inbound' : 'outbound';
        const payload = editMoveOriginalType === 'IN' ? payloadInbound : payloadOutbound;
        const { error } = await supabase.from(table).update(payload).eq('id', editMoveId);
        if (error) throw error;
      } else {
        if (moveForm.type === 'IN') {
          const { error } = await supabase.from('inbound').insert([payloadInbound]);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('outbound').insert([payloadOutbound]);
          if (error) throw error;
          
          // 🚀 إشعار للمحاسبة والمبيعات (محاكاة)
          setTimeout(() => {
            alert(`✅ تم الصرف واعتماد الخصم من المخزن بنجاح!\n\nتم إرسال إشعار آلي لـ "قسم المحاسبة" لإثبات القيد، وإشعار لـ "المبيعات" لتأكيد التجهيز.`);
          }, 300);
        }
      }
      setShowMoveModal(false);
      fetchAllData();
    } catch (error: any) {
      alert("خطأ أثناء حفظ الحركة في السحابة: " + (error?.message || ""));
    }
  };

  const handleDeleteMove = async (mov: UnifiedMovement) => {
    if (!mov || !supabase) return;
    if (window.confirm(`هل أنت متأكد من حذف هذه الحركة (${mov.material_name}) نهائياً؟`)) {
      try {
        const table = mov.type === 'IN' ? 'inbound' : 'outbound';
        const { error } = await supabase.from(table).delete().eq('id', mov.real_id);
        if (error) throw error;
        fetchAllData();
      } catch (error: any) {
        alert("خطأ أثناء الحذف: " + (error?.message || ""));
      }
    }
  };

  // ==========================================
  // --- وظائف الشجرة والمواد (Tree CRUD) ---
  // ==========================================
  const toggleNode = (name: string) => setExpandedNodes(prev => ({ ...prev, [name]: !prev[name] }));

  const openNewMaterial = () => {
    setIsEditingTree(false);
    setEditTreeId(null);
    setTreeForm({ warehouse_name: '', material_name: '', material_code: '', unit: 'كجم', qc_required: false, min_stock: 0, cost_price: 0 });
    setShowTreeModal(true);
  };

  const openEditMaterial = (mat: Material) => {
    if (!mat) return;
    setIsEditingTree(true);
    setEditTreeId(mat.id);
    setTreeForm({
      warehouse_name: mat.warehouse_name, material_name: mat.material_name, material_code: mat.material_code,
      unit: mat.unit, qc_required: mat.qc_required || false, min_stock: mat.min_stock || 0, cost_price: mat.cost_price || 0
    });
    setShowTreeModal(true);
  };

  const handleTreeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!treeForm.warehouse_name || !treeForm.material_name || !treeForm.material_code) return alert("يرجى إكمال الحقول الإجبارية.");
    if (!supabase) return alert("لا يوجد اتصال بقاعدة البيانات.");

    const safeWarehouses = Array.isArray(warehouses) ? warehouses : [];
    const whCode = safeWarehouses.find(w => w?.warehouse_name === treeForm.warehouse_name)?.warehouse_code || null;

    const payload = {
      warehouse_name: treeForm.warehouse_name, warehouse_code: whCode,
      material_name: treeForm.material_name, material_code: treeForm.material_code,
      unit: treeForm.unit, qc_required: treeForm.qc_required, min_stock: treeForm.min_stock, cost_price: treeForm.cost_price
    };

    try {
      if (isEditingTree && editTreeId) {
        const { error } = await supabase.from('materials').update(payload).eq('id', editTreeId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('materials').insert([payload]);
        if (error) throw error;
      }
      setShowTreeModal(false);
      fetchAllData();
    } catch (error: any) {
      alert("حدث خطأ أثناء حفظ المادة: " + (error?.message || ""));
    }
  };

  const handleDeleteMaterial = async (id: number, name: string) => {
    if (!supabase) return;
    if (window.confirm(`تحذير: حذف المادة "${name}" سيؤدي لحذفها من الفهرست. الأفضل التأكد من عدم وجود حركات لها. هل تستمر؟`)) {
      try {
        const { error } = await supabase.from('materials').delete().eq('id', id);
        if (error) throw error;
        fetchAllData();
      } catch (error: any) {
        alert("حدث خطأ أثناء الحذف: " + (error?.message || ""));
      }
    }
  };

  // ==========================================
  // --- تقارير الجرد المتقدمة المحصنة ---
  // ==========================================
  const generateReportData = () => {
    const safeMaterials = Array.isArray(materials) ? materials : [];
    const safeMovements = Array.isArray(movements) ? movements : [];

    let targetMaterials = safeMaterials;
    if (reportWarehouse !== 'ALL') {
      targetMaterials = safeMaterials.filter(m => m?.warehouse_name === reportWarehouse);
    }

    const start = new Date(reportStartDate).getTime();
    const end = new Date(reportEndDate).getTime();

    return targetMaterials.map(mat => {
      if (!mat) return null;
      const allIn = safeMovements.filter(m => m?.material_name === mat.material_name && m?.type === 'IN');
      const allOut = safeMovements.filter(m => m?.material_name === mat.material_name && m?.type === 'OUT');
      
      const totalInQty = allIn.reduce((sum, m) => sum + (Number(m?.quantity) || 0), 0);
      const totalOutQty = allOut.reduce((sum, m) => sum + (Number(m?.quantity) || 0), 0);
      const remainingQty = totalInQty - totalOutQty;

      const totalInReels = allIn.reduce((sum, m) => sum + (Number(m?.reels) || 0), 0);
      const totalOutReels = allOut.reduce((sum, m) => sum + (Number(m?.reels) || 0), 0);
      const remainingReels = totalInReels - totalOutReels;

      const periodOut = allOut.filter(m => {
        const d = new Date(m?.date).getTime();
        return d >= start && d <= end;
      });
      const periodOutQty = periodOut.reduce((sum, m) => sum + (Number(m?.quantity) || 0), 0);
      const periodOutReels = periodOut.reduce((sum, m) => sum + (Number(m?.reels) || 0), 0);

      const stockValue = remainingQty * (Number(mat.cost_price) || 0);

      return {
        matName: mat.material_name, unit: mat.unit, cost: mat.cost_price,
        totalInQty, totalOutQty, remainingQty,
        totalInReels, totalOutReels, remainingReels,
        periodOutQty, periodOutReels, stockValue
      };
    }).filter(row => row !== null && (row.totalInQty > 0 || row.totalOutQty > 0)); 
  };

  const printReport = () => {
    setActiveVoucher(null); 
    setTimeout(() => window.print(), 100);
  };

  // ==========================================
  // 🚀 الفلترة الذكية وإحصائيات الكارتات 🚀
  // ==========================================
  const safeMovementsFiltered = Array.isArray(movements) ? movements : [];
  
  const filteredMovements = safeMovementsFiltered.filter(m => {
    if (!m) return false;
    const matchType = filterType === 'ALL' || m.type === filterType;
    const matchQuery = (m.material_name || '').includes(searchQuery) || (m.doc_number || '').includes(searchQuery);
    return matchType && matchQuery;
  });

  const statsMovements = safeMovementsFiltered.filter(m => 
    m && ((m.material_name || '').includes(searchQuery) || (m.doc_number || '').includes(searchQuery))
  );
  const statsTotalIn = statsMovements.filter(m => m.type === 'IN').reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);
  const statsTotalOut = statsMovements.filter(m => m.type === 'OUT').reduce((sum, m) => sum + (Number(m.quantity) || 0), 0);
  const statsNetBalance = statsTotalIn - statsTotalOut;

  const safeWarehousesGrouped = Array.isArray(warehouses) ? warehouses : [];
  const safeMaterialsGrouped = Array.isArray(materials) ? materials : [];
  
  const groupedTree = safeWarehousesGrouped.map(wh => {
    if (!wh) return null;
    return {
      warehouse: wh, 
      items: safeMaterialsGrouped.filter(m => m?.warehouse_name === wh.warehouse_name)
    };
  }).filter(g => g !== null && (g.items.length > 0 || true));

  return (
    <div dir="rtl" className="p-6 bg-slate-50 min-h-screen font-sans pb-24">
      
      {/* ========================================= */}
      {/* 🖨️ قوالب الطباعة (تظهر فقط عند الطباعة) */}
      {/* ========================================= */}
      <div className="hidden print:block bg-white text-black font-sans">
        {activeVoucher && (
          <div className="border-2 border-black p-6 rounded-lg">
            <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold">مصنع الكابلات والأسلاك الكهربائية</h1>
                <p className="text-sm">قسم إدارة المخازن والسيطرة النوعية (QC)</p>
              </div>
              <div className="text-left">
                <h2 className="text-xl font-bold border-2 border-black px-4 py-1 inline-block rounded">
                  {activeVoucher.type === 'IN' ? 'إذن إدخال مخزني (وارد)' : 'إذن صرف مخزني (صادر)'}
                </h2>
                <p className="text-xs mt-1 font-mono">رقم المستند: {activeVoucher.doc_number || '-'}</p>
                <p className="text-xs font-mono">التاريخ: {activeVoucher.date || ''}</p>
                <p className="text-xs font-mono">المخزن: {activeVoucher.warehouse_name || ''}</p>
              </div>
            </div>
            <table className="w-full border-collapse border border-black mb-6 text-sm text-center">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-black p-2">اسم المادة</th>
                  <th className="border border-black p-2">الكمية</th>
                  <th className="border border-black p-2">الوحدة</th>
                  <th className="border border-black p-2">عدد البكرات</th>
                  <th className="border border-black p-2">فحص الجودة (QC)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black p-3 font-bold">{activeVoucher.material_name || ''}</td>
                  <td className="border border-black p-3 font-bold">{Number(activeVoucher.quantity || 0).toLocaleString()}</td>
                  <td className="border border-black p-3">{activeVoucher.unit || ''}</td>
                  <td className="border border-black p-3">{Number(activeVoucher.reels || 0).toLocaleString()}</td>
                  <td className="border border-black p-3">{activeVoucher.qc_status || '-'}</td>
                </tr>
              </tbody>
            </table>
            {activeVoucher.notes && <div className="mb-6 p-2 border border-black text-sm"><b>الملاحظات:</b> {activeVoucher.notes}</div>}
            <div className="flex justify-between items-end mt-16 px-12 text-sm font-bold">
              <div className="text-center border-t border-black pt-2 w-32">أمين المخزن</div>
              <div className="text-center border-t border-black pt-2 w-32">المستلم</div>
              <div className="text-center border-t border-black pt-2 w-32">المدير المختص</div>
            </div>
          </div>
        )}

        {!activeVoucher && activeView === 'REPORTS' && (
          <div className="p-4">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold mb-2">تقرير الجرد المخزني</h1>
              <p className="text-sm font-bold">المخزن: {reportWarehouse === 'ALL' ? 'الرصيد الكلي لجميع المخازن' : reportWarehouse}</p>
              <p className="text-sm">الفترة من: {reportStartDate} ولغاية: {reportEndDate}</p>
            </div>
            <table className="w-full text-center text-[10px] border-collapse border border-black">
                <thead className="bg-gray-200 font-bold">
                  <tr>
                    <th className="p-2 border border-black">اسم المادة</th>
                    <th className="p-2 border border-black">الوحدة</th>
                    <th className="p-2 border border-black">الكمية المستلمة</th>
                    <th className="p-2 border border-black">الكمية المصروفة</th>
                    <th className="p-2 border border-black">الكمية الباقية</th>
                    <th className="p-2 border border-black">بكرات مستلمة</th>
                    <th className="p-2 border border-black">بكرات مصروفة</th>
                    <th className="p-2 border border-black">رصيد بكرات</th>
                    <th className="p-2 border border-black">مصروف بكرات خلال المدة</th>
                    <th className="p-2 border border-black">كمية مصروفة خلال المدة</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {generateReportData().map((row, i) => row && (
                    <tr key={i}>
                      <td className="p-2 border border-black text-right font-bold font-sans">{row.matName || ''}</td>
                      <td className="p-2 border border-black font-sans">{row.unit || ''}</td>
                      <td className="p-2 border border-black">{Number(row.totalInQty).toLocaleString()}</td>
                      <td className="p-2 border border-black">{Number(row.totalOutQty).toLocaleString()}</td>
                      <td className="p-2 border border-black font-bold">{Number(row.remainingQty).toLocaleString()}</td>
                      <td className="p-2 border border-black">{Number(row.totalInReels)}</td>
                      <td className="p-2 border border-black">{Number(row.totalOutReels)}</td>
                      <td className="p-2 border border-black font-bold">{Number(row.remainingReels)}</td>
                      <td className="p-2 border border-black font-bold">{Number(row.periodOutReels)}</td>
                      <td className="p-2 border border-black font-bold">{Number(row.periodOutQty).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
        )}
      </div>

      {/* ========================================= */}
      {/* 💻 واجهة المستخدم (تختفي عند الطباعة) */}
      {/* ========================================= */}
      <div className="print:hidden">
        
        {/* شريط التنقل العلوي المحسن (مع الجرس 🔔) */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 relative z-10 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Layers className="text-blue-600" /> إدارة المخازن المركزية
            </h1>
          </div>
          
          <div className="bg-white/40 backdrop-blur-xl border border-white/60 p-1.5 rounded-full shadow-sm inline-flex gap-1 overflow-x-auto">
            <button onClick={() => setActiveView('MOVEMENTS')} className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeView === 'MOVEMENTS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-blue-600 hover:bg-white/50'}`}>
              <ListCheck size={18} /> سجل الحركات
            </button>
            <button onClick={() => setActiveView('TREE')} className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeView === 'TREE' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-blue-600 hover:bg-white/50'}`}>
              <FolderTree size={18} /> الفهرست الشجري
            </button>
            <button onClick={() => setActiveView('REPORTS')} className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeView === 'REPORTS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-blue-600 hover:bg-white/50'}`}>
              <LineChart size={18} /> تقارير الجرد الشامل
            </button>
          </div>

          <div className="relative" ref={notifRef}>
            <button 
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="relative p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition shadow-sm"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-rose-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                  {unreadCount}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute top-12 left-0 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-100 p-3 flex justify-between items-center">
                  <span className="font-bold text-slate-800 text-sm">إشعارات طلبات الصرف</span>
                  <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">{unreadCount} جديد</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-sm font-bold">لا توجد إشعارات حالياً</div>
                  ) : (
                    notifications.map(notif => (
                      <div 
                        key={notif.id} 
                        className={`p-3 border-b border-slate-50 transition ${notif.isRead ? 'bg-white' : 'bg-blue-50/50'}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-xs font-bold ${notif.isRead ? 'text-slate-500' : 'text-blue-700'}`}>المبيعات: طلبية #{notif.reference}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{notif.date}</span>
                        </div>
                        <p className={`text-sm mb-3 ${notif.isRead ? 'text-slate-600' : 'text-slate-800 font-medium'}`}>{notif.message}</p>
                        
                        {!notif.isRead && (
                          <div className="flex gap-2">
                            <button onClick={() => handleApproveRequest(notif)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 shadow-sm transition"><ArrowUpRight size={14}/> اعتماد وصرف</button>
                            <button onClick={() => handleRejectRequest(notif)} className="flex-1 bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold py-2 rounded-lg transition">رفض الطلب</button>
                          </div>
                        )}
                        {notif.isRead && (
                          <div className="text-xs text-slate-400 font-bold flex items-center gap-1">
                            <CheckCircle2 size={12}/> تمت المعالجة
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 1. واجهة سجل الحركات */}
        {activeView === 'MOVEMENTS' && (
          <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">سجل حركات المخزون</h2>
                <p className="text-sm text-slate-500">إدارة القيود مع إمكانية التعديل السريع.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openNewMove('IN')} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm transition"><ArrowDownLeft size={18} /> وارد جديد</button>
                <button onClick={() => openNewMove('OUT')} className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm transition"><ArrowUpRight size={18} /> صادر جديد</button>
              </div>
            </div>

            {/* 🚀 الكارتات التفاعلية المضافة حديثاً 🚀 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-400">إجمالي الوارد (حسب البحث)</div>
                  <div className="text-2xl font-black text-emerald-600 mt-1">{statsTotalIn.toLocaleString()}</div>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><ArrowDownLeft size={24} /></div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-400">إجمالي المنصرف (حسب البحث)</div>
                  <div className="text-2xl font-black text-rose-600 mt-1">{statsTotalOut.toLocaleString()}</div>
                </div>
                <div className="p-3 bg-rose-50 text-rose-600 rounded-xl"><ArrowUpRight size={24} /></div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-400">الرصيد المتبقي (حسب البحث)</div>
                  <div className="text-2xl font-black text-blue-600 mt-1">{statsNetBalance.toLocaleString()}</div>
                </div>
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Layers size={24} /></div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search size={18} className="absolute right-3 top-3 text-slate-400" />
                <input type="text" placeholder="ابحث باسم المادة، أو السند ليتم تحديث الكارتات تلقائياً..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pr-10 pl-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setFilterType('ALL')} className={`px-4 py-2 text-xs font-bold rounded-lg ${filterType === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>الكل</button>
                <button onClick={() => setFilterType('IN')} className={`px-4 py-2 text-xs font-bold rounded-lg ${filterType === 'IN' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>وارد</button>
                <button onClick={() => setFilterType('OUT')} className={`px-4 py-2 text-xs font-bold rounded-lg ${filterType === 'OUT' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'}`}>صادر</button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">الحركة</th>
                    <th className="p-3">اسم المادة</th>
                    <th className="p-3">الكمية</th>
                    <th className="p-3 text-center">البكرات</th>
                    <th className="p-3">رقم السند</th>
                    <th className="p-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? <tr><td colSpan={7} className="p-6 text-center text-slate-400">تحميل...</td></tr> : 
                    filteredMovements.map(m => m && (
                    <tr key={m.ui_id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-mono text-xs">{m.date}</td>
                      <td className="p-3">{m.type === 'IN' ? <span className="text-emerald-700 bg-emerald-100 px-2 py-1 rounded text-xs font-bold">وارد</span> : <span className="text-rose-700 bg-rose-100 px-2 py-1 rounded text-xs font-bold">صادر</span>}</td>
                      <td className="p-3 font-bold text-slate-800">{m.material_name}</td>
                      <td className="p-3 font-bold text-blue-700">{Number(m.quantity).toLocaleString()} <span className="text-xs font-normal text-slate-500">{m.unit}</span></td>
                      <td className="p-3 text-center text-slate-600 font-mono">{m.reels}</td>
                      <td className="p-3 font-mono text-slate-500">{m.doc_number || '-'}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => { setActiveVoucher(m); setTimeout(() => window.print(), 100); }} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded" title="طباعة الوصل"><FileText size={16}/></button>
                          <button onClick={() => openEditMove(m)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="تعديل"><Edit size={16}/></button>
                          <button onClick={() => handleDeleteMove(m)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded" title="حذف"><Trash2 size={16}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. واجهة الهيكل الشجري */}
        {activeView === 'TREE' && (
          <div className="animate-fade-in">
             <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">الفهرست الشجري للمخازن</h2>
                  <p className="text-sm text-slate-500">الأرصدة الحية وإدارة بطاقات المواد.</p>
                </div>
                <button onClick={openNewMaterial} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm"><Plus size={18} /> تعريف مادة</button>
             </div>

             {loading ? <div className="text-center py-12 text-slate-500">تحميل الشجرة...</div> : (
                <div className="space-y-3">
                  {groupedTree.map(group => {
                    if (!group || !group.warehouse) return null;
                    const isExpanded = expandedNodes[group.warehouse.warehouse_name];
                    return (
                      <div key={group.warehouse.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="flex items-center gap-3 p-4 bg-slate-50 cursor-pointer hover:bg-slate-100" onClick={() => toggleNode(group.warehouse.warehouse_name)}>
                          <div className="text-slate-400">{isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}</div>
                          <div className="p-2 bg-purple-100 rounded-lg text-purple-700"><FolderTree size={20} /></div>
                          <div>
                            <h3 className="font-bold text-slate-800">{group.warehouse.warehouse_name}</h3>
                            <p className="text-xs text-slate-500">{(group.items || []).length} مادة معرفة</p>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-4 border-t border-slate-100 bg-white space-y-2">
                            {(group.items || []).map(item => item && (
                              <div key={item.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:border-blue-200">
                                <div>
                                  <p className="font-bold text-slate-800">{item.material_name}</p>
                                  <div className="flex gap-3 text-xs text-slate-500 font-mono mt-1">
                                    <span>[{item.material_code}]</span>
                                    <span>{item.unit}</span>
                                    {item.qc_required && <span className="text-amber-600 flex items-center gap-1"><ShieldAlert size={12}/> QC</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-6">
                                  <div className="text-left">
                                    <p className="text-xs text-slate-400">الرصيد</p>
                                    <p className={`font-bold text-sm ${getMaterialStock(item.material_name) > item.min_stock ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {getMaterialStock(item.material_name).toLocaleString()}
                                    </p>
                                  </div>
                                  <div className="flex gap-1">
                                    <button onClick={() => openEditMaterial(item)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit size={16}/></button>
                                    <button onClick={() => handleDeleteMaterial(item.id, item.material_name)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={16}/></button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
             )}
          </div>
        )}

        {/* 3. تقارير الجرد المتقدمة (Reports) */}
        {activeView === 'REPORTS' && (
          <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">تقارير الجرد المخزني</h2>
                <p className="text-sm text-slate-500">جرد الأرصدة، البكرات، والمصروفات ضمن فترة محددة.</p>
              </div>
              <button onClick={printReport} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm transition">
                <Printer size={18} /> طباعة / حفظ كـ PDF
              </button>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col lg:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-slate-600 mb-1">تصفية حسب المخزن</label>
                <select value={reportWarehouse} onChange={e => setReportWarehouse(e.target.value)} className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50">
                  <option value="ALL">جميع المخازن</option>
                  {safeWarehousesGrouped.map(w => w && <option key={w.id} value={w.warehouse_name}>{w.warehouse_name}</option>)}
                </select>
              </div>
              <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-slate-600 mb-1">من تاريخ (بداية المدة)</label>
                <div className="relative">
                  <CalendarDays size={16} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
                  <input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className="w-full pr-10 pl-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-slate-600 mb-1">إلى تاريخ (نهاية المدة)</label>
                <div className="relative">
                  <CalendarDays size={16} className="absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
                  <input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} className="w-full pr-10 pl-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-center text-xs whitespace-nowrap">
                <thead className="bg-slate-800 text-white font-semibold">
                  <tr>
                    <th className="p-3 text-right">اسم المادة</th>
                    <th className="p-3 border-l border-slate-700">الوحدة</th>
                    <th className="p-3 bg-slate-700">المستلمة</th>
                    <th className="p-3 bg-slate-700">المصروفة</th>
                    <th className="p-3 bg-slate-700 border-l border-slate-600 text-emerald-300">الرصيد الفعلي</th>
                    <th className="p-3">بكرات مستلمة</th>
                    <th className="p-3">بكرات مصروفة</th>
                    <th className="p-3 border-l border-slate-700 text-emerald-300">رصيد بكرات</th>
                    <th className="p-3 bg-rose-900/50 text-rose-200">بكرات مصروفة (خلال المدة)</th>
                    <th className="p-3 bg-rose-900/50 text-rose-200">كمية مصروفة (خلال المدة)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {generateReportData().length === 0 ? <tr><td colSpan={10} className="p-8 text-slate-400 font-sans text-sm">لا توجد حركات لعرض الجرد.</td></tr> : 
                    generateReportData().map((row, i) => row && (
                      <tr key={i} className="hover:bg-blue-50 transition">
                        <td className="p-3 text-right font-bold font-sans text-slate-800">{row.matName}</td>
                        <td className="p-3 border-l border-slate-100 font-sans text-slate-500">{row.unit}</td>
                        <td className="p-3 bg-slate-50">{Number(row.totalInQty).toLocaleString()}</td>
                        <td className="p-3 bg-slate-50">{Number(row.totalOutQty).toLocaleString()}</td>
                        <td className="p-3 bg-slate-50 border-l border-slate-100 font-bold text-emerald-700 text-sm">{Number(row.remainingQty).toLocaleString()}</td>
                        <td className="p-3">{Number(row.totalInReels)}</td>
                        <td className="p-3">{Number(row.totalOutReels)}</td>
                        <td className="p-3 border-l border-slate-100 font-bold text-emerald-700 text-sm">{Number(row.remainingReels)}</td>
                        <td className="p-3 bg-rose-50 text-rose-700 font-bold">{Number(row.periodOutReels)}</td>
                        <td className="p-3 bg-rose-50 text-rose-700 font-bold">{Number(row.periodOutQty).toLocaleString()}</td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* المودال: تسجيل / تعديل حركة */}
        {showMoveModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
              <div className={`p-4 flex justify-between items-center text-white ${moveForm.type === 'IN' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                <h3 className="font-bold flex items-center gap-2">
                  {isEditingMove ? <Edit size={20} /> : (moveForm.type === 'IN' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />)}
                  {isEditingMove ? 'تعديل بيانات القيد' : (moveForm.type === 'IN' ? 'تسجيل إذن وارد' : 'تسجيل إذن صادر')}
                </h3>
                <button onClick={() => setShowMoveModal(false)} className="hover:bg-white/20 p-1 rounded"><X size={20} /></button>
              </div>
              
              <form onSubmit={handleMoveSubmit} className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">المخزن المعني *</label>
                    <SearchableSelect 
                      options={safeWarehousesGrouped.map(w => w?.warehouse_name || '')} value={moveForm.warehouse_name} 
                      onChange={val => setMoveForm({...moveForm, warehouse_name: val, material_name: moveForm.material_name ? moveForm.material_name : ''})} placeholder="اختر المخزن..." 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">المادة *</label>
                    <SearchableSelect 
                      options={safeMaterialsGrouped.filter(m => m && (!moveForm.warehouse_name || m.warehouse_name === moveForm.warehouse_name)).map(m => m?.material_name || '')} 
                      value={moveForm.material_name} onChange={val => setMoveForm({...moveForm, material_name: val})} placeholder="اختر المادة..." 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">الكمية *</label>
                    <input type="number" step="0.01" required value={moveForm.quantity || ''} onChange={e => setMoveForm({...moveForm, quantity: Number(e.target.value)})} className="w-full border rounded-lg p-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">عدد البكرات (Reels)</label>
                    <input type="number" value={moveForm.reels || ''} onChange={e => setMoveForm({...moveForm, reels: Number(e.target.value)})} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">التاريخ *</label>
                    <input type="date" required value={moveForm.date} onChange={e => setMoveForm({...moveForm, date: e.target.value})} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">حالة السيطرة (QC)</label>
                    <select value={moveForm.qc_status} onChange={e => setMoveForm({...moveForm, qc_status: e.target.value})} className="w-full border rounded-lg p-2 text-sm bg-white outline-none">
                      <option value="مقبول (مطابق)">مقبول (مطابق للمواصفات)</option>
                      <option value="مرفوض (غير مطابق)">مرفوض (غير مطابق)</option>
                      <option value="قيد الفحص">قيد الفحص المختبري</option>
                      <option value="-">بدون فحص</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">رقم السند</label>
                    <input type="text" value={moveForm.doc_number} onChange={e => setMoveForm({...moveForm, doc_number: e.target.value})} className="w-full border rounded-lg p-2 text-sm font-mono outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">الملاحظات</label>
                    <input type="text" value={moveForm.notes} onChange={e => setMoveForm({...moveForm, notes: e.target.value})} className="w-full border rounded-lg p-2 text-sm outline-none" />
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t pt-4 mt-6">
                  <button type="button" onClick={() => setShowMoveModal(false)} className="px-5 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">إلغاء</button>
                  <button type="submit" className={`px-5 py-2 text-sm font-bold text-white rounded-lg shadow-sm ${moveForm.type === 'IN' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>حفظ واعتماد</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* المودال: إضافة / تعديل مادة (Tree) */}
        {showTreeModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="p-4 flex justify-between items-center bg-blue-600 text-white">
                <h3 className="font-bold flex items-center gap-2">{isEditingTree ? <Edit size={20} /> : <Plus size={20} />} {isEditingTree ? 'تعديل بطاقة المادة' : 'تعريف مادة جديدة'}</h3>
                <button onClick={() => setShowTreeModal(false)} className="hover:bg-white/20 p-1 rounded"><X size={20} /></button>
              </div>
              
              <form onSubmit={handleTreeSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">المخزن التابع له *</label>
                  <SearchableSelect 
                    options={safeWarehousesGrouped.map(w => w?.warehouse_name || '')} value={treeForm.warehouse_name} 
                    onChange={val => setTreeForm({...treeForm, warehouse_name: val})} placeholder="اختر المخزن..." disabled={isEditingTree}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">اسم المادة *</label>
                    <input type="text" required value={treeForm.material_name} onChange={e => setTreeForm({...treeForm, material_name: e.target.value})} className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">الكود / الرمز *</label>
                    <input type="text" required value={treeForm.material_code} onChange={e => setTreeForm({...treeForm, material_code: e.target.value})} className="w-full border rounded-lg p-2 text-sm font-mono outline-none focus:ring-2" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">الوحدة</label>
                    <input type="text" required value={treeForm.unit} onChange={e => setTreeForm({...treeForm, unit: e.target.value})} className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">الحد الأدنى</label>
                    <input type="number" value={treeForm.min_stock} onChange={e => setTreeForm({...treeForm, min_stock: Number(e.target.value)})} className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">التكلفة (للقيمة)</label>
                    <input type="number" value={treeForm.cost_price} onChange={e => setTreeForm({...treeForm, cost_price: Number(e.target.value)})} className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2" />
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 p-3 rounded-lg mt-2">
                  <input type="checkbox" id="qc_check" checked={treeForm.qc_required} onChange={e => setTreeForm({...treeForm, qc_required: e.target.checked})} className="w-4 h-4 text-blue-600 rounded cursor-pointer"/>
                  <label htmlFor="qc_check" className="text-xs font-semibold text-amber-900 cursor-pointer">المادة تخضع لفحص جودة صارم (QC)</label>
                </div>
                <div className="flex justify-end gap-3 border-t pt-4 mt-6">
                  <button type="button" onClick={() => setShowTreeModal(false)} className="px-5 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">إلغاء</button>
                  <button type="submit" className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm">حفظ البطاقة</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}