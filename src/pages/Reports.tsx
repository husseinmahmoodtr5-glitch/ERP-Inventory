import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  FileText, Download, Printer, TrendingUp, TrendingDown, 
  AlertCircle, CheckCircle, Package, DollarSign, Calendar, Activity
} from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- Interfaces ---
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

interface TreeItem {
  id: string;
  name: string;
  type: string;
  unit: string;
  cost_price: number;
  qc_required: boolean;
}

export default function Reports() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [treeItems, setTreeItems] = useState<TreeItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // فلتر التاريخ
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // جلب الحركات
    try {
      const { data: movData } = await supabase.from('inventory_movements').select('*').order('date', { ascending: false });
      if (movData) setMovements(movData as Movement[]);
    } catch (e) {
      const local = localStorage.getItem('app_inventory_movements');
      if (local) setMovements(JSON.parse(local));
    }

    // جلب الشجرة (لحساب التكاليف)
    try {
      const { data: tData } = await supabase.from('inventory_tree').select('*').eq('is_active', true);
      if (tData) setTreeItems(tData as TreeItem[]);
    } catch (e) {
      console.log('Error fetching tree');
    }
    
    setLoading(false);
  };

  // --- دوال الفلترة الزمنية ---
  const getFilteredMovements = () => {
    if (dateFilter === 'ALL') return movements;
    
    const today = new Date();
    return movements.filter(m => {
      const movDate = new Date(m.date);
      if (dateFilter === 'TODAY') {
        return movDate.toDateString() === today.toDateString();
      }
      if (dateFilter === 'WEEK') {
        const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        return movDate >= lastWeek;
      }
      if (dateFilter === 'MONTH') {
        return movDate.getMonth() === today.getMonth() && movDate.getFullYear() === today.getFullYear();
      }
      return true;
    });
  };

  const filteredMovs = getFilteredMovements();

  // --- الحسابات والتحليلات (Analytics) ---
  const totalIn = filteredMovs.filter(m => m.type === 'IN').length;
  const totalOut = filteredMovs.filter(m => m.type === 'OUT').length;
  const totalMoves = filteredMovs.length;

  // إحصائيات الجودة (QC)
  const qcMoves = filteredMovs.filter(m => m.qc_status && m.qc_status !== 'غير مطلوب');
  const qcAccepted = qcMoves.filter(m => m.qc_status === 'مقبول (مطابق)').length;
  const qcRejected = qcMoves.filter(m => m.qc_status === 'مرفوض').length;
  const qcPending = qcMoves.filter(m => m.qc_status === 'قيد الفحص').length;
  const rejectRate = qcMoves.length > 0 ? Math.round((qcRejected / qcMoves.length) * 100) : 0;

  // الحساب المالي (تقديري بناءً على الرصيد المتوفر لكل مادة * سعر تكلفتها)
  const calculateTotalInventoryValue = () => {
    let totalValue = 0;
    treeItems.filter(item => item.type !== 'category').forEach(item => {
      const itemIn = movements.filter(m => m.item_name === item.name && m.type === 'IN').reduce((acc, c) => acc + Number(c.quantity), 0);
      const itemOut = movements.filter(m => m.item_name === item.name && m.type === 'OUT').reduce((acc, c) => acc + Number(c.quantity), 0);
      const stock = itemIn - itemOut;
      if (stock > 0 && item.cost_price) {
        totalValue += (stock * item.cost_price);
      }
    });
    return totalValue;
  };

  const inventoryValue = calculateTotalInventoryValue();

  // --- دوال التصدير (تخدم كأمثلة لأزرار البطاقات) ---
  const exportCSV = (type: string) => {
    alert(`سيتم تصدير تقرير [${type}] قريباً. (ميزة قيد التطوير التفصيلي)`);
  };

  const printReport = (type: string) => {
    alert(`سيتم فتح شاشة طباعة تقرير [${type}].`);
  };

  if (loading) {
    return <div className="p-10 text-center text-slate-500 font-bold">جاري تحليل البيانات وإعداد التقارير...</div>;
  }

  return (
    <div dir="rtl" className="p-6 bg-slate-50 min-h-screen font-sans pb-24">
      
      {/* 1. الترويسة والفلاتر */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2">
            <Activity className="text-blue-600" /> لوحة التحليلات والتقارير
          </h1>
          <p className="text-slate-500 mt-1">نظرة شاملة على أداء المخازن، الجودة، والتقييم المالي.</p>
        </div>

        <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex gap-1">
          <button onClick={() => setDateFilter('TODAY')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${dateFilter === 'TODAY' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>اليوم</button>
          <button onClick={() => setDateFilter('WEEK')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${dateFilter === 'WEEK' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>آخر أسبوع</button>
          <button onClick={() => setDateFilter('MONTH')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${dateFilter === 'MONTH' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>هذا الشهر</button>
          <button onClick={() => setDateFilter('ALL')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${dateFilter === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>كل الوقت</button>
        </div>
      </div>

      {/* 2. شريط المؤشرات الحيوية (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-5 rounded-2xl text-white shadow-lg shadow-blue-500/30">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-white/20 rounded-lg"><DollarSign size={24} /></div>
            <span className="text-xs font-medium bg-white/20 px-2 py-1 rounded-full">التقييم الإجمالي</span>
          </div>
          <p className="text-sm font-medium text-blue-100 mb-1">قيمة المخزون الحالي</p>
          <h3 className="text-2xl font-black">{inventoryValue.toLocaleString()} <span className="text-sm font-normal">د.ع</span></h3>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-slate-100 text-slate-600 rounded-lg"><Calendar size={24} /></div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">{dateFilter === 'ALL' ? 'الكلي' : 'للفترة'}</span>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 mb-1">إجمالي الحركات</p>
            <h3 className="text-2xl font-black text-slate-800">{totalMoves} <span className="text-sm font-medium text-slate-400">حركة</span></h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><AlertCircle size={24} /></div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${rejectRate > 5 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {rejectRate > 5 ? 'مؤشر خطر' : 'طبيعي'}
            </span>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 mb-1">نسبة المرفوض (QC)</p>
            <h3 className="text-2xl font-black text-rose-600">{rejectRate}% <span className="text-sm font-medium text-slate-400">من الفحوصات</span></h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Package size={24} /></div>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 mb-1">الأصناف النشطة</p>
            <h3 className="text-2xl font-black text-slate-800">{treeItems.filter(i => i.type !== 'category').length} <span className="text-sm font-medium text-slate-400">مادة/منتج</span></h3>
          </div>
        </div>
      </div>

      {/* 3. التحليل البصري (شريط التقدم لحالة الجودة) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <CheckCircle className="text-emerald-500" /> تحليل فحص الجودة (للفترة المحددة)
        </h3>
        {qcMoves.length === 0 ? (
          <p className="text-sm text-slate-500">لا توجد حركات خاضعة للفحص في هذه الفترة.</p>
        ) : (
          <div>
            <div className="flex justify-between text-sm font-bold mb-2">
              <span className="text-emerald-600">مقبول: {qcAccepted}</span>
              <span className="text-amber-500">قيد الفحص: {qcPending}</span>
              <span className="text-rose-600">مرفوض: {qcRejected}</span>
            </div>
            {/* شريط التقدم المدمج */}
            <div className="w-full h-4 flex rounded-full overflow-hidden bg-slate-100">
              <div style={{ width: `${(qcAccepted / qcMoves.length) * 100}%` }} className="bg-emerald-500 transition-all duration-500"></div>
              <div style={{ width: `${(qcPending / qcMoves.length) * 100}%` }} className="bg-amber-400 transition-all duration-500"></div>
              <div style={{ width: `${(qcRejected / qcMoves.length) * 100}%` }} className="bg-rose-500 transition-all duration-500"></div>
            </div>
          </div>
        )}
      </div>

      {/* 4. قسم تصدير التقارير التفصيلية (نفس البطاقات المطلوبة بصورة محسنة) */}
      <h2 className="text-xl font-bold text-slate-800 mb-4">التقارير التفصيلية قابلة للطباعة</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* تقرير حالة المخزون */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-blue-300 transition-all group">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">تقرير حالة المخزون</h3>
              <p className="text-xs text-slate-500 mt-1">أرصدة، كميات، وقيمة كل صنف حالياً.</p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all"><Package size={20}/></div>
          </div>
          <div className="flex gap-2 pt-4 border-t border-slate-100">
            <button onClick={() => printReport('حالة المخزون')} className="flex-1 flex justify-center items-center gap-2 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-sm rounded-lg transition-all"><Printer size={16}/> طباعة</button>
            <button onClick={() => exportCSV('حالة المخزون')} className="flex-1 flex justify-center items-center gap-2 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-sm rounded-lg transition-all"><Download size={16}/> CSV</button>
          </div>
        </div>

        {/* تقرير الحركات */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-blue-300 transition-all group">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">سجل حركات المخزن</h3>
              <p className="text-xs text-slate-500 mt-1">الوارد والصادر مفصل بالتاريخ (حسب الفلتر أعلاه).</p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-500 group-hover:text-white transition-all"><ArrowLeftRightIcon size={20}/></div>
          </div>
          <div className="flex gap-2 pt-4 border-t border-slate-100">
            <button onClick={() => printReport('حركات المخزن')} className="flex-1 flex justify-center items-center gap-2 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-sm rounded-lg transition-all"><Printer size={16}/> طباعة</button>
            <button onClick={() => exportCSV('حركات المخزن')} className="flex-1 flex justify-center items-center gap-2 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-sm rounded-lg transition-all"><Download size={16}/> CSV</button>
          </div>
        </div>

        {/* تقرير التقييم المالي */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-blue-300 transition-all group">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">تقييم المخزون المالي</h3>
              <p className="text-xs text-slate-500 mt-1">القيمة الإجمالية للمخزون موزعة حسب فئات المواد.</p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-500 group-hover:text-white transition-all"><DollarSign size={20}/></div>
          </div>
          <div className="flex gap-2 pt-4 border-t border-slate-100">
            <button onClick={() => printReport('التقييم المالي')} className="flex-1 flex justify-center items-center gap-2 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-sm rounded-lg transition-all"><Printer size={16}/> طباعة</button>
            <button onClick={() => exportCSV('التقييم المالي')} className="flex-1 flex justify-center items-center gap-2 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-sm rounded-lg transition-all"><Download size={16}/> CSV</button>
          </div>
        </div>

        {/* تقرير تكاليف الإنتاج (مستقبلي) */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 opacity-70">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-slate-600 text-lg flex items-center gap-2">تكاليف أوامر الإنتاج <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded">قريباً</span></h3>
              <p className="text-xs text-slate-500 mt-1">ارتباط مباشر مع قسم الإنتاج لحساب الكلف والهدر.</p>
            </div>
            <div className="p-3 bg-slate-200 text-slate-400 rounded-xl"><FileText size={20}/></div>
          </div>
          <div className="flex gap-2 pt-4 border-t border-slate-200">
            <button disabled className="flex-1 flex justify-center items-center gap-2 py-2 bg-slate-100 text-slate-400 font-bold text-sm rounded-lg cursor-not-allowed"><Printer size={16}/> طباعة</button>
            <button disabled className="flex-1 flex justify-center items-center gap-2 py-2 bg-slate-100 text-slate-400 font-bold text-sm rounded-lg cursor-not-allowed"><Download size={16}/> CSV</button>
          </div>
        </div>

      </div>

    </div>
  );
}

// مكون أيقونة مساعد
function ArrowLeftRightIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>
    </svg>
  );
}