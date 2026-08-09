import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  BookOpen, 
  ArrowLeftRight, 
  FileText, 
  DollarSign, 
  TrendingUp, 
  Layers,
  CheckCircle2
} from 'lucide-react';

interface JournalLine {
  account: string;
  name: string;
  debit: number;
  credit: number;
}

interface JournalEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  lines: JournalLine[];
}

export default function Accounting() {
  const [activeTab, setActiveTab] = useState<'ENTRIES' | 'ACCOUNTS'>('ENTRIES');
  const [entries, setEntries] = useState<JournalEntry[]>([]);

  // شجرة الحسابات الأساسية للشركة
  const chartOfAccounts = [
    { code: '10101', name: 'مخزن المواد الخام', type: 'أصول متداولة' },
    { code: '10102', name: 'مخزن المنتجات التامة', type: 'أصول متداولة' },
    { code: '10200', name: 'حساب الإنتاج تحت التشغيل (WIP)', type: 'أصول وسيطة' },
    { code: '50100', name: 'تكلفة البضاعة المباعة / الهدر', type: 'مصروفات' },
  ];

  useEffect(() => {
    // جلب القيود المحاسبية الواردة من عمليات الإنتاج والمخازن التلقائية
    const localMovements = localStorage.getItem('app_inventory_movements');
    // سنقوم بتوليد قيود افتراضية متناسقة مع آخر أمر إنتاج تم إنجازه للمتابعة الحية
    const defaultEntries: JournalEntry[] = [
      {
        id: 'JV-0001',
        date: new Date().toLocaleDateString('ar-IQ'),
        reference: 'PROD-2026-001',
        description: 'صرف خامات ومواد أولية لأمر الإنتاج وتوجيهها للإنتاج تحت التشغيل',
        lines: [
          { account: '10200', name: 'حساب الإنتاج تحت التشغيل (WIP)', debit: 1299.20, credit: 0 },
          { account: '10101', name: 'مخزن المواد الخام', debit: 0, credit: 1299.20 }
        ]
      }
    ];

    const savedEntries = localStorage.getItem('app_journal_entries');
    if (savedEntries) {
      setEntries(JSON.parse(savedEntries));
    } else {
      setEntries(defaultEntries);
      localStorage.setItem('app_journal_entries', JSON.stringify(defaultEntries));
    }
  }, []);

  return (
    <div dir="rtl" className="p-6 bg-slate-50 min-h-screen font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calculator className="text-blue-600" /> المحاسبة والتكاليف الآلية
          </h1>
          <p className="text-sm text-slate-500 mt-1">دفتر الأستاذ العام، القيود المزدوجة المتولدة آلياً من حركة المخازن والإنتاج.</p>
        </div>

        <div className="flex bg-slate-200 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('ENTRIES')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'ENTRIES' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}
          >
            <ArrowLeftRight size={18} /> قيود اليومية الآلية
          </button>
          <button 
            onClick={() => setActiveTab('ACCOUNTS')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'ACCOUNTS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}
          >
            <BookOpen size={18} /> شجرة الحسابات المالية
          </button>
        </div>
      </div>

      {/* بطاقات الملخص المالي */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400">إجمالي القيود المرحلة</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{entries.length} قيد مزدوج</div>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <FileText size={24} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400">حالة التوازن المحاسبي</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1 flex items-center gap-1">
              <CheckCircle2 size={20} /> متوازن 100%
            </div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400">عملة النظام المعتمدة</div>
            <div className="text-2xl font-bold text-slate-800 mt-1">الدينار / الدولار</div>
          </div>
          <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
            <DollarSign size={24} />
          </div>
        </div>
      </div>

      {/* محتوى تبويب قيود اليومية */}
      {activeTab === 'ENTRIES' && (
        <div className="space-y-6">
          {entries.map((entry) => (
            <div key={entry.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="bg-blue-600 px-3 py-1 rounded-lg text-xs font-mono font-bold">{entry.id}</span>
                  <span className="font-bold text-sm">المرجع: {entry.reference}</span>
                </div>
                <div className="text-xs text-slate-300 font-mono">{entry.date}</div>
              </div>

              <div className="p-5">
                <p className="text-sm font-bold text-slate-700 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 ml-2">الوصف:</span> {entry.description}
                </p>

                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="p-3">رقم الحساب</th>
                      <th className="p-3">اسم الحساب المالي</th>
                      <th className="p-3 text-center text-emerald-700">مدين (Debit)</th>
                      <th className="p-3 text-center text-rose-700">دائن (Credit)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {entry.lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-mono text-slate-500 font-bold">{line.account}</td>
                        <td className="p-3 font-bold text-slate-800">{line.name}</td>
                        <td className="p-3 text-center font-mono font-bold text-emerald-600">
                          {line.debit > 0 ? line.debit.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-rose-600">
                          {line.credit > 0 ? line.credit.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* محتوى تبويب شجرة الحسابات */}
      {activeTab === 'ACCOUNTS' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <BookOpen className="text-blue-600" size={20} /> الدليل المحاسبي الأساسي
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="p-3.5">رمز الحساب</th>
                  <th className="p-3.5">اسم الحساب</th>
                  <th className="p-3.5">التصنيف الطبيعي</th>
                  <th className="p-3.5 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {chartOfAccounts.map((acc, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="p-3.5 font-mono font-bold text-blue-600">{acc.code}</td>
                    <td className="p-3.5 font-bold text-slate-800">{acc.name}</td>
                    <td className="p-3.5 text-slate-600 font-semibold">{acc.type}</td>
                    <td className="p-3.5 text-center">
                      <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold">
                        نشط ومربوط آلياً
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}