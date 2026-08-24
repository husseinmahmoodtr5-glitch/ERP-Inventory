import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Calculator, ArrowLeftRight, FileText, DollarSign, TrendingUp, CheckCircle2,
  PlusCircle, X, Search, Trash2, Printer, Eye, Edit3, FolderTree, Edit,
  CornerDownLeft, BarChart3, Download, ChevronDown, Bell
} from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

interface JournalLine {
  account: string;
  name: string;
  debit: number;
  credit: number;
  quantity?: number;
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

// واجهة الإشعارات الواردة لقسم المحاسبة
interface NotificationItem {
  id: number;
  message: string;
  reference: string;
  amount: number;
  isRead: boolean;
  date: string;
}

// -----------------------------------------------------------------------------
// Component: القائمة المنسدلة الاحترافية القابلة للبحث (مع حماية دفاعية)
// -----------------------------------------------------------------------------
interface SearchableDropdownProps {
  options: AccountItem[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  allowClear?: boolean;
  clearText?: string;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({ options = [], value, onChange, placeholder, allowClear, clearText }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      const safeOptions = Array.isArray(options) ? options : [];
      const selected = safeOptions.find(opt => opt?.code === value);
      if (selected) {
        setInputValue(`${selected.code} - ${selected.name}`);
      } else {
        setInputValue(value || '');
      }
    }
  }, [value, options, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        const safeOptions = Array.isArray(options) ? options : [];
        const selected = safeOptions.find(opt => opt?.code === value);
        if (selected) {
          setInputValue(`${selected.code} - ${selected.name}`);
        } else {
          setInputValue(value || '');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value, options]);

  const safeOptions = Array.isArray(options) ? options : [];
  const filteredOptions = safeOptions.filter(opt =>
    (opt?.code || '').toLowerCase().includes((inputValue || '').toLowerCase()) ||
    (opt?.name || '').toLowerCase().includes((inputValue || '').toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); 
      if (filteredOptions.length > 0) {
        const exactMatch = filteredOptions.find(opt => opt?.code === inputValue);
        const selected = exactMatch || filteredOptions[0];
        
        if (selected) {
          onChange(selected.code); 
          setInputValue(`${selected.code} - ${selected.name}`); 
          setIsOpen(false); 
        }
      }
    }
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
        <input
          type="text"
          className="w-full p-2.5 outline-none text-sm font-bold text-slate-800 bg-transparent"
          placeholder={placeholder}
          value={inputValue}
          onFocus={(e) => {
            e.target.select(); 
            setIsOpen(true);
          }} 
          onChange={(e) => {
            setInputValue(e.target.value); 
            setIsOpen(true); 
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="px-3 py-2.5 bg-slate-100 border-r border-slate-300 hover:bg-slate-200 text-slate-600 transition flex items-center justify-center cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
        >
          <ChevronDown size={18} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
          {allowClear && (
            <div
              className="p-3 hover:bg-rose-50 cursor-pointer border-b border-slate-100 text-rose-600 font-bold text-sm"
              onClick={() => {
                onChange('');
                setInputValue('');
                setIsOpen(false);
              }}
            >
              {clearText}
            </div>
          )}
          {filteredOptions.length > 0 ? (
            filteredOptions.map(opt => (
              <div
                key={opt?.code}
                className="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 flex items-center gap-3"
                onClick={() => {
                  onChange(opt?.code); 
                  setInputValue(`${opt?.code} - ${opt?.name}`);
                  setIsOpen(false);
                }}
              >
                <span className="font-mono text-blue-700 font-bold bg-blue-100/50 px-2 py-1 rounded border border-blue-200">{opt?.code}</span>
                <span className="font-bold text-slate-700 text-sm">{opt?.name}</span>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-sm font-bold text-slate-400">لا توجد حسابات مطابقة لبحثك</div>
          )}
        </div>
      )}
    </div>
  );
};
// -----------------------------------------------------------------------------

export default function Accounting() {
  const [activeTab, setActiveTab] = useState<'ENTRIES' | 'ACCOUNTS' | 'REPORTS'>('ENTRIES');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accountsList, setAccountsList] = useState<AccountItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  
  const [newReference, setNewReference] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newDescription, setNewDescription] = useState('');
  const [newLines, setNewLines] = useState<JournalLine[]>([
    { account: '', name: '', debit: 0, credit: 0, quantity: 0 },
    { account: '', name: '', debit: 0, credit: 0, quantity: 0 }
  ]);

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountItem | null>(null);
  const [accCode, setAccCode] = useState('');
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState('أصول متداولة');
  const [accParent, setAccParent] = useState('');

  const [reportAccount, setReportAccount] = useState('');

  // إعدادات الإشعارات (الجرس 🔔)
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    { id: 1, message: "إشعار من المخزن: تم تجهيز طلبية مبيعات رقم 101. يرجى إثبات القيد المالي للمبيعات والمخزون.", amount: 5000000, reference: "101", isRead: false, date: "الآن" },
    { id: 2, message: "إشعار من المخزن: تم تجهيز طلبية مبيعات رقم 24/2026. يرجى إثبات القيد المالي.", amount: 1050000, reference: "24/2026", isRead: false, date: "قبل 5 دقائق" }
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

  useEffect(() => {
    fetchEntries();
    fetchAccounts();
  }, []);

  // جلب القيود
  const fetchEntries = async () => {
    try {
      if (supabase) {
        const { data, error } = await supabase.from('journal_entries').select('*').order('created_at', { ascending: false }).limit(300);
        if (error) throw error;
        if (data) {
          const sortedData = data.sort((a, b) => (parseInt(b?.id) || 0) - (parseInt(a?.id) || 0));
          setEntries(sortedData);
          return;
        }
      }
      setEntries([]);
    } catch (error) {
      console.error('Error fetching entries:', error);
    }
  };

  // جلب الحسابات
  const fetchAccounts = async () => {
    try {
      if (supabase) {
        const { data, error } = await supabase.from('accounts').select('*').order('code', { ascending: true });
        if (error) throw error;
        if (data && data.length > 0) {
          setAccountsList(data);
          return;
        }
      }
      setAccountsList([]);
    } catch (e) {
      console.error('Error fetching accounts:', e);
    }
  };

  const accountBalancesMap = useMemo(() => {
    const map = new Map<string, number>();
    const safeEntries = Array.isArray(entries) ? entries : [];
    safeEntries.forEach(entry => {
      const safeLines = Array.isArray(entry?.lines) ? entry.lines : [];
      safeLines.forEach(line => {
        if (line?.account) {
          const current = map.get(line.account) || 0;
          map.set(line.account, current + ((Number(line.debit) || 0) - (Number(line.credit) || 0)));
        }
      });
    });
    return map;
  }, [entries]);

  const getAccountLiveBalance = (accountCode: string) => {
    return accountBalancesMap.get(accountCode) || 0;
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accCode || !accName) return alert('الرجاء تعبئة الحقول الأساسية');

    try {
      const newAcc: AccountItem = {
        id: editingAccount ? editingAccount.id : Date.now().toString(),
        code: accCode,
        name: accName,
        type: accType,
        parent_code: accParent || null,
        is_active: true
      };

      if (editingAccount) {
        setAccountsList(accountsList.map(a => a?.id === editingAccount.id ? newAcc : a));
      } else {
        setAccountsList([...accountsList, newAcc].sort((a, b) => (a?.code || '').localeCompare(b?.code || '')));
      }
      setIsAccountModalOpen(false);
      resetAccountForm();
    } catch (error: any) {
      alert('خطأ في حفظ الحساب: ' + error?.message);
    }
  };

  const handleDeleteAccount = (id: string) => {
    if (window.confirm('تنبيه: هل أنت متأكد من حذف هذا الحساب نهائياً من الشجرة؟')) {
      setAccountsList(accountsList.filter(a => a?.id !== id && a?.parent_code !== id));
    }
  };

  const handleToggleAccountStatus = (id: string, currentStatus: boolean) => {
    setAccountsList(accountsList.map(acc => acc?.id === id ? { ...acc, is_active: !currentStatus } : acc));
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
    const safeAccounts = Array.isArray(accounts) ? accounts : [];
    const children = safeAccounts.filter(acc => acc?.parent_code === parentId);
    children.forEach(child => {
      if (child) {
        tree.push({ ...child, depth });
        tree = tree.concat(buildTree(accounts, child.code, depth + 1));
      }
    });
    return tree;
  };

  const hierarchicalAccounts = useMemo(() => buildTree(accountsList), [accountsList]);

  const handleOpenNewEntryModal = () => {
    setEditingEntryId(null);
    setNewReference(''); 
    setNewDate(new Date().toISOString().split('T')[0]);
    setNewDescription('');
    setNewLines([
      { account: '', name: '', debit: 0, credit: 0, quantity: 0 },
      { account: '', name: '', debit: 0, credit: 0, quantity: 0 }
    ]);
    setIsPreviewMode(false);
    setIsModalOpen(true);
  };

  // تفاعل الإشعار الذكي: فتح نافذة قيد معبأة مسبقاً
  const handleNotificationClick = (notif: NotificationItem) => {
    setNotifications(notifications.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
    setIsNotifOpen(false);

    setEditingEntryId(null);
    setNewReference(notif.reference);
    setNewDate(new Date().toISOString().split('T')[0]);
    setNewDescription(`إثبات تسوية مبيعات وصرف مخزني للطلبية رقم (${notif.reference}) بناءً على إشعار المخازن.`);
    
    setNewLines([
      { account: '', name: '', debit: notif.amount, credit: 0, quantity: 0 },
      { account: '', name: '', debit: 0, credit: notif.amount, quantity: 0 }
    ]);
    
    setIsPreviewMode(false);
    setIsModalOpen(true);
  };

  const handleEditEntry = (entry: JournalEntry) => {
    if (!entry) return;
    setEditingEntryId(entry.id);
    setNewReference(entry.reference || '');
    setNewDate(entry.date || new Date().toISOString().split('T')[0]);
    setNewDescription(entry.description || '');
    setNewLines(Array.isArray(entry.lines) ? [...entry.lines] : []); 
    setIsPreviewMode(false);
    setIsModalOpen(true);
  };

  const handleLineChange = (index: number, field: keyof JournalLine, value: string | number) => {
    const updatedLines = [...newLines];
    if (!updatedLines[index]) return;

    if (field === 'account') {
      const selectedAcc = accountsList.find(a => a?.code === value);
      updatedLines[index].account = value as string;
      updatedLines[index].name = selectedAcc ? selectedAcc.name : '';
    } else if (field === 'debit') {
      updatedLines[index].debit = Number(value) || 0;
      if (Number(value) > 0) updatedLines[index].credit = 0;
    } else if (field === 'credit') {
      updatedLines[index].credit = Number(value) || 0;
      if (Number(value) > 0) updatedLines[index].debit = 0;
    } else if (field === 'quantity') {
      updatedLines[index].quantity = Number(value) || 0;
    }
    setNewLines(updatedLines);
  };

  const totalDebit = newLines.reduce((sum, line) => sum + (Number(line?.debit) || 0), 0);
  const totalCredit = newLines.reduce((sum, line) => sum + (Number(line?.credit) || 0), 0);
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;

  const generateNextId = () => {
    const safeEntries = Array.isArray(entries) ? entries : [];
    if (safeEntries.length === 0) return '1';
    const maxId = Math.max(...safeEntries.map(e => parseInt(e?.id) || 0));
    return (maxId + 1).toString();
  };

  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) return alert('القيد غير متوازن! راجع الجانب المدين والدائن.');

    setLoading(true);
    try {
      const entryData: JournalEntry = {
        id: editingEntryId || generateNextId(),
        date: newDate,
        reference: newReference || '-',
        description: newDescription,
        lines: (Array.isArray(newLines) ? newLines : []).filter(l => l?.account !== ''),
      };

      if (supabase) {
        if (editingEntryId) {
          const { error } = await supabase.from('journal_entries').update(entryData).eq('id', editingEntryId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('journal_entries').insert([entryData]);
          if (error) throw error;
        }
      }

      if (editingEntryId) {
        setEntries(entries.map(e => e?.id === editingEntryId ? entryData : e));
      } else {
        setEntries([entryData, ...entries]);
        
        setTimeout(() => {
          alert(`✅ تم حفظ القيد المالي بنجاح!\nتم إرسال إشعار آلي لـ "قسم المبيعات" باكتمال التسوية المالية.`);
        }, 300);
      }
      
      setIsModalOpen(false);
    } catch (error: any) {
      alert('خطأ في الحفظ السحابي: ' + (error?.message || error));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا القيد من النظام نهائياً؟ سيؤثر هذا على كشوفات الحسابات.')) {
      try {
        if (supabase) {
          const { error } = await supabase.from('journal_entries').delete().eq('id', id);
          if (error) throw error;
        }
        setEntries(entries.filter(e => e?.id !== id));
      } catch (error: any) {
        alert('خطأ أثناء الحذف: ' + error?.message);
      }
    }
  };

  const handlePrintEntry = (entry: JournalEntry) => {
    if (!entry) return;
    const safeLines = Array.isArray(entry.lines) ? entry.lines : [];
    const totalDeb = safeLines.reduce((sum, line) => sum + (Number(line?.debit) || 0), 0);
    const totalCred = safeLines.reduce((sum, line) => sum + (Number(line?.credit) || 0), 0);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('يرجى السماح بفتح النوافذ المنبثقة للطباعة');

    printWindow.document.write(`
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>سند قيد رقم - ${entry.id}</title>
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
        </style>
      </head>
      <body>
        <div class="header">
          <h2>ASIA CABLES COMPANY</h2>
          <p>سند قيد يومية معتمد - Quantum ERP</p>
        </div>
        <table class="info-table">
          <tr>
            <td><strong>رقم القيد:</strong> ${entry.id}</td>
            <td style="text-align: left;"><strong>التاريخ:</strong> ${entry.date || ''}</td>
          </tr>
          <tr>
            <td><strong>المرجع:</strong> ${entry.reference || '-'}</td>
            <td style="text-align: left;"></td>
          </tr>
        </table>
        <div class="desc-box"><strong>بيان القيد:</strong> ${entry.description || ''}</div>
        <table class="main-table">
          <thead>
            <tr>
              <th>رقم الحساب</th>
              <th>اسم الحساب المالي</th>
              <th style="text-align: center;">الكمية</th>
              <th style="text-align: center;">مدين</th>
              <th style="text-align: center;">دائن</th>
            </tr>
          </thead>
          <tbody>
            ${safeLines.map(line => `
              <tr>
                <td>${line?.account || ''}</td>
                <td><strong>${line?.name || ''}</strong></td>
                <td style="text-align: center;">${line?.quantity && Number(line.quantity) > 0 ? Number(line.quantity).toLocaleString() : '-'}</td>
                <td style="text-align: center; color: #16a34a; font-weight: bold;">${Number(line?.debit) > 0 ? Number(line.debit).toLocaleString() : '-'}</td>
                <td style="text-align: center; color: #dc2626; font-weight: bold;">${Number(line?.credit) > 0 ? Number(line.credit).toLocaleString() : '-'}</td>
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
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const exportReportToExcel = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "رقم القيد,التاريخ,المرجع,البيان,رقم الحساب,اسم الحساب,مدين,دائن\n";
    
    const safeEntries = Array.isArray(entries) ? entries : [];
    safeEntries.forEach(entry => {
      const safeLines = Array.isArray(entry?.lines) ? entry.lines : [];
      safeLines.forEach(line => {
        if (!reportAccount || line?.account === reportAccount) {
          csvContent += `"${entry?.id || ''}","${entry?.date || ''}","${entry?.reference || ''}","${entry?.description || ''}","${line?.account || ''}","${line?.name || ''}",${Number(line?.debit) || 0},${Number(line?.credit) || 0}\n`;
        }
      });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Quantum_ERP_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const safeEntriesFilter = Array.isArray(entries) ? entries : [];
  const filteredEntries = safeEntriesFilter.filter(e => {
    if (!e) return false;
    const q = (searchQuery || '').toLowerCase();
    const refMatch = (e.reference || '').toLowerCase().includes(q);
    const descMatch = (e.description || '').toLowerCase().includes(q);
    const linesMatch = Array.isArray(e.lines) && e.lines.some(l => 
      (l?.name || '').toLowerCase().includes(q) || (l?.account || '').includes(q)
    );
    const idMatch = (e.id || '').toLowerCase().includes(q);
    return refMatch || descMatch || linesMatch || idMatch;
  });

  return (
    <div dir="rtl" className="p-4 md:p-6 bg-slate-50 min-h-screen font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calculator className="text-blue-600" /> Quantum ERP - قسم الحسابات والمالية
          </h1>
          <p className="text-sm text-slate-500 mt-1">النظام المالي الموحد لشركة آسيا للكابلات والمنتجات الصناعية.</p>
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
            <button 
              onClick={() => setActiveTab('REPORTS')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'REPORTS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}
            >
              <BarChart3 size={18} /> التقارير والكشوفات
            </button>
          </div>
          
          {/* أيقونة الإشعارات (الجرس) */}
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
                  <span className="font-bold text-slate-800 text-sm">إشعارات المحاسبة</span>
                  <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">{unreadCount} جديد</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-sm font-bold">لا توجد إشعارات حالياً</div>
                  ) : (
                    notifications.map(notif => (
                      <div 
                        key={notif.id} 
                        className={`p-3 border-b border-slate-50 cursor-pointer transition ${notif.isRead ? 'bg-white hover:bg-slate-50' : 'bg-blue-50/50 hover:bg-blue-50'}`}
                        onClick={() => handleNotificationClick(notif)}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-xs font-bold ${notif.isRead ? 'text-slate-500' : 'text-blue-700'}`}>طلبية مبيعات #{notif.reference}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{notif.date}</span>
                        </div>
                        <p className={`text-sm ${notif.isRead ? 'text-slate-600' : 'text-slate-800 font-medium'}`}>{notif.message}</p>
                        {!notif.isRead && (
                          <div className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded w-fit">
                            <PlusCircle size={12} /> اضغط لإنشاء القيد الآلي
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button 
            onClick={handleOpenNewEntryModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 shadow-md w-full md:w-auto justify-center"
          >
            <PlusCircle size={18} /> إنشاء سند قيد
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div><div className="text-xs font-bold text-slate-400">إجمالي القيود المسجلة</div><div className="text-2xl font-bold text-blue-600 mt-1">{entries.length} قيد مزدوج</div></div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><FileText size={24} /></div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div><div className="text-xs font-bold text-slate-400">حالة التوازن المحاسبي</div><div className="text-2xl font-bold text-emerald-600 mt-1 flex items-center gap-1"><CheckCircle2 size={20} /> متوازن 100%</div></div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp size={24} /></div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div><div className="text-xs font-bold text-slate-400">عدد الحسابات المعتمدة</div><div className="text-xl font-bold text-slate-800 mt-1 font-mono">{accountsList.length} حساب مالي</div></div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><DollarSign size={24} /></div>
        </div>
      </div>

      {activeTab === 'ACCOUNTS' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FolderTree className="text-blue-600" size={22} /> هيكل شجرة الحسابات والدليل العراقي الموحد
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
                  <th className="p-3 font-bold text-center">الرصيد اللحظي</th>
                  <th className="p-3 font-bold text-center">الحالة</th>
                  <th className="p-3 font-bold text-center">أدوات التحكم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {hierarchicalAccounts.map((acc) => {
                  if (!acc) return null;
                  const liveBal = getAccountLiveBalance(acc.code);
                  return (
                    <tr key={acc.id} className="hover:bg-blue-50/50 transition">
                      <td className="p-3 font-mono font-bold text-blue-700">{acc.code}</td>
                      <td className="p-3 font-bold text-slate-800 flex items-center">
                        <span style={{ paddingRight: `${(acc.depth || 0) * 25}px` }} className="flex items-center gap-2">
                          {(acc.depth || 0) > 0 && <CornerDownLeft size={16} className="text-slate-400" />}
                          {acc.name}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">{acc.type}</td>
                      <td className="p-3 text-center font-mono font-bold">
                        <span className={liveBal >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {liveBal.toLocaleString()} د.ع
                        </span>
                      </td>
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
                  );
                })}
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
              placeholder="ابحث عن قيد بواسطة رقم القيد، المرجع، الوصف، أو اسم الحساب..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none focus:outline-none text-sm font-medium"
            />
          </div>

          {filteredEntries.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-sm">
              <FileText className="mx-auto text-slate-300 mb-4" size={48} />
              <h3 className="text-lg font-bold text-slate-600">لا توجد أي قيود مسجلة بعد</h3>
              <p className="text-sm text-slate-400 mt-2">ابدأ بإضافة أول قيد يومية عبر الزر في الأعلى.</p>
            </div>
          )}

          {filteredEntries.map((entry) => {
            if (!entry) return null;
            const safeLines = Array.isArray(entry.lines) ? entry.lines : [];
            return (
              <div key={entry.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-800 p-4 text-white flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center gap-3">
                    <span className="bg-blue-600 px-3 py-1 rounded-lg text-xs font-mono font-bold">قيد رقم: {entry.id}</span>
                    <span className="font-bold text-sm">المرجع: {entry.reference || '-'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-300 font-mono">التاريخ: {entry.date || ''}</span>
                    <button onClick={() => handleEditEntry(entry)} className="bg-emerald-600 hover:bg-emerald-500 transition px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold shadow-sm"><Edit3 size={14} /> تعديل</button>
                    <button onClick={() => handlePrintEntry(entry)} className="bg-slate-700 hover:bg-slate-600 transition px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold border border-slate-600 shadow-sm"><Printer size={14} /> طباعة</button>
                    <button onClick={() => handleDeleteEntry(entry.id)} className="bg-rose-600 hover:bg-rose-500 transition px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold"><Trash2 size={14} /> حذف</button>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-sm font-bold text-slate-700 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-400 ml-2">البيان الشامل:</span> {entry.description || ''}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                      <thead className="bg-slate-100 text-slate-700 font-bold border-b-2 border-slate-200">
                        <tr>
                          <th className="p-3">رقم الحساب</th>
                          <th className="p-3">اسم الحساب المالي</th>
                          <th className="p-3 text-center">الكمية</th>
                          <th className="p-3 text-center text-emerald-700">مدين (Debit)</th>
                          <th className="p-3 text-center text-rose-700">دائن (Credit)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {safeLines.map((line, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3 font-mono font-bold text-slate-500">{line?.account || ''}</td>
                            <td className="p-3 font-bold text-slate-800">{line?.name || ''}</td>
                            <td className="p-3 text-center font-mono text-slate-600">{line?.quantity && Number(line.quantity) > 0 ? Number(line.quantity).toLocaleString() : '-'}</td>
                            <td className="p-3 text-center font-mono font-bold text-emerald-600">{Number(line?.debit) > 0 ? Number(line.debit).toLocaleString() : '-'}</td>
                            <td className="p-3 text-center font-mono font-bold text-rose-600">{Number(line?.credit) > 0 ? Number(line.credit).toLocaleString() : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'REPORTS' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <BarChart3 className="text-blue-600" size={22} /> كشوفات الحسابات والتقارير الاحترافية
              </h2>
              <p className="text-xs text-slate-500 mt-1">استخراج كشوفات تفصيلية للزبائن والمصارف والمخازن وإدارة حركاتها مباشرة.</p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <button 
                onClick={handleOpenNewEntryModal}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow flex-1 md:flex-none justify-center"
              >
                <PlusCircle size={16} /> سند جديد
              </button>
              <button 
                onClick={exportReportToExcel}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow flex-1 md:flex-none justify-center"
              >
                <Download size={16} /> تصدير Excel
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">اختر الحساب / العميل المطلوب إصدار كشف له</label>
              <div className="relative">
                 <SearchableDropdown
                   options={accountsList}
                   value={reportAccount}
                   onChange={setReportAccount}
                   placeholder="اكتب كود أو اسم الحساب للبحث..."
                   allowClear={true}
                   clearText="-- عرض كل الحركات (كشف عام) --"
                 />
              </div>
            </div>
            <div className="flex items-end">
              <div className="text-sm font-bold text-slate-700 bg-white p-2.5 rounded-xl border w-full flex justify-between items-center">
                <span>الرصيد الحالي للحساب المختار:</span>
                <span className={`font-mono font-bold text-lg ${getAccountLiveBalance(reportAccount) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {reportAccount ? `${getAccountLiveBalance(reportAccount).toLocaleString()} د.ع` : 'اختر حساباً'}
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm border-collapse">
              <thead className="bg-slate-100 text-slate-700 border-b-2 border-slate-200">
                <tr>
                  <th className="p-3">رقم القيد</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">المرجع</th>
                  <th className="p-3">بيان الحركة</th>
                  <th className="p-3">الحساب</th>
                  <th className="p-3 text-center text-emerald-700">مدين</th>
                  <th className="p-3 text-center text-rose-700">دائن</th>
                  <th className="p-3 text-center">أدوات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.length === 0 ? (
                  <tr><td colSpan={8} className="p-6 text-center text-slate-400 font-bold">لا توجد حركات مسجلة حالياً. ابدأ بإضافة قيد جديد.</td></tr>
                ) : (
                  entries.flatMap(entry => {
                    if (!entry) return [];
                    const safeLines = Array.isArray(entry.lines) ? entry.lines : [];
                    return safeLines
                      .filter(line => !reportAccount || line?.account === reportAccount)
                      .map((line, idx) => (
                        <tr key={`${entry.id}-${idx}`} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-bold text-blue-600">{entry.id}</td>
                          <td className="p-3 font-mono text-xs">{entry.date || ''}</td>
                          <td className="p-3 text-xs">{entry.reference || ''}</td>
                          <td className="p-3 font-medium text-slate-800">{entry.description || ''}</td>
                          <td className="p-3 text-slate-600 font-bold">{line?.account || ''} - {line?.name || ''}</td>
                          <td className="p-3 text-center font-mono font-bold text-emerald-600">{Number(line?.debit) > 0 ? Number(line.debit).toLocaleString() : '-'}</td>
                          <td className="p-3 text-center font-mono font-bold text-rose-600">{Number(line?.credit) > 0 ? Number(line.credit).toLocaleString() : '-'}</td>
                          <td className="p-3 text-center flex justify-center gap-2">
                            <button onClick={() => handleEditEntry(entry)} className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg transition" title="تعديل القيد"><Edit3 size={16} /></button>
                            <button onClick={() => handlePrintEntry(entry)} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition" title="طباعة القيد"><Printer size={16} /></button>
                            <button onClick={() => handleDeleteEntry(entry.id)} className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition" title="حذف القيد نهائياً"><Trash2 size={16} /></button>
                          </td>
                        </tr>
                      ));
                  })
                )}
              </tbody>
            </table>
          </div>
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
                  <label className="block text-xs font-bold text-slate-600 mb-1">دليل الحساب (الكود)</label>
                  <input type="text" value={accCode} onChange={(e) => setAccCode(e.target.value)} className="w-full p-2 border rounded-xl text-sm font-mono focus:border-blue-500 outline-none" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">طبيعة الحساب</label>
                  <select value={accType} onChange={(e) => setAccType(e.target.value)} className="w-full p-2 border rounded-xl text-sm bg-white outline-none">
                    <option value="أصول">أصول</option>
                    <option value="أصول متداولة">أصول متداولة</option>
                    <option value="أصول ثابته">أصول ثابته</option>
                    <option value="التزامات">التزامات</option>
                    <option value="مصروفات وتكاليف">مصروفات وتكاليف</option>
                    <option value="إيرادات ومبيعات">إيرادات ومبيعات</option>
                    <option value="عملاء">عملاء</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">اسم الحساب / المخزن / الشركة</label>
                <input type="text" value={accName} onChange={(e) => setAccName(e.target.value)} className="w-full p-2 border rounded-xl text-sm focus:border-blue-500 outline-none" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">يتفرع من (الحساب الرئيسي)</label>
                <SearchableDropdown
                  options={accountsList}
                  value={accParent}
                  onChange={setAccParent}
                  placeholder="ابحث لاختيار الحساب الأب..."
                  allowClear={true}
                  clearText="-- حساب رئيسي (لا يتفرع من شيء) --"
                />
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
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl relative my-8 border-t-4 border-emerald-500">
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 left-4 text-slate-400 hover:text-slate-600"><X size={20} /></button>
            
            <div className="flex justify-between items-center mb-6 pr-8">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><PlusCircle className="text-emerald-600" /> {editingEntryId ? 'تعديل سند القيد' : 'سند قيد يومية مزدوج'}</h3>
              <button onClick={() => setIsPreviewMode(!isPreviewMode)} className="flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-lg text-sm font-bold text-slate-700">
                {isPreviewMode ? <Edit3 size={16} /> : <Eye size={16} />} {isPreviewMode ? 'تعديل البيانات' : 'معاينة القيد قبل الحفظ'}
              </button>
            </div>

            {!isPreviewMode ? (
              <form onSubmit={handleSubmitEntry} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">المرجع</label>
                    <input type="text" value={newReference} onChange={(e) => setNewReference(e.target.value)} className="w-full p-2 border rounded-xl text-sm font-mono" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">تاريخ القيد (يدعم الأثر الرجعي)</label>
                    <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full p-2 border rounded-xl text-sm font-mono" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">البيان الشامل (سبب الحركة)</label>
                    <input type="text" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} className="w-full p-2 border rounded-xl text-sm" placeholder="مثلاً: إيداع نقدي، أو بيع كابلات..." required />
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="block text-xs font-bold text-slate-600">أطراف القيد المحاسبي (البحث الذكي):</label>
                  {newLines.map((line, idx) => {
                    const accLiveBal = line?.account ? getAccountLiveBalance(line.account) : null;
                    return (
                      <div key={idx} className="bg-slate-50 p-3 rounded-xl border space-y-2">
                        <div className="flex flex-wrap md:flex-nowrap gap-2 items-center">
                          <div className="w-full md:w-2/5 relative">
                             <SearchableDropdown
                               options={accountsList.filter(a => a?.is_active)}
                               value={line?.account || ''}
                               onChange={(val) => handleLineChange(idx, 'account', val)}
                               placeholder="اختر الحساب أو اكتب كود للبحث..."
                             />
                          </div>
                          <input 
                            type="number" 
                            placeholder="الكمية (اختياري)" 
                            value={line?.quantity || ''} 
                            onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)} 
                            className="w-full md:w-1/5 p-2 border rounded-lg text-sm text-center font-mono text-slate-700 outline-none" 
                          />
                          <input 
                            type="number" 
                            placeholder="مدين (Debit)" 
                            value={line?.debit || ''} 
                            onChange={(e) => handleLineChange(idx, 'debit', e.target.value)} 
                            className="w-full md:w-1/5 p-2 border rounded-lg text-sm text-center font-mono text-emerald-700 font-bold outline-none focus:ring-2 focus:ring-emerald-500" 
                          />
                          <input 
                            type="number" 
                            placeholder="دائن (Credit)" 
                            value={line?.credit || ''} 
                            onChange={(e) => handleLineChange(idx, 'credit', e.target.value)} 
                            className="w-full md:w-1/5 p-2 border rounded-lg text-sm text-center font-mono text-rose-700 font-bold outline-none focus:ring-2 focus:ring-rose-500" 
                          />
                        </div>
                        {accLiveBal !== null && (
                          <div className="text-xs font-mono font-bold px-1 text-slate-500 flex items-center gap-1">
                            <span>الرصيد اللحظي لهذا الحساب حالياً:</span>
                            <span className={accLiveBal >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                              {accLiveBal.toLocaleString()} د.ع
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button type="button" onClick={() => setNewLines([...newLines, { account: '', name: '', debit: 0, credit: 0, quantity: 0 }])} className="text-xs font-bold text-blue-600 hover:underline">+ إضافة طرف جديد للقيد</button>
                </div>

                <div className="flex justify-between p-3 bg-slate-100 rounded-xl text-sm font-mono font-bold mt-4">
                  <div>إجمالي المدين: <span className="text-emerald-600">{totalDebit.toLocaleString()}</span></div>
                  <div>إجمالي الدائن: <span className="text-rose-600">{totalCredit.toLocaleString()}</span></div>
                  <div>{isBalanced ? <span className="text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded">متوازن 100%</span> : <span className="text-rose-700 bg-rose-100 px-2.5 py-1 rounded">غير متوازن</span>}</div>
                </div>
              </form>
            ) : (
               <div className="p-4 bg-slate-50 rounded-xl border-2 border-slate-200 space-y-4">
                  <h4 className="text-center font-bold text-lg text-slate-800">معاينة تفاصيل السند قبل الاعتماد والحفظ</h4>
                  <div className="flex justify-between text-sm font-bold border-b pb-2">
                    <span>المرجع: {newReference}</span>
                    <span>التاريخ: {newDate}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-700">البيان: {newDescription}</p>
                  <table className="w-full text-right text-sm bg-white border">
                    <thead className="bg-slate-200">
                      <tr>
                        <th className="p-2">رقم الحساب</th>
                        <th className="p-2">اسم الحساب</th>
                        <th className="p-2 text-center">الكمية</th>
                        <th className="p-2 text-center">مدين</th>
                        <th className="p-2 text-center">دائن</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newLines.filter(l => l?.account).map((l, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2 font-mono text-slate-600">{l?.account || ''}</td>
                          <td className="p-2 font-bold">{l?.name || ''}</td>
                          <td className="p-2 text-center font-mono">{l?.quantity || '-'}</td>
                          <td className="p-2 text-center text-emerald-600 font-bold">{Number(l?.debit) > 0 ? Number(l.debit).toLocaleString() : '-'}</td>
                          <td className="p-2 text-center text-rose-600 font-bold">{Number(l?.credit) > 0 ? Number(l.credit).toLocaleString() : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            )}

            <div className="flex justify-end gap-2 pt-4 mt-4 border-t">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-100 rounded-xl text-sm font-bold">إلغاء</button>
              <button onClick={handleSubmitEntry} disabled={!isBalanced || loading || isPreviewMode} className={`px-5 py-2 rounded-xl text-sm font-bold text-white shadow-md ${isBalanced && !isPreviewMode ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-300'}`}>{editingEntryId ? 'تحديث القيد' : 'اعتماد وحفظ القيد'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}