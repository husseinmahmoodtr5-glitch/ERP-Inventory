import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  BookOpen, 
  ArrowLeftRight, 
  FileText, 
  DollarSign, 
  TrendingUp, 
  CheckCircle2,
  PlusCircle,
  X,
  UploadCloud,
  File,
  AlertCircle
} from 'lucide-react';

// --- الواجهات (Interfaces) ---
interface JournalLine {
  account: string;
  name: string;
  debit: number;
  credit: number;
}

interface PdfMetadata {
  fileName: string;
  uploadTimestamp: string;
}

interface JournalEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  lines: JournalLine[];
  pdfAttachment?: PdfMetadata | null;
}

export default function Accounting() {
  const [activeTab, setActiveTab] = useState<'ENTRIES' | 'ACCOUNTS'>('ENTRIES');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  
  // حالة مؤشر سعر الصرف
  const [exchangeRate, setExchangeRate] = useState<number>(1520);
  const [rateChange, setRateChange] = useState<'up' | 'down' | 'stable'>('stable');

  // حالة نافذة إضافة قيد جديد (Modal)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newReference, setNewReference] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLines, setNewLines] = useState<JournalLine[]>([
    { account: '', name: '', debit: 0, credit: 0 },
    { account: '', name: '', debit: 0, credit: 0 }
  ]);
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);

  // شجرة الحسابات الأساسية (تمت إضافة تكاليف التشغيل)
  const chartOfAccounts = [
    { code: '10101', name: 'مخزن المواد الخام', type: 'أصول متداولة' },
    { code: '10102', name: 'مخزن المنتجات التامة', type: 'أصول متداولة' },
    { code: '10200', name: 'حساب الإنتاج تحت التشغيل (WIP)', type: 'أصول وسيطة' },
    { code: '50100', name: 'تكلفة البضاعة المباعة / الهدر', type: 'مصروفات' },
    { code: '50201', name: 'أجور عمال الإنتاج', type: 'مصروفات تشغيلية' },
    { code: '50202', name: 'مصروفات الكهرباء والتشغيل', type: 'مصروفات تشغيلية' },
    { code: '20101', name: 'حساب الموردين', type: 'التزامات' },
    { code: '10301', name: 'الصندوق / النقدية', type: 'أصول متداولة' },
  ];

  // تأثير مؤشر سعر الصرف (يتحدث كل 3 ثواني)
  useEffect(() => {
    const interval = setInterval(() => {
      setExchangeRate(prev => {
        const change = Math.floor(Math.random() * 5) - 2; // تغير طفيف بين -2 و +2
        if (change > 0) setRateChange('up');
        else if (change < 0) setRateChange('down');
        else setRateChange('stable');
        return prev + change;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // جلب البيانات الأولية
  useEffect(() => {
    const savedEntries = localStorage.getItem('app_journal_entries');
    if (savedEntries) {
      setEntries(JSON.parse(savedEntries));
    } else {
      const defaultEntries: JournalEntry[] = [
        {
          id: 'JV-0001',
          date: new Date().toLocaleDateString('ar-IQ'),
          reference: 'PROD-2026-001',
          description: 'صرف خامات وتكاليف تشغيل لأمر الإنتاج (قيد مركب)',
          lines: [
            { account: '10200', name: 'حساب الإنتاج تحت التشغيل (WIP)', debit: 1450.00, credit: 0 },
            { account: '10101', name: 'مخزن المواد الخام', debit: 0, credit: 1299.20 },
            { account: '50201', name: 'أجور عمال الإنتاج', debit: 0, credit: 100.80 },
            { account: '50202', name: 'مصروفات الكهرباء والتشغيل', debit: 0, credit: 50.00 }
          ]
        }
      ];
      setEntries(defaultEntries);
      localStorage.setItem('app_journal_entries', JSON.stringify(defaultEntries));
    }
  }, []);

  // دوال التعامل مع نافذة القيد الجديد
  const handleAddLine = () => {
    setNewLines([...newLines, { account: '', name: '', debit: 0, credit: 0 }]);
  };

  const handleLineChange = (index: number, field: keyof JournalLine, value: any) => {
    const updatedLines = [...newLines];
    if (field === 'account') {
      const selectedAcc = chartOfAccounts.find(a => a.code === value);
      updatedLines[index].account = value;
      updatedLines[index].name = selectedAcc ? selectedAcc.name : '';
    } else {
      updatedLines[index][field] = Number(value);
    }
    setNewLines(updatedLines);
  };

  const totalDebit = newLines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredit = newLines.reduce((sum, line) => sum + (line.credit || 0), 0);
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;

  const handleSubmitEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) {
      alert('لا يمكن حفظ القيد: الجانب المدين لا يساوي الجانب الدائن!');
      return;
    }

    let pdfMeta: PdfMetadata | null = null;
    if (selectedPdf) {
      // محاكاة رفع الملف إلى Supabase وتسجيل البيانات
      pdfMeta = {
        fileName: selectedPdf.name,
        uploadTimestamp: new Date().toLocaleString('ar-IQ')
      };
    }

    const newEntry: JournalEntry = {
      id: `JV-${String(entries.length + 1).padStart(4, '0')}`,
      date: new Date().toLocaleDateString('ar-IQ'),
      reference: newReference || 'قيد يدوي',
      description: newDescription,
      lines: newLines.filter(l => l.account !== ''), // إزالة الأسطر الفارغة
      pdfAttachment: pdfMeta
    };

    const updatedEntries = [newEntry, ...entries];
    setEntries(updatedEntries);
    localStorage.setItem('app_journal_entries', JSON.stringify(updatedEntries));
    
    // تفريغ الحقول وإغلاق النافذة
    setNewReference('');
    setNewDescription('');
    setNewLines([{ account: '', name: '', debit: 0, credit: 0 }, { account: '', name: '', debit: 0, credit: 0 }]);
    setSelectedPdf(null);
    setIsModalOpen(false);
  };

  return (
    <div dir="rtl" className="p-4 md:p-6 bg-slate-50 min-h-screen font-sans relative">
      {/* الترويسة الرئيسية */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calculator className="text-blue-600" /> المحاسبة والتكاليف
          </h1>
          <p className="text-sm text-slate-500 mt-1">نظام القيود المزدوجة، السندات اليدوية، وأرشفة الفواتير.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex bg-slate-200 p-1 rounded-xl flex-grow md:flex-grow-0">
            <button 
              onClick={() => setActiveTab('ENTRIES')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'ENTRIES' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}
            >
              <ArrowLeftRight size={18} /> القيود والسندات
            </button>
            <button 
              onClick={() => setActiveTab('ACCOUNTS')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${activeTab === 'ACCOUNTS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}
            >
              <BookOpen size={18} /> الدليل المحاسبي
            </button>
          </div>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 w-full md:w-auto justify-center shadow-md"
          >
            <PlusCircle size={18} /> قيد / سند جديد
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

        {/* مؤشر سعر الصرف الحي المطور */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-1 h-full bg-blue-600"></div>
          <div>
            <div className="text-xsمرحباً! أنا جاهز تماماً. 

ما الموضوع أو المهمة التي تود أن نبدأ بها اليوم؟