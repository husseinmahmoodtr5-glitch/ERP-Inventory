import { useState } from 'react';
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  Factory, 
  Calculator, 
  FileText,
  Compass // تم إضافة أيقونة البوصلة هنا
} from 'lucide-react';

import Dashboard from '@/pages/Dashboard';
import StockMovement from '@/pages/StockMovement';
import Production from '@/pages/Production';
import Accounting from '@/pages/Accounting';
import Reports from '@/pages/Reports';

type Tab = 'dashboard' | 'movement' | 'production' | 'accounting' | 'reports';

const NAV: { id: Tab; label: string; icon: JSX.Element }[] = [
  { id: 'dashboard', label: 'لوحة التحكم', icon: <LayoutDashboard size={18} /> },
  { id: 'movement', label: 'إدارة المخازن', icon: <ArrowLeftRight size={18} /> },
  { id: 'production', label: 'الإنتاج', icon: <Factory size={18} /> },
  { id: 'accounting', label: 'المحاسبة', icon: <Calculator size={18} /> },
  { id: 'reports', label: 'التقارير', icon: <FileText size={18} /> },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  
  // تحديد موقع الكبسولة برمجياً بناءً على الزر النشط
  const activeIndex = NAV.findIndex(item => item.id === tab);

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden">
      
      {/* 
        الشريط العلوي العائم (Apple Glassmorphism Style)
      */}
      <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
        
        {/* الحاوية الزجاجية الرئيسية */}
        <div className="flex items-center gap-4 bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] rounded-full p-2 pointer-events-auto max-w-full overflow-x-auto no-scrollbar">
          
          {/* لوجو الشركة الجديد (Madar ERP) */}
          <div className="hidden lg:flex items-center gap-3 pr-4 pl-6 border-l border-slate-300/50">
             <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-200">
                 <Compass size={22} className="text-white animate-pulse" />
             </div>
             <div className="flex flex-col justify-center">
                 <span className="font-black text-slate-900 text-xl leading-none tracking-tight" dir="ltr">Madar<span className="text-indigo-600">ERP</span></span>
                 <span className="text-[9px] text-slate-500 font-bold tracking-widest uppercase mt-0.5" dir="ltr">Global System</span>
             </div>
          </div>

          {/* المسار الداخلي الذي تنزلق عليه الكبسولة */}
          <div className="relative flex items-center bg-slate-400/10 rounded-full p-1.5">
            
            {/* الكبسولة البيضاء المنزلقة (السحر كله هنا!) */}
            <div 
              className="absolute top-1.5 bottom-1.5 rounded-full bg-white shadow-sm transition-all duration-500 ease-out"
              style={{
                width: `calc(100% / ${NAV.length})`, // تقسيم العرض بالتساوي
                right: `calc(${activeIndex} * 100% / ${NAV.length})`, // تحريك الكبسولة لليمين واليسار
              }}
            />

            {/* الأزرار (تكون شفافة وتطفو فوق الكبسولة) */}
            {NAV.map((item) => {
              const isActive = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id)}
                  className={`relative z-10 flex flex-1 items-center justify-center gap-2 px-3 py-2.5 md:px-5 md:py-2.5 min-w-[45px] md:min-w-[120px] rounded-full text-sm font-bold transition-colors duration-300 ${
                    isActive 
                      ? 'text-blue-700' // لون النص عندما تقف الكبسولة تحته
                      : 'text-slate-500 hover:text-slate-800' // لون النص العادي
                  }`}
                >
                  {item.icon}
                  {/* النص يختفي في الجوال وتبقى الأيقونات فقط لجمالية أفضل، ويظهر في الكمبيوتر */}
                  <span className="hidden md:block whitespace-nowrap">{item.label}</span>
                </button>
              )
            })}
          </div>

        </div>
      </div>

      {/* منطقة عرض الصفحات */}
      <main className="pt-28 pb-10 px-4 md:px-6 w-full max-w-[100vw]">
        {tab === 'dashboard' && <Dashboard setTab={setTab} />}
        {tab === 'movement' && <StockMovement />}
        {tab === 'production' && <Production />}
        {tab === 'accounting' && <Accounting />}
        {tab === 'reports' && <Reports />}
      </main>
      
    </div>
  );
}