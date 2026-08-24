import { useState, useEffect, ReactElement } from 'react';
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  Factory, 
  Calculator, 
  FileText,
  Atom,
  Users as UsersIcon,
  ShoppingCart,
  WifiOff
} from 'lucide-react';

import Dashboard from '@/pages/Dashboard';
import StockMovement from '@/pages/StockMovement';
import Production from '@/pages/Production';
import Accounting from '@/pages/Accounting';
import Reports from '@/pages/Reports';
import Users from '@/pages/Users';
import Quality from '@/pages/Quality';
import Sales from '@/pages/Sales'; 
import ErrorBoundary from '@/components/ErrorBoundary'; // 🚀 استدعاء درع الحماية الشامل

type Tab = 'dashboard' | 'movement' | 'production' | 'accounting' | 'sales' | 'reports' | 'users' | 'quality';

const NAV: { id: Tab; label: string; icon: ReactElement }[] = [
  { id: 'dashboard', label: 'لوحة التحكم', icon: <LayoutDashboard size={18} /> },
  { id: 'movement', label: 'إدارة المخازن', icon: <ArrowLeftRight size={18} /> },
  { id: 'production', label: 'الإنتاج', icon: <Factory size={18} /> },
  { id: 'sales', label: 'المبيعات', icon: <ShoppingCart size={18} /> }, 
  { id: 'accounting', label: 'المحاسبة', icon: <Calculator size={18} /> },
  { id: 'reports', label: 'التقارير', icon: <FileText size={18} /> },
  { id: 'users', label: 'المستخدمين', icon: <UsersIcon size={18} /> },
  { id: 'quality', label: 'السيطرة النوعية', icon: <Atom size={18} /> },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine); // 🚀 تتبع حالة الإنترنت

  // مراقبة حالة اتصال الإنترنت برمجياً
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const activeIndex = NAV.findIndex(item => item.id === tab);

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-x-hidden">
      
      {/* إخفاء شريط التمرير من الجذور */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none !important;
        }
        .hide-scrollbar {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `}</style>

      {/* 🚀 شريط التنبيه بانقطاع الإنترنت 🚀 */}
      {!isOnline && (
        <div className="fixed top-0 w-full z-[60] bg-rose-600 text-white font-bold text-sm py-2 px-4 flex justify-center items-center gap-2 shadow-lg animate-in slide-in-from-top-full duration-300">
          <WifiOff size={18} />
          انقطع الاتصال بالإنترنت! النظام الآن في وضع القراءة فقط. يرجى تجنب حفظ أي بيانات لحين عودة الاتصال.
        </div>
      )}

      {/* الشريط العلوي العائم */}
      <div className={`fixed left-0 right-0 z-50 flex justify-center px-2 md:px-4 pointer-events-none print:hidden transition-all duration-300 ${isOnline ? 'top-4' : 'top-12'}`}>
        <div className="flex items-center w-full max-w-7xl bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] rounded-full p-2 pointer-events-auto">
          
          {/* لوجو الشركة */}
          <div className="hidden lg:flex flex-shrink-0 items-center gap-3 pr-4 pl-6 border-l border-slate-300/50">
             <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-200">
                 <Atom size={22} className="text-white animate-pulse" />
             </div>
             <div className="flex flex-col justify-center">
                 <span className="font-black text-slate-900 text-xl leading-none tracking-tight" dir="ltr">Quantum<span className="text-indigo-600">ERP</span></span>
                 <span className="text-[9px] text-slate-500 font-bold tracking-widest uppercase mt-0.5" dir="ltr">Global System</span>
             </div>
          </div>

          <div className="flex-1 overflow-x-auto scroll-smooth hide-scrollbar rounded-full">
            <div 
              className="relative grid items-center bg-slate-400/10 rounded-full p-1.5 min-w-[950px] xl:min-w-full"
              style={{ gridTemplateColumns: `repeat(${NAV.length}, minmax(0, 1fr))` }}
            >
              <div 
                className="absolute top-1.5 bottom-1.5 rounded-full bg-white shadow-sm transition-all duration-500 ease-out"
                style={{
                  width: `calc(100% / ${NAV.length})`, 
                  right: `calc(${activeIndex} * 100% / ${NAV.length})`, 
                }}
              />

              {NAV.map((item) => {
                const isActive = tab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={(e) => {
                      setTab(item.id);
                      e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                    }}
                    className={`relative z-10 flex items-center justify-center gap-2 px-2 py-2.5 rounded-full text-sm font-bold transition-colors duration-300 ${
                      isActive 
                        ? 'text-blue-700' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {item.icon}
                    <span className="hidden md:block whitespace-nowrap">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* منطقة عرض الصفحات مغلفة بدرع الحماية */}
      <main className="pt-28 pb-10 px-4 md:px-6 w-full max-w-[100vw] overflow-hidden relative z-0">
        <ErrorBoundary>
          <div key={tab} className="animate-in slide-in-from-left-8 fade-in duration-500">
            {tab === 'dashboard' && <Dashboard setTab={setTab} />}
            {tab === 'movement' && <StockMovement />}
            {tab === 'production' && <Production />}
            {tab === 'sales' && <Sales />}
            {tab === 'accounting' && <Accounting />}
            {tab === 'reports' && <Reports />}
            {tab === 'users' && <Users />}
            {tab === 'quality' && <Quality />}
          </div>
        </ErrorBoundary>
      </main>
      
    </div>
  );
}