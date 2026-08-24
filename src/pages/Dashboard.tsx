import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  DollarSign, 
  TrendingUp, 
  Factory, 
  Box, 
  PlusCircle, 
  ArrowUpRight, 
  FolderTree, 
  ArrowLeftRight, 
  Calculator, 
  ShoppingCart,
  Beaker,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

// البيانات المبدئية (سيتم ربطها لاحقاً بقاعدة البيانات)
const initialChartData = [
  { name: 'السبت', production: 120, consumption: 140 },
  { name: 'الأحد', production: 180, consumption: 150 },
  { name: 'الإثنين', production: 250, consumption: 180 },
  { name: 'الثلاثاء', production: 220, consumption: 200 },
  { name: 'الأربعاء', production: 280, consumption: 210 },
  { name: 'الخميس', production: 310, consumption: 250 },
  { name: 'الجمعة', production: 150, consumption: 100 },
];

interface DashboardProps {
  setTab?: (tab: string) => void; // تم جعلها اختيارية برمجياً لمنع الأخطاء
}

export default function Dashboard({ setTab }: DashboardProps) {
  const [marketRate, setMarketRate] = useState<number>(150250);
  const [chartData, setChartData] = useState(initialChartData);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // ==========================================
  // --- هيكل جلب البيانات الآمن (للمستقبل) ---
  // ==========================================
  useEffect(() => {
    const fetchDashboardStats = async () => {
      setIsLoading(true);
      try {
        // 🚀 هنا سيتم وضع أكواد Supabase لجلب الإحصائيات مستقبلاً
        // const { data, error } = await supabase.from('...').select('...');
        // if (error) throw error;
      } catch (error: any) {
        console.error("خطأ صامت تم التقاطه في لوحة التحكم:", error?.message);
        // لا نظهر alert هنا كي لا نزعج المستخدم في الصفحة الرئيسية، نكتفي بتسجيل الخطأ
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardStats();
  }, []);

  // محاكاة حية لتغير سعر الصرف
  useEffect(() => {
    const interval = setInterval(() => {
      setMarketRate(prev => prev + (Math.random() > 0.5 ? 250 : -250));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // دالة تنقل آمنة دفاعياً
  const handleNavigation = (tabName: string) => {
    if (typeof setTab === 'function') {
      setTab(tabName);
    }
  };

  // تأمين مصفوفة المخطط البياني لمنع انهيار مكتبة Recharts
  const safeChartData = Array.isArray(chartData) ? chartData : [];

  return (
    <div dir="rtl" className="space-y-6 pb-8 animate-fade-in">
      
      {/* رأس اللوحة والأزرار السريعة */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/40 backdrop-blur-xl border border-white/60 p-5 rounded-3xl shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="text-blue-600" /> غرفة العمليات المركزية
          </h1>
          <p className="text-sm text-slate-500 mt-1">نظرة تشغيلية شاملة لحالة المعمل والإنتاج والمخازن.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button 
            onClick={() => handleNavigation('production')}
            className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all"
          >
            <PlusCircle size={18} /> أمر إنتاج
          </button>
          <button 
            onClick={() => handleNavigation('movement')}
            className="flex-1 md:flex-none bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <ArrowUpRight size={18} className="text-emerald-600" /> استلام مواد
          </button>
        </div>
      </div>

      {/* المؤشرات الحيوية */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/60 backdrop-blur-lg border border-white/80 p-5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <h3 className="text-sm font-bold text-slate-500 flex items-center gap-1.5 mb-4"><DollarSign size={16} /> أسعار الصرف (100$)</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center bg-slate-50/80 p-2 rounded-xl">
              <span className="text-xs font-bold text-slate-600">المركزي</span>
              <span className="font-mono font-bold text-slate-800">132,000 د.ع</span>
            </div>
            <div className="flex justify-between items-center bg-blue-50/50 p-2 rounded-xl border border-blue-100 transition-all duration-500">
              <span className="text-xs font-bold text-blue-800">الموازي</span>
              <span className="font-mono font-bold text-blue-700">{marketRate.toLocaleString()} د.ع</span>
            </div>
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-lg border border-white/80 p-5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <h3 className="text-sm font-bold text-slate-500 flex items-center gap-1.5 mb-2"><Factory size={16} /> كفاءة الإنتاج</h3>
          <div className="flex items-center justify-between mt-4">
            <p className="text-3xl font-black text-slate-800">75%</p>
            <div className="w-16 h-16 relative">
               <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path className="text-slate-200" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-blue-600" strokeDasharray="75, 100" strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-lg border border-white/80 p-5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <h3 className="text-sm font-bold text-slate-500 flex items-center gap-1.5 mb-4"><Box size={16} /> سعة المخازن</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-600">المواد الخام:</span><span className="font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">1,250 طن</span></div>
            <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-600">بضائع تامة:</span><span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">430 وحدة</span></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-5 rounded-3xl shadow-lg text-white">
          <h3 className="text-sm font-bold text-slate-300 flex items-center gap-1.5 mb-2"><Activity size={16} /> أوامر نشطة</h3>
          <p className="text-4xl font-black mt-4">12</p>
        </div>
      </div>

      {/* المخطط والنشاطات */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white/60 backdrop-blur-lg border border-white/80 p-5 rounded-3xl shadow-sm overflow-hidden">
          <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-6"><TrendingUp className="text-blue-600" /> تحليل الإنتاج (أسبوع)</h2>
          <div className="h-[250px] w-full" dir="ltr">
            {/* تم حماية الـ Chart وتحديد اتجاه LTR لمنع مشاكل العرض في الـ RTL */}
            {safeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={safeChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="name" tick={{fontFamily: 'sans-serif'}} />
                  <YAxis orientation="right" tick={{fontFamily: 'sans-serif'}} />
                  <Tooltip />
                  <Area type="monotone" dataKey="production" stroke="#2563eb" fill="#dbeafe" name="الإنتاج" />
                  <Area type="monotone" dataKey="consumption" stroke="#f59e0b" fill="#fef3c7" name="الاستهلاك" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold">لا توجد بيانات بيانية للعرض</div>
            )}
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-lg border border-white/80 p-5 rounded-3xl shadow-sm">
          <h2 className="font-bold text-slate-800 mb-6"><Activity className="text-rose-500 inline" /> سجل النشاطات</h2>
          <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2">
            <div className="pr-4 border-r-2 border-emerald-500"><p className="text-xs font-bold">استلام مواد خام</p><p className="text-xs text-slate-500">تم إدخال 5 طن نحاس.</p></div>
            <div className="pr-4 border-r-2 border-blue-500"><p className="text-xs font-bold">بدء أمر إنتاج</p><p className="text-xs text-slate-500">أمر رقم #PROD-055.</p></div>
            <div className="pr-4 border-r-2 border-amber-500"><p className="text-xs font-bold">تنبيه مخزون</p><p className="text-xs text-slate-500">نقص في مادة PVC.</p></div>
          </div>
        </div>
      </div>

      {/* الوصول السريع السفلي (تم استبدال التقارير بالمبيعات والسيطرة النوعية) */}
      <div className="pt-6 mt-6 border-t border-slate-200/60">
        <h2 className="font-bold text-slate-700 mb-4 px-2">الانتقال السريع</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <button onClick={() => handleNavigation('movement')} className="flex flex-col items-center gap-3 p-4 bg-white/40 border border-white/60 rounded-2xl shadow-sm hover:shadow-md transition"><ArrowLeftRight className="text-emerald-600" />المخازن</button>
          <button onClick={() => handleNavigation('production')} className="flex flex-col items-center gap-3 p-4 bg-white/40 border border-white/60 rounded-2xl shadow-sm hover:shadow-md transition"><Factory className="text-amber-600" />الإنتاج</button>
          <button onClick={() => handleNavigation('sales')} className="flex flex-col items-center gap-3 p-4 bg-white/40 border border-white/60 rounded-2xl shadow-sm hover:shadow-md transition"><ShoppingCart className="text-blue-600" />المبيعات</button>
          <button onClick={() => handleNavigation('accounting')} className="flex flex-col items-center gap-3 p-4 bg-white/40 border border-white/60 rounded-2xl shadow-sm hover:shadow-md transition"><Calculator className="text-indigo-600" />المحاسبة</button>
          <button onClick={() => handleNavigation('quality')} className="flex flex-col items-center gap-3 p-4 bg-white/40 border border-white/60 rounded-2xl shadow-sm hover:shadow-md transition"><Beaker className="text-rose-600" />السيطرة النوعية</button>
        </div>
      </div>
    </div>
  );
}