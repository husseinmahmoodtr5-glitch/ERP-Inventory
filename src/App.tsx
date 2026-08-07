import { useState } from 'react';
import { LayoutDashboard, FolderTree, ArrowLeftRight, Factory, Calculator, FileBarChart, Boxes } from 'lucide-react';
import Dashboard from '@/pages/Dashboard';
import InventoryTree from '@/pages/InventoryTree';
import StockMovement from '@/pages/StockMovement';
import Production from '@/pages/Production';
import Accounting from '@/pages/Accounting';
import Reports from '@/pages/Reports';

type Tab = 'dashboard' | 'inventory' | 'movement' | 'production' | 'accounting' | 'reports';

const NAV: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { id: 'inventory', label: 'شجرة المخزون', icon: FolderTree },
  { id: 'movement', label: 'حركة المخزون', icon: ArrowLeftRight },
  { id: 'production', label: 'الإنتاج', icon: Factory },
  { id: 'accounting', label: 'المحاسبة والتكاليف', icon: Calculator },
  { id: 'reports', label: 'التقارير', icon: FileBarChart },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <div className="min-h-screen flex bg-ink-100">
      {/* Sidebar (right side for RTL) */}
      <aside className="w-64 shrink-0 bg-ink-900 text-ink-100 flex flex-col sticky top-0 h-screen">
        <div className="px-5 py-5 flex items-center gap-3 border-b border-ink-800">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center shadow-lg">
            <Boxes size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">نظام الإدارة الصناعي</h1>
            <p className="text-[11px] text-ink-400">مخزون · إنتاج · تكاليف</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = tab === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition group ${
                  active
                    ? 'bg-brand-600 text-white shadow-md'
                    : 'text-ink-300 hover:bg-ink-800 hover:text-white'
                }`}
              >
                <Icon size={19} className={active ? 'text-white' : 'text-ink-400 group-hover:text-white'} />
                <span>{n.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-ink-800 text-[11px] text-ink-500">
          نظام مبسط · متوسط مرجح متحرك
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className="max-w-[1400px] mx-auto px-6 py-6">
          {tab === 'dashboard' && <Dashboard />}
          {tab === 'inventory' && <InventoryTree />}
          {tab === 'movement' && <StockMovement />}
          {tab === 'production' && <Production />}
          {tab === 'accounting' && <Accounting />}
          {tab === 'reports' && <Reports />}
        </div>
      </main>
    </div>
  );
}
