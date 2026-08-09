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
  File
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

  // شجرة الحسابات الأساسية
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

  // تأثير مؤشر سعر الصرف الحي
  useEffect(() => {
    const interval = setInterval(() => {
      setExchangeRate(prev => {
        const change = Math.floor(Math.random() * 5) - 2;
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

  const handleAddLine = () => {
    setNewLines([...newLines, { account: '', name: '', debit: 0, credit: 0 }]);
  };

  const handleLineChange = (index: number, field: keyof JournalLine, value: string | number) => {
    const updatedLines = [...newLines];
    if (field === 'account') {
      const selectedAcc = chartOfAccounts.find(a => a.code === value);
      updatedLines[index].account = value as string;
      updatedLines[index].name = selectedAcc ? selectedAcc.name : '';
    } else if (field === 'debit' || field === 'credit') {
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
      alert('خطأ: الجانب المدين لا يساوي الجانب الدائن!');
      return;
    }

    let pdfMeta: PdfMetadata | null = null;
    if (selectedPdf) {
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
      lines: newLines.filter(l => l.account !== ''),
      pdfAttachment: pdfMeta
    };

    const updatedEntries = [newEntry, ...entries];
    setEntries(updatedEntries);
    localStorage.setItem('app_journal_entries', JSON.stringify(updatedEntries));
    
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

        {/* مؤشر سعر الصرف الحي */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className={`absolute top-0 right-0 w-1 h-full ${rateChange === 'up' ? 'bg-emerald-500' : rateChange === 'down' ? 'bg-rose-500' : 'bg-blue-600'}`}></div>
          <div>
            <div className="text-xs font-bold text-slate-400">سعر الصرف الحي (تحديث كل 3 ثوان)</div>
            <div className="text-xl font-bold text-slate-800 mt-1 font-mono">
              100$ = {exchangeRate.toLocaleString()} د.ع
            </div>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <DollarSign size={24} />
          </div>
        </div>
      </div>

      {/* تبويب القيود والسندات */}
      {activeTab === 'ENTRIES' && (
        <div className="space-y-6">
          {entries.map((entry) => (
            <div key={entry.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-800 p-4 text-white flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center gap-3">
                  <span className="bg-blue-600 px-3 py-1 rounded-lg text-xs font-mono font-bold">{entry.id}</span>
                  <span className="font-bold text-sm">المرجع: {entry.reference}</span>
                </div>
                <div className="text-xs text-slate-300 font-mono">{entry.date}</div>
              </div>

              <div className="p-5">
                <p className="text-sm font-bold text-slate-700 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center flex-wrap gap-2">
                  <span><span className="text-slate-400 ml-2">الوصف:</span> {entry.description}</span>
                  {entry.pdfAttachment && (
                    <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1 rounded-lg flex items-center gap-1 font-sans">
                      <File size={14} /> مرفق PDF: {entry.pdfAttachment.fileName} ({entry.pdfAttachment.uploadTimestamp})
                    </span>
                  )}
                </p>

                <div className="overflow-x-auto">
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
            </div>
          ))}
        </div>
      )}

      {/* تبويب الدليل المحاسبي */}
      {activeTab === 'ACCOUNTS' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <BookOpen className="text-blue-600" size={20} /> الدليل المحاسبي الشامل
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
                        نشط
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* نافذة إضافة قيد / سند يدوي (Modal) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl relative border border-slate-100 my-8">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X size={20} />
            </button>

            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <PlusCircle className="text-blue-600" size={20} /> إنشاء قيد / سند محاسبي جديد
            </h3>

            <form onSubmit={handleSubmitEntry} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">المرجع / رقم السند</label>
                  <input 
                    type="text" 
                    placeholder="مثال: REC-2026-001"
                    value={newReference}
                    onChange={(e) => setNewReference(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">بيان القيد / الوصف</label>
                  <input 
                    type="text" 
                    placeholder="شرح العملية المحاسبية والتكاليف..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* أسطر القيد */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-600">تفاصيل أطراف القيد (مدين / دائن)</label>
                {newLines.map((line, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <select 
                      value={line.account}
                      onChange={(e) => handleLineChange(idx, 'account', e.target.value)}
                      className="flex-2 p-2 border border-slate-300 rounded-lg text-sm bg-white"
                      required
                    >
                      <option value="">اختر الحساب...</option>
                      {chartOfAccounts.map(a => (
                        <option key={a.code} value={a.code}>{a.code} - {a.name}</option>
                      ))}
                    </select>

                    <input 
                      type="number" 
                      placeholder="مدين" 
                      value={line.debit || ''}
                      onChange={(e) => handleLineChange(idx, 'debit', e.target.value)}
                      className="w-28 p-2 border border-slate-300 rounded-lg text-sm text-center font-mono"
                    />

                    <input 
                      type="number" 
                      placeholder="دائن" 
                      value={line.credit || ''}
                      onChange={(e) => handleLineChange(idx, 'credit', e.target.value)}
                      className="w-28 p-2 border border-slate-300 rounded-lg text-sm text-center font-mono"
                    />
                  </div>
                ))}

                <button 
                  type="button" 
                  onClick={handleAddLine}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 mt-1"
                >
                  + إضافة طرف آخر للقيد
                </button>
              </div>

              {/* التحقق من التوازن */}
              <div className="flex justify-between items-center p-3 bg-slate-100 rounded-xl text-sm font-mono font-bold">
                <div>إجمالي المدين: <span className="text-emerald-600">{totalDebit.toFixed(2)}</span></div>
                <div>إجمالي الدائن: <span className="text-rose-600">{totalCredit.toFixed(2)}</span></div>
                <div>
                  {isBalanced ? (
                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded">متوازن</span>
                  ) : (
                    <span className="text-xs bg-rose-100 text-rose-800 px-2 py-1 rounded">غير متوازن</span>
                  )}
                </div>
              </div>

              {/* حقل رفع الفاتورة الورقية PDF */}
              <div className="border-2 border-dashed border-slate-300 p-4 rounded-xl text-center bg-slate-50">
                <UploadCloud className="mx-auto text-slate-400 mb-1" size={28} />
                <label className="cursor-pointer text-xs font-bold text-blue-600 hover:underline">
                  انقر هنا لرفع فاتورة ورقية بصيغة PDF
                  <input 
                    type="file" 
                    accept=".pdf" 
                    onChange={(e) => setSelectedPdf(e.target.files ? e.target.files[0] : null)}
                    className="hidden" 
                  />
                </label>
                {selectedPdf && (
                  <p className="text-xs text-emerald-600 font-bold mt-1">تم اختيار: {selectedPdf.name}</p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-slate-200 text-slate-700 hover:bg-slate-300"
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  disabled={!isBalanced}
                  className={`px-5 py-2 rounded-xl text-sm font-bold text-white transition ${isBalanced ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-400 cursor-not-allowed'}`}
                >
                  حفظ وتأكيد القيد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}