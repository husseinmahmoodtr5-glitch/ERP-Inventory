import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
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
  Search,
  Printer
} from 'lucide-react';

// الاتصال بـ Supabase نفس الطريقة المستخدمة في شجرة المخازن
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
  pdf_url?: string | null;
  pdf_name?: string | null;
}

export default function Accounting() {
  const [activeTab, setActiveTab] = useState<'ENTRIES' | 'ACCOUNTS'>('ENTRIES');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [exchangeRate, setExchangeRate] = useState<number>(152000);
  const [rateChange, setRateChange] = useState<'up' | 'down' | 'stable'>('stable');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newReference, setNewReference] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLines, setNewLines] = useState<JournalLine[]>([
    { account: '', name: '', debit: 0, credit: 0 },
    { account: '', name: '', debit: 0, credit: 0 }
  ]);
  const [selectedPdf, setSelectedPdf] = useState<File | null>(null);

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
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setEntries(data);
      }
    } catch (error) {
      console.error('خطأ في جلب القيود:', error);
    }
  };

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

  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) {
      alert('خطأ: الجانب المدين لا يساوي الجانب الدائن!');
      return;
    }

    setLoading(true);
    try {
      let pdfUrl = null;
      let pdfName = null;

      if (selectedPdf) {
        const fileExt = selectedPdf.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('invoices')
          .upload(filePath, selectedPdf);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('invoices')
          .getPublicUrl(filePath);

        pdfUrl = publicUrlData.publicUrl;
        pdfName = selectedPdf.name;
      }

      const entryId = `JV-${String(entries.length + 1).padStart(4, '0')}`;
      const newEntryData = {
        id: entryId,
        date: new Date().toLocaleDateString('ar-IQ'),
        reference: newReference || 'قيد يدوي',
        description: newDescription,
        lines: newLines.filter(l => l.account !== ''),
        pdf_url: pdfUrl,
        pdf_name: pdfName
      };

      const { error: insertError } = await supabase
        .from('journal_entries')
        .insert([newEntryData]);

      if (insertError) throw insertError;

      await fetchEntries();

      setNewReference('');
      setNewDescription('');
      setNewLines([{ account: '', name: '', debit: 0, credit: 0 }, { account: '', name: '', debit: 0, credit: 0 }]);
      setSelectedPdf(null);
      setIsModalOpen(false);
    } catch (error: any) {
      alert('حدث خطأ أثناء الحفظ: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintEntry = (entry: JournalEntry) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const totalDeb = entry.lines.reduce((sum, line) => sum + line.debit, 0);
      const totalCred = entry.lines.reduce((sum, line) => sum + line.credit, 0);

      printWindow.document.write(`
        <html dir="rtl">
          <head>
            <title>طباعة قيد - ${entry.reference}</title>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; }
              .header { display: flex; justify-content: space-between; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
              .title h1 { margin: 0; color: #1e293b; font-size: 24px; }
              .title p { margin: 5px 0 0; color: #64748b; font-size: 14px; }
              .details p { margin: 5px 0; font-size: 14px; font-weight: bold; }
              .desc-box { background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-size: 15px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
              th, td { border: 1px solid #cbd5e1; padding: 12px; text-align: right; font-size: 14px; }
              th { background-color: #f1f5f9; color: #334155; font-weight: bold; }
              .totals { display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; border-top: 2px solid #3b82f6; padding-top: 15px; }
              .text-green { color: #16a34a; }
              .text-red { color: #dc2626; }
              .footer { margin-top: 50px; text-align: center; color: #94a3b8; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">
                <h1>سند قيد يومية</h1>
                <p>رقم القيد المتسلسل: ${entry.id}</p>
              </div>
              <div class="details">
                <p>التاريخ: ${entry.date}</p>
                <p>رقم المرجع: ${entry.reference}</p>
              </div>
            </div>
            
            <div class="desc-box">
              <strong>بيان القيد:</strong> ${entry.description}
            </div>

            <table>
              <thead>
                <tr>
                  <th>رقم الحساب</th>
                  <th>اسم الحساب</th>
                  <th style="text-align: center;">مدين</th>
                  <th style="text-align: center;">دائن</th>
                </tr>
              </thead>
              <tbody>
                ${entry.lines.map(line => `
                  <tr>
                    <td>${line.account}</td>
                    <td>${line.name}</td>
                    <td style="text-align: center;" class="text-green">${line.debit > 0 ? line.debit.toLocaleString() : '-'}</td>
                    <td style="text-align: center;" class="text-red">${line.credit > 0 ? line.credit.toLocaleString() : '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="totals">
              <div>الإجمالي:</div>
              <div style="display: flex; gap: 40px;">
                <span class="text-green">مدين: ${totalDeb.toLocaleString()}</span>
                <span class="text-red">دائن: ${totalCred.toLocaleString()}</span>
              </div>
            </div>

            <div class="footer">
              تم إنشاء هذا المستند آلياً بواسطة النظام المحاسبي
            </div>
            <script>
              window.onload = () => { window.print(); }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const filteredEntries = entries.filter(entry => 
    entry.reference?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    entry.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div dir="rtl" className="p-4 md:p-6 bg-slate-50 min-h-screen font-sans relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Calculator className="text-blue-600" /> المحاسبة والتكاليف
          </h1>
          <p className="text-sm text-slate-500 mt-1">نظام القيود المزدوجة، السندات اليدوية، وأرشفة الفواتير المرتبطة بقاعدة البيانات.</p>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400">إجمالي القيود في الداتا بيس</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{entries.length} قيد مزدوج</div>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><FileText size={24} /></div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400">حالة التوازن المحاسبي</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1 flex items-center gap-1">
              <CheckCircle2 size={20} /> متوازن 100%
            </div>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp size={24} /></div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between relative overflow-hidden">
          <div className={`absolute top-0 right-0 w-1 h-full ${rateChange === 'up' ? 'bg-emerald-500' : rateChange === 'down' ? 'bg-rose-500' : 'bg-blue-600'}`}></div>
          <div>
            <div className="text-xs font-bold text-slate-400">سعر الصرف الحي</div>
            <div className="text-xl font-bold text-slate-800 mt-1 font-mono">
              100$ = {exchangeRate.toLocaleString()} د.ع
            </div>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl"><DollarSign size={24} /></div>
        </div>
      </div>

      {activeTab === 'ENTRIES' && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <Search className="text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="ابحث عن قيد بواسطة المرجع، الوصف، أو الرقم..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none focus:outline-none text-sm"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-rose-500">
                <X size={18} />
              </button>
            )}
          </div>

          {filteredEntries.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-slate-200">
              <p className="text-slate-500 font-bold">لم يتم العثور على أي قيود في قاعدة البيانات مطابقة لبحثك.</p>
            </div>
          ) : (
            filteredEntries.map((entry) => (
              <div key={entry.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-800 p-4 text-white flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center gap-3">
                    <span className="bg-blue-600 px-3 py-1 rounded-lg text-xs font-mono font-bold">{entry.id}</span>
                    <span className="font-bold text-sm">المرجع: {entry.reference}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-slate-300 font-mono">{entry.date}</span>
                    <button 
                      onClick={() => handlePrintEntry(entry)}
                      className="bg-slate-700 hover:bg-blue-600 transition p-2 rounded-lg flex items-center gap-1 text-xs font-bold"
                    >
                      <Printer size={14} /> طباعة
                    </button>
                  </div>
                </div>

                <div className="p-5">
                  <p className="text-sm font-bold text-slate-700 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center flex-wrap gap-2">
                    <span><span className="text-slate-400 ml-2">الوصف:</span> {entry.description}</span>
                    {entry.pdf_url && (
                      <a 
                        href={entry.pdf_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1 rounded-lg flex items-center gap-1 hover:underline font-sans"
                      >
                        <File size={14} /> عرض ملف PDF المرفق: {entry.pdf_name || 'ملف الفاتورة'}
                      </a>
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
                        {entry.lines?.map((line, idx) => (
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
            ))
          )}
        </div>
      )}

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
                      <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold">نشط</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
              <PlusCircle className="text-blue-600" size={20} /> إنشاء قيد / سند محاسبي جديد في Supabase
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

              <div className="border-2 border-dashed border-slate-300 p-4 rounded-xl text-center bg-slate-50">
                <UploadCloud className="mx-auto text-slate-400 mb-1" size={28} />
                <label className="cursor-pointer text-xs font-bold text-blue-600 hover:underline">
                  انقر هنا لرفع فاتورة PDF وحفظها في سحاب Supabase Storage
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
                  disabled={!isBalanced || loading}
                  className={`px-5 py-2 rounded-xl text-sm font-bold text-white transition ${isBalanced && !loading ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-400 cursor-not-allowed'}`}
                >
                  {loading ? 'جاري الحفظ والرفع...' : 'حفظ وتأكيد القيد في الداتا بيس'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}