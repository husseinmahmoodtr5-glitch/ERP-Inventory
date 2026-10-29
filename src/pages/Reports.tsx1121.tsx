import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  FileText, Download, Printer, 
  AlertCircle, CheckCircle, Package, DollarSign, Calendar, Activity
} from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

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

interface StockRow {
  material_code: string;
  material_name: string;
  warehouse_name: string;
  unit: string;
  current_balance: number;
  cost_price: number;
}

// --- دوال مساعدة ---

// تحويل التاريخ النصي إلى تاريخ حقيقي (يدعم 2026-10-28 وأيضاً 28/10/2026)
const parseDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const text = String(value).trim();
  const dmy = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    if (!isNaN(d.getTime())) return d;
  }
  const direct = new Date(text);
  if (!isNaN(direct.getTime())) return direct;
  return null;
};

// حالات الفحص (QC) كما هي مكتوبة في صفحة المخازن
const isQcChecked = (s?: string) => !!s && s.trim() !== '' && s.trim() !== '-' && s.trim() !== 'غير مطلوب';
const isAccepted = (s?: string) => !!s && s.trim().startsWith('مقبول');
const isRejected = (s?: string) => !!s && s.trim().startsWith('مرفوض');
const isPending = (s?: string) => !!s && s.trim().startsWith('قيد الفحص');

export default function Reports() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [materialsCount, setMaterialsCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  // فلتر التاريخ
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

  useEffect(() => {
    fetchData();
  }, []);

  // 🚀 الآن التقارير تقرأ من نفس جداول صفحة المخازن الحقيقية
  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');

    if (!supabase) {
      setErrorMsg('إعدادات الاتصال بقاعدة البيانات غير موجودة (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
      setLoading(false);
      return;
    }

    try {
      const [inRes, outRes, matRes, stockRes] = await Promise.all([
        supabase.from('inbound').select('*'),
        supabase.from('outbound').select('*'),
        supabase.from('materials').select('*'),
        supabase.from('live_stock_view').select('*')
      ]);

      if (inRes.error) throw inRes.error;
      if (outRes.error) throw outRes.error;
      if (matRes.error) throw matRes.error;
      if (stockRes.error) throw stockRes.error;

      // 1) دمج الوارد والصادر في قائمة حركات واحدة
      const combined: Movement[] = [];

      (inRes.data || []).forEach((r: any) => {
        combined.push({
          id: `IN-${r.id}`,
          date: r.transaction_date,
          type: 'IN',
          item_name: r.material_name,
          quantity: Number(r.quantity_received) || 0,
          unit: r.unit,
          doc_number: r.entry_number?.toString() || '',
          qc_status: r.qc_status || '-',
          notes: r.reference_or_notes || ''
        });
      });

      (outRes.data || []).forEach((r: any) => {
        combined.push({
          id: `OUT-${r.id}`,
          date: r.transaction_date,
          type: 'OUT',
          item_name: r.material_name,
          quantity: Number(r.quantity_issued) || 0,
          unit: r.unit,
          doc_number: r.entry_number?.toString() || '',
          qc_status: r.qc_status || '-',
          notes: r.notes || ''
        });
      });

      setMovements(combined);

      // 2) أسعار التكلفة من جدول المواد (حسب رمز المادة + المخزن، وإلا حسب رمز المادة فقط)
      const mats: any[] = matRes.data || [];
      const costByKey = new Map<string, number>();
      const costByCode = new Map<string, number>();
      mats.forEach((m: any) => {
        const cost = Number(m.cost_price) || 0;
        costByKey.set(`${m.material_code}|${m.warehouse_name}`, cost);
        if (cost > 0 && !costByCode.get(m.material_code)) costByCode.set(m.material_code, cost);
      });

      // 3) الأرصدة الحية من live_stock_view مع سعر التكلفة
      const rows: StockRow[] = (stockRes.data || []).map((s: any) => ({
        material_code: s.material_code,
        material_name: s.material_name,
        warehouse_name: s.warehouse_name,
        unit: s.unit,
        current_balance: Number(s.current_balance) || 0,
        cost_price: costByKey.get(`${s.material_code}|${s.warehouse_name}`) ?? costByCode.get(s.material_code) ?? 0
      }));

      setStockRows(rows);
      setMaterialsCount(mats.length);
    } catch (e: any) {
      console.error('Reports fetch error:', e);
      setErrorMsg(e?.message || 'تعذر جلب البيانات من قاعدة البيانات.');
    } finally {
      setLoading(false);
    }
  };

  // --- دوال الفلترة الزمنية ---
  const getFilteredMovements = () => {
    if (dateFilter === 'ALL') return movements;
    
    const today = new Date();
    return movements.filter(m => {
      const movDate = parseDate(m.date);
      if (!movDate) return false;
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
  const totalMoves = filteredMovs.length;

  // إحصائيات الجودة (QC)
  const qcMoves = filteredMovs.filter(m => isQcChecked(m.qc_status));
  const qcAccepted = qcMoves.filter(m => isAccepted(m.qc_status)).length;
  const qcRejected = qcMoves.filter(m => isRejected(m.qc_status)).length;
  const qcPending = qcMoves.filter(m => isPending(m.qc_status)).length;
  const rejectRate = qcMoves.length > 0 ? Math.round((qcRejected / qcMoves.length) * 100) : 0;

  // قيمة المخزون = الرصيد الحي لكل مادة × سعر تكلفتها
  const inventoryValue = stockRows.reduce(
    (acc, r) => (r.current_balance > 0 ? acc + r.current_balance * r.cost_price : acc),
    0
  );

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

      {/* رسالة خطأ في حال فشل جلب البيانات */}
      {errorMsg && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm font-bold flex items-center justify-between gap-3">
          <span>⚠️ {errorMsg}</span>
          <button onClick={fetchData} className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs">إعادة المحاولة</button>
        </div>
      )}

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
            <h3 className="text-2xl font-black text-slate-800">{materialsCount} <span className="text-sm font-medium text-slate-400">مادة/منتج</span></h3>
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
