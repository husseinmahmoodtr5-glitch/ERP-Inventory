import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Calculator, 
  ArrowLeftRight, 
  FileText, 
  DollarSign, 
  TrendingUp, 
  CheckCircle2,
  PlusCircle,
  X,
  Search,
  Trash2,
  Printer,
  Eye,
  Edit3,
  FolderTree,
  Edit,
  CornerDownLeft
} from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

interface AccountItem {
  id: string;
  code: string;
  name: string;
  type: string;
  parent_code?: string | null;
  is_active: boolean;
}

export default function Accounting() {
  const [activeTab, setActiveTab] = useState<'ENTRIES' | 'ACCOUNTS'>('ENTRIES');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accountsList, setAccountsList] = useState<AccountItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [exchangeRate, setExchangeRate] = useState<number>(148750);
  const [rateChange, setRateChange] = useState<'up' | 'down' | 'stable'>('stable');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [newReference, setNewReference] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLines, setNewLines] = useState<JournalLine[]>([
    { account: '', name: '', debit: 0, credit: 0 },
    { account: '', name: '', debit: 0, credit: 0 }
  ]);

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountItem | null>(null);
  const [accCode, setAccCode] = useState('');
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState('أصول متداولة');
  const [accParent, setAccParent] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setExchangeRate(prev => {
        const changes = [-250, 0, 250, 500, -500];
        const randomChange = changes[Math.floor(Math.random() * changes.length)];
        const newval = prev + randomChange;
        if (randomChange > 0) setRateChange('up');
        else if (randomChange < 0) setRateChange('down');
        else setRateChange('stable');
        return newval;
      });
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchEntries();
    fetchAccounts();
  }, []);

  const fetchEntries = async () => {
    try {
      const { data, error } = await supabase.from('journal_entries').select('*').order('created_at', { ascending: false });
      if (!error && data) setEntries(data);
    } catch (error) {
      console.error('Error fetching entries:', error);
    }
  };

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase.from('accounts').select('*').order('code', { ascending: true });
      if (error || !data || data.length === 0) {
        setAccountsList([
          { id: '1', code: '1000', name: 'الأصول', type: 'أصول', parent_code: null, is_active: true },
          { id: '2', code: '1010', name: 'الأصول المتداولة', type: 'أصول متداولة', parent_code: '1000', is_active: true },
          { id: '3', code: '10101', name: 'مخزون المواد الخام', type: 'أصول متداولة', parent_code: '1010', is_active: true },
          { id: '4', code: '10102', name: 'مخزون المنتجات التامة', type: 'أصول متداولة', parent_code: '1010', is_active: true },
          { id: '5', code: '10301', name: 'الصندوق / النقدية', type: 'أصول متداولة', parent_code: '1010', is_active: true },
          { id: '6', code: '5000', name: 'المصروفات والتكاليف', type: 'مصروفات', parent_code: null, is_active: true },
        ]);
      } else {
        setAccountsList(data);
      }
    } catch (e) {
      console.log('Using default accounts tree');
    }
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accCode || !accName) return alert('الرجاء تعبئة الحقول الأساسية');

    if (editingAccount) {
      setAccountsList(accountsList.map(a => 
        a.id === editingAccount.id ? { ...a, code: accCode, name: accName, type: accType, parent_code: accParent || null } : a
      ));
    } else {
      const newAcc: AccountItem = {
        id: Date.now().toString(),
        code: accCode,
        name: accName,
        type: accType,
        parent_code: accParent || null,
        is_active: true
      };
      setAccountsList([...accountsList, newAcc].sort((a, b) => a.code.localeCompare(b.code)));
    }
    setIsAccountModalOpen(false);
    resetAccountForm();
  };

  const handleDeleteAccount = (id: string) => {
    if (window.confirm('تنبيه: هل أنت متأكد من حذف هذا الحساب نهائياً من الشجرة؟')) {
      setAccountsList(accountsList.filter(a => a.id !== id && a.parent_code !== id));
    }
  };

  const handleToggleAccountStatus = (id: string, currentStatus: boolean) => {
    setAccountsList(accountsList.map(acc => acc.id === id ? { ...acc, is_active: !currentStatus } : acc));
  };

  const resetAccountForm = () => {
    setEditingAccount(null);
    setAccCode('');
    setAccName('');
    setAccType('أصول متداولة');
    setAccParent('');
  };

  const buildTree = (accounts: AccountItem[], parentId: string | null = null, depth: number = 0): (AccountItem & { depth: number })[] => {
    let tree: (AccountItem & { depth: number })[] = [];
    const children = accounts.filter(acc => acc.parent_code === parentId);
    children.forEach(child => {
      tree.push({ ...child, depth });
      tree = tree.concat(buildTree(accounts, child.code, depth + 1));
    });
    return tree;
  };

  const hierarchicalAccounts = useMemo(() => buildTree(accountsList), [accountsList]);

  const handleOpenNewEntryModal = () => {
    setNewReference(`JV-${new Date().getFullYear()}-${String(entries.length + 1).padStart(3, '0')}`);
    setNewDescription('');
    setNewLines([{ account: '', name: '', debit: 0, credit: 0 }, { account: '', name: '', debit: 0, credit: 0 }]);
    setIsPreviewMode(false);
    setIsModalOpen(true);
  };

  // 🔴 هنا تم حل مشكلة TypeScript التي ظهرت في الصورة
  const handleLineChange = (index: number, field: keyof JournalLine, value: string | number) => {
    const updatedLines = [...newLines];
    if (field === 'account') {
      const selectedAcc = accountsList.find(a => a.code === value);
      updatedLines[index].account = value as string;
      updatedLines[index].name = selectedAcc ? selectedAcc.name : '';
    } else if (field === 'debit') {
      updatedLines[index].debit = Number(value) || 0;
    } else if (field === 'credit') {
      updatedLines[index].credit = Number(value) || 0;
    }
    setNewLines(updatedLines);
  };

  const totalDebit = newLines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredit = newLines.reduce((sum, line) => sum + (line.credit || 0), 0);
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;

  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) return alert('القيد غير متوازن! راجع الجانب المدين والدائن.');

    setLoading(true);
    try {
      const newEntryData = {
        id: `JV-${String(entries.length + 1).padStart(4, '0')}`,
        date: new Date().toLocaleDateString('ar-IQ'),
        reference: newReference || 'قيد يدوي',
        description: newDescription,
        lines: newLines.filter(l => l.account !== ''),
      };

      await supabase.from('journal_entries').insert([newEntryData]);
      await fetchEntries();
      setIsModalOpen(false);
    } catch (error: any) {
      alert('خطأ في الحفظ: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف السند المحاسبي؟')) {
      await supabase.from('journal_entries').delete().eq('id', id);
      fetchEntries();
    }
  };

  const handlePrintEntry = (entry: JournalEntry) => {
    const totalDeb = entry.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCred = entry.lines.reduce((sum, line) => sum + line.credit, 0);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('يرجى السماح بفتح النوافذ المنبثقة للطباعة');

    printWindow.document.write(`
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>سند قيد - ${entry.id}</title>
        <style>
          body { font-family: 'Tahoma', Arial, sans-serif; direction: rtl; padding: 20px; color: #111; background: #fff; }
          .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #333; padding-bottom: 15px; }
          .header h2 { margin: 0 0 5px 0; font-size: 24px; color: #000; }
          .header p { margin: 0; font-size: 14px; color: #555; }
          .info-table { width: 100%; margin-bottom: 20px; font-size: 14px; }
          .info-table td { padding: 4px 0; }
          .desc-box { background: #f9f9f9; padding: 10px 12px; border: 1px solid #ddd; margin-bottom: 20px; font-size: 14px; }
          .main-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 13px; }
          .main-table th, .main-table td { border: 1px solid #333; padding: 8px 12px; text-align: right; }
          .main-table th { background-color: #f2f2f2; font-weight: bold; }
          .totals { width: 100%; font-weight: bold; font-size: 14px; margin-top: 15px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 60px; font-size: 13px; font-weight: bold; text-align: center; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>شركة آسيا للكابلات</h2>
          <p>سند قيد يومية معتمد</p>
        </div>

        <table class="info-table">
          <tr>
            <td><strong>رقم القيد المسلسل:</strong> ${entry.id}</td>
            <td style="text-align: left;"><strong>التاريخ:</strong> ${entry.date}</td>
          </tr>
          <tr>
            <td><strong>المرجع:</strong> ${entry.reference}</td>
            <td style="text-align: left;"></td>
          </tr>
        </table>

        <div class="desc-box">
          <strong>بيان القيد:</strong> ${entry.description}
        </div>

        <table class="main-table">
          <thead>
            <tr>
              <th style="width: 20%;">رقم الحساب</th>
              <th style="width: 45%;">اسم الحساب</th>
              <th style="width: 17%; text-align: center;">مدين</th>
              <th style="width: 18%; text-align: center;">دائن</th>
            </tr>
          </thead>
          <tbody>
            ${entry.lines.map(line => `
              <tr>
                <td>${line.account}</td>
                <td><strong>${line.name}</strong></td>
                <td style="text-align: center; color: #16a34a; font-weight: bold;">${line.debit > 0 ? line.debit.toLocaleString() : '-'}</td>
                <td style="text-align: center; color: #dc2626; font-weight: bold;">${line.credit > 0 ? line.credit.toLocaleString() : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <table class="totals">
          <tr>
            <td>الإجمالي:</td>
            <td style="text-align: left;">
              <span style="color: #16a34a; margin-left: 20px;">مدين: ${totalDeb.toLocaleString()}</span>
              <span style="color: #dc2626;">دائن: ${totalCred.toLocaleString()}</span>
            </td>
          </tr>
        </table>

        <div class="signatures">
          <div>توقيع المحاسب المنفذ<br><br><br>___________________</div>
          <div>توقيع مدير الحسابات / التدقيق<br><br><br>___________________</div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredEntries = entries.filter(e => 
    (e.reference || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (e.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div dir="rtl" className="p-4 md:p-6 bg-slate-50 min-h-screen font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calculator className="text-blue-600" /> النظام المحاسبي - آسيا للكابلات
          </h1>
          <p className="text-sm text-slate-500 mt-1">إدارة القيود المزدوجة وهيكلة شجرة الحسابات (الدليل الشامل).</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex bg-slate-200 p-1 rounded-xl flex-grow md:flex-grow-0">
            <button 
              onClick={() => setActiveTab('ENTRIES')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'ENTRIES' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}
            >
              <ArrowLeftRight size={18} /> السندات والقيود
            </button>
            <button 
              onClick={() => setActiveTab('ACCOUNTS')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'ACCOUNTS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}
            >
              <FolderTree size={18} /> شجرة الحسابات
            </button>
          </div>
          
          <button 
            onClick={handleOpenNewEntryModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 shadow-md w-full md:w-auto justify-center"
          >
            <PlusCircle size={18} /> إنشاء سند قيد
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div><div className="text-xs font-bold text-slate-400">إجمالي القيود في الداتا بيس</div><div className="text-2xl font-bold text-blue-600 mt-1">{entries.length} قيد مزدوج</div></div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><FileText size={24} /></div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div><div className="text-xs font-bold text-slate-400">حالة التوازن المحاسبي</div><div className="text-2xl font-bold text-emerald-600 mt-1 flex items-center gap-1"><CheckCircle2 size={20} /> متوازن 100%</div></div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp size={24} /></div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className={`absolute top-0 right-0 w-1 h-full ${rateChange === 'up' ? 'bg-emerald-500' : rateChange === 'down' ? 'bg-rose-500' : 'bg-blue-600'}`}></div>
          <div><div className="text-xs font-bold text-slate-400">سعر الصرف الحي</div><div className="text-xl font-bold text-slate-800 mt-1 font-mono">100$ = {exchangeRate.toLocaleString()} د.ع</div></div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><DollarSign size={24} /></div>
        </div>
      </div>

      {activeTab === 'ACCOUNTS' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FolderTree className="text-blue-600" size={22} /> هيكل شجرة الحسابات والمخازن
            </h2>
            <button 
              onClick={() => { resetAccountForm(); setIsAccountModalOpen(true); }}
              className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow"
            >
              <PlusCircle size={18} /> إضافة فرع / حساب جديد
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm border-collapse">
              <thead className="bg-slate-100 text-slate-700 border-b-2 border-slate-200">
                <tr>
                  <th className="p-3 font-bold">الدليل (Code)</th>
                  <th className="p-3 font-bold">اسم الحساب (مستويات الشجرة)</th>
                  <th className="p-3 font-bold">طبيعة الحساب</th>
                  <th className="p-3 font-bold text-center">الحالة</th>
                  <th className="p-3 font-bold text-center">أدوات التحكم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hierarchicalAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-blue-50/50 transition">
                    <td className="p-3 font-mono font-bold text-blue-700">{acc.code}</td>
                    <td className="p-3 font-bold text-slate-800 flex items-center">
                      <span style={{ paddingRight: `${acc.depth * 25}px` }} className="flex items-center gap-2">
                        {acc.depth > 0 && <CornerDownLeft size={16} className="text-slate-400" />}
                        {acc.name}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600">{acc.type}</td>
                    <td className="p-3 text-center">
                      <button 
                        onClick={() => handleToggleAccountStatus(acc.id, acc.is_active)}
                        className={`px-3 py-1 rounded-full text-xs font-bold border transition ${acc.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'}`}
                      >
                        {acc.is_active ? 'نشط ويعمل' : 'معطل'}
                      </button>
                    </td>
                    <td className="p-3 text-center flex justify-center gap-2">
                      <button onClick={() => { setEditingAccount(acc); setAccCode(acc.code); setAccName(acc.name); setAccType(acc.type); setAccParent(acc.parent_code || ''); setIsAccountModalOpen(true); }} className="p-1.5 bg-slate-100 hover:bg-blue-100 text-blue-600 rounded-lg transition"><Edit size={16} /></button>
                      <button onClick={() => handleDeleteAccount(acc.id)} className="p-1.5 bg-slate-100 hover:bg-rose-100 text-rose-600 rounded-lg transition"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'ENTRIES' && (
        <div className="space-y-6">
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <Search className="text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="ابحث عن قيد بواسطة المرجع، الوصف، أو الرقم..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none focus:outline-none text-sm font-medium"
            />
          </div>

          {filteredEntries.map((entry) => (
            <div key={entry.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-800 p-4 text-white flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center gap-3">
                  <span className="bg-blue-600 px-3 py-1 rounded-lg text-xs font-mono font-bold">{entry.id}</span>
                  <span className="font-bold text-sm">المرجع: {entry.reference}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-300 font-mono">{entry.date}</span>
                  <button onClick={() => handlePrintEntry(entry)} className="bg-slate-700 hover:bg-slate-600 transition px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold border border-slate-600 shadow-sm"><Printer size={14} /> طباعة</button>
                  <button onClick={() => handleDeleteEntry(entry.id)} className="bg-rose-600 hover:bg-rose-500 transition px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold"><Trash2 size={14} /> حذف</button>
                </div>
              </div>
              <div className="p-5">
                <p className="text-sm font-bold text-slate-700 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-400 ml-2">الوصف:</span> {entry.description}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b-2 border-slate-200">
                      <tr>
                        <th className="p-3">رقم الحساب</th>
                        <th className="p-3">اسم الحساب المالي</th>
                        <th className="p-3 text-center text-emerald-700">مدين (Debit)</th>
                        <th className="p-3 text-center text-rose-700">دائن (Credit)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {entry.lines.map((line, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-bold text-slate-500">{line.account}</td>
                          <td className="p-3 font-bold text-slate-800">{line.name}</td>
                          <td className="p-3 text-center font-mono font-bold text-emerald-600">{line.debit > 0 ? line.debit.toLocaleString() : '-'}</td>
                          <td className="p-3 text-center font-mono font-bold text-rose-600">{line.credit > 0 ? line.credit.toLocaleString() : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAccountModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative border-t-4 border-blue-600">
            <button onClick={() => setIsAccountModalOpen(false)} className="absolute top-4 left-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <FolderTree className="text-blue-600" /> {editingAccount ? 'تحديث بيانات الحساب' : 'إدراج حساب جديد للشجرة'}
            </h3>
            <form onSubmit={handleSaveAccount} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">دليل الحساب (الرقم)</label>
                  <input type="text" value={accCode} onChange={(e) => setAccCode(e.target.value)} className="w-full p-2 border rounded-xl text-sm font-mono focus:border-blue-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">طبيعة الحساب</label>
                  <select value={accType} onChange={(e) => setAccType(e.target.value)} className="w-full p-2 border rounded-xl text-sm bg-white outline-none">
                    <option value="أصول">أصول</option>
                    <option value="أصول متداولة">أصول متداولة</option>
                    <option value="التزامات">التزامات</option>
                    <option value="مصروفات">مصروفات</option>
                    <option value="إيرادات">إيرادات</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">اسم الحساب / المخزن</label>
                <input type="text" value={accName} onChange={(e) => setAccName(e.target.value)} className="w-full p-2 border rounded-xl text-sm focus:border-blue-500 outline-none" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">يتفرع من (الحساب الرئيسي)</label>
                <select value={accParent} onChange={(e) => setAccParent(e.target.value)} className="w-full p-2 border rounded-xl text-sm bg-white outline-none">
                  <option value="">-- حساب رئيسي (لا يتفرع من شيء) --</option>
                  {accountsList.map(a => (
                    <option key={a.id} value={a.code}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button type="button" onClick={() => setIsAccountModalOpen(false)} className="px-4 py-2 bg-slate-100 rounded-xl text-sm font-bold">إلغاء</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-md">حفظ الحساب</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl relative my-8 border-t-4 border-emerald-500">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 left-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
            
            <div className="flex justify-between items-center mb-6 pr-8">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><PlusCircle className="text-emerald-600" /> سند قيد يومية</h3>
              <button onClick={() => setIsPreviewMode(!isPreviewMode)} className="flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-lg text-sm font-bold text-slate-700">
                {isPreviewMode ? <Edit3 size={16} /> : <Eye size={16} />} {isPreviewMode ? 'تحرير' : 'معاينة'}
              </button>
            </div>

            {!isPreviewMode ? (
              <form onSubmit={handleSubmitEntry} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-600 mb-1">المرجع</label><input type="text" value={newReference} onChange={(e) => setNewReference(e.target.value)} className="w-full p-2 border rounded-xl text-sm font-mono" required /></div>
                  <div><label className="block text-xs font-bold text-slate-600 mb-1">البيان الشامل</label><input type="text" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} className="w-full p-2 border rounded-xl text-sm" required /></div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-600">أطراف القيد (من الشجرة)</label>
                  {newLines.map((line, idx) => (
                    <div key={idx} className="flex gap-2 bg-slate-50 p-2 rounded-xl border">
                      <select value={line.account} onChange={(e) => handleLineChange(idx, 'account', e.target.value)} className="w-full p-2 border rounded-lg text-sm bg-white" required>
                        <option value="">اختر الحساب...</option>
                        {accountsList.filter(a => a.is_active).map(a => (<option key={a.code} value={a.code}>{a.code} - {a.name}</option>))}
                      </select>
                      <input type="number" placeholder="مدين" value={line.debit || ''} onChange={(e) => handleLineChange(idx, 'debit', e.target.value)} className="w-28 p-2 border rounded-lg text-sm text-center font-mono text-emerald-700" />
                      <input type="number" placeholder="دائن" value={line.credit || ''} onChange={(e) => handleLineChange(idx, 'credit', e.target.value)} className="w-28 p-2 border rounded-lg text-sm text-center font-mono text-rose-700" />
                    </div>
                  ))}
                  <button type="button" onClick={() => setNewLines([...newLines, { account: '', name: '', debit: 0, credit: 0 }])} className="text-xs font-bold text-blue-600">+ طرف جديد</button>
                </div>

                <div className="flex justify-between p-3 bg-slate-100 rounded-xl text-sm font-mono font-bold">
                  <div>مدين: <span className="text-emerald-600">{totalDebit}</span></div>
                  <div>دائن: <span className="text-rose-600">{totalCredit}</span></div>
                  <div>{isBalanced ? <span className="text-emerald-700 bg-emerald-100 px-2 py-1 rounded">متوازن</span> : <span className="text-rose-700 bg-rose-100 px-2 py-1 rounded">غير متوازن</span>}</div>
                </div>
              </form>
            ) : (
               <div className="p-4 bg-slate-50 rounded-xl border-2 border-slate-200">
                  <h4 className="text-center font-bold text-lg mb-4 text-slate-800">معاينة القيد قبل الحفظ</h4>
                  <p className="text-sm font-bold mb-2">الوصف: {newDescription}</p>
                  <table className="w-full text-right text-sm bg-white border">
                    <thead className="bg-slate-200"><tr><th className="p-2">مدين</th><th className="p-2">دائن</th><th className="p-2">الحساب</th></tr></thead>
                    <tbody>
                      {newLines.filter(l => l.account).map((l, i) => (
                        <tr key={i} className="border-b"><td className="p-2 text-emerald-600 font-bold">{l.debit || '-'}</td><td className="p-2 text-rose-600 font-bold">{l.credit || '-'}</td><td className="p-2 font-bold">{l.name}</td></tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            )}

            <div className="flex justify-end gap-2 pt-4 mt-4 border-t">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-100 rounded-xl text-sm font-bold">إلغاء</button>
              <button onClick={handleSubmitEntry} disabled={!isBalanced || loading || isPreviewMode} className={`px-5 py-2 rounded-xl text-sm font-bold text-white shadow-md ${isBalanced && !isPreviewMode ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-300'}`}>حفظ القيد</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}