import React, { useState, useRef } from 'react';
import { 
  Beaker, ClipboardList, UploadCloud, Printer, Edit2, Trash2, 
  ArrowRight, Search, FileText, FileSpreadsheet, File, X, CheckCircle2 
} from 'lucide-react';

export default function Quality() {
  // حالة التحكم بالتبويبات الرئيسية (المختبر vs الإدارة)
  const [activeTab, setActiveTab] = useState<'lab' | 'management'>('lab');
  
  // حالة القسم المفتوح حالياً (إذا كان فارغاً يعني نحن في القائمة الرئيسية)
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  // قوائم الأقسام التي اتفقنا عليها
  const labDepartments = [
    "فحوصات المواد الخام", "فحوصات المواد أثناء التصنيع", "فحوصات المنتج التام",
    "فحوصات أخرى", "معايرة الأجهزة", "المواصفات المختبرية",
    "إصدار الشهادات المختبرية", "الموظفون المختبريون", "محاضر فحص اللجان", "⚙️ مخصص (Custom)"
  ];

  const managementDepartments = [
    "بيانات البكرات (المراجعة / التالفة)", "بيانات البكرات المنتجة", "بيانات البكرات المسلمة إلى المخزن",
    "المواصفات العالمية (Standard Specs)", "فحوصات العقود المبرمة", "قائمة التعبئة (Packing List)",
    "الجرد اليومي", "⚙️ مخصص (Custom)"
  ];

  // 🚀 قاعدة البيانات المؤقتة للملفات المرفوعة
  const [files, setFiles] = useState<any[]>([]);
  
  // حالات البحث والتعديل
  const [searchQuery, setSearchQuery] = useState('');
  const [editingFile, setEditingFile] = useState<any>(null);
  const [newFileName, setNewFileName] = useState('');

  // مرجع (Ref) لزر رفع الملفات المخفي
  const fileInputRef = useRef<HTMLInputElement>(null);

  // دالة التقاط الملف المرفوع ومعالجته
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    const file = uploadedFiles[0];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    // تحديد نوع الملف بناءً على الامتداد
    let fileType = 'unknown';
    if (fileExtension === 'pdf') fileType = 'pdf';
    else if (['doc', 'docx'].includes(fileExtension || '')) fileType = 'word';
    else if (['xls', 'xlsx'].includes(fileExtension || '')) fileType = 'excel';

    // إضافة الملف للجدول
    const newFileRecord = {
      id: Date.now(),
      name: file.name,
      type: fileType,
      date: new Date().toLocaleDateString('ar-IQ'),
      uploader: 'مدير النظام', // سيتم سحبها تلقائياً لاحقاً
      department: selectedDept,
    };

    setFiles([newFileRecord, ...files]);
    // تصفير زر الرفع لاستقبال ملفات جديدة لاحقاً
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // دوال الحذف والتعديل
  const handleDeleteFile = (id: number) => {
    if(window.confirm('هل أنت متأكد من حذف هذا الملف نهائياً؟')) {
      setFiles(files.filter(f => f.id !== id));
    }
  };

  const openEditModal = (file: any) => {
    setEditingFile(file);
    setNewFileName(file.name);
  };

  const saveFileEdit = () => {
    setFiles(files.map(f => f.id === editingFile.id ? { ...f, name: newFileName } : f));
    setEditingFile(null);
  };

  // دالة وهمية للطباعة
  const handlePrint = (fileName: string) => {
    alert(`جاري تجهيز الملف للطباعة: \n"${fileName}"\n(سيتم تفعيل ربط الطابعة لاحقاً)`);
  };

  // فلترة الملفات حسب القسم المفتوح وحسب البحث
  const filteredFiles = files.filter(f => 
    f.department === selectedDept && 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // -------------------------------------------------------------------------
  // 1. واجهة اختيار الأقسام (الكروت)
  // -------------------------------------------------------------------------
  if (!selectedDept) {
    return (
      <div className="p-6 max-w-7xl mx-auto relative animate-in fade-in duration-500">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Beaker className="text-indigo-600" size={32} />
            الجودة والسيطرة النوعية
          </h1>
          <p className="text-slate-500 mt-2">المنصة المركزية لإدارة الفحوصات، المطابقات، والشهادات المختبرية</p>
        </div>

        {/* التبويبات الرئيسية (Tabs) */}
        <div className="flex bg-slate-100 p-1 rounded-2xl w-fit mb-8 shadow-inner">
          <button 
            onClick={() => setActiveTab('lab')}
            className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'lab' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <Beaker size={20} />
            المختبر الفني
          </button>
          <button 
            onClick={() => setActiveTab('management')}
            className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'management' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <ClipboardList size={20} />
            إدارة الجودة
          </button>
        </div>

        {/* شبكة الكروت (Cards Grid) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {(activeTab === 'lab' ? labDepartments : managementDepartments).map((dept, idx) => (
            <button 
              key={idx}
              onClick={() => setSelectedDept(dept)}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all text-right group flex flex-col justify-between min-h-[140px]"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  {activeTab === 'lab' ? <Beaker size={24} /> : <ClipboardList size={24} />}
                </div>
                <h3 className="font-bold text-slate-800 text-lg leading-tight">{dept}</h3>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // 2. واجهة "محرك المرفقات الذكي" (تفتح عند الضغط على أي كرت)
  // -------------------------------------------------------------------------
  return (
    <div className="p-6 max-w-7xl mx-auto relative animate-in slide-in-from-left-4 duration-300">
      
      {/* رأس الصفحة مع زر الرجوع */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <button 
            onClick={() => setSelectedDept(null)}
            className="text-slate-500 hover:text-indigo-600 flex items-center gap-2 mb-2 transition-colors font-medium">
            <ArrowRight size={18} />
            العودة للقائمة الرئيسية
          </button>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            {selectedDept}
          </h1>
        </div>
        
        {/* زر رفع الملفات */}
        <div className="flex gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
            accept=".pdf,.doc,.docx,.xls,.xlsx" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-200">
            <UploadCloud size={20} />
            إرفاق ملف (PDF, Word, Excel)
          </button>
        </div>
      </div>

      {/* شريط البحث */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 flex gap-4 items-center">
        <Search className="text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="ابحث في الملفات المرفوعة..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent border-none outline-none w-full text-slate-700"
        />
      </div>

      {/* جدول الملفات */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-right">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 text-slate-600 font-bold w-16">النوع</th>
              <th className="p-4 text-slate-600 font-bold">اسم الملف / الشهادة</th>
              <th className="p-4 text-slate-600 font-bold">تاريخ الرفع</th>
              <th className="p-4 text-slate-600 font-bold">بواسطة</th>
              <th className="p-4 text-slate-600 font-bold text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredFiles.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-slate-500 font-medium bg-slate-50/30">
                  لا توجد ملفات مرفوعة في هذا القسم بعد. اضغط على "إرفاق ملف" للبدء.
                </td>
              </tr>
            ) : (
              filteredFiles.map((file) => (
                <tr key={file.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="p-4">
                    {/* تحديد الأيقونة واللون بناءً على نوع الملف */}
                    {file.type === 'pdf' && <FileText className="text-rose-500" size={28} />}
                    {file.type === 'word' && <FileText className="text-blue-600" size={28} />}
                    {file.type === 'excel' && <FileSpreadsheet className="text-emerald-600" size={28} />}
                    {file.type === 'unknown' && <File className="text-slate-400" size={28} />}
                  </td>
                  <td className="p-4 font-bold text-slate-800">{file.name}</td>
                  <td className="p-4 text-slate-500">{file.date}</td>
                  <td className="p-4 text-slate-500">{file.uploader}</td>
                  <td className="p-4 flex justify-center gap-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handlePrint(file.name)} className="text-slate-400 hover:text-indigo-600 transition-colors p-2 bg-white rounded-lg shadow-sm border border-slate-100 hover:border-indigo-200" title="طباعة">
                      <Printer size={18} />
                    </button>
                    <button onClick={() => openEditModal(file)} className="text-slate-400 hover:text-amber-600 transition-colors p-2 bg-white rounded-lg shadow-sm border border-slate-100 hover:border-amber-200" title="تعديل الاسم">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDeleteFile(file.id)} className="text-slate-400 hover:text-rose-600 transition-colors p-2 bg-white rounded-lg shadow-sm border border-slate-100 hover:border-rose-200" title="حذف الملف">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* نافذة التعديل (Modal) */}
      {editingFile && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Edit2 className="text-indigo-600" size={20} />
                تعديل اسم الملف
              </h2>
              <button onClick={() => setEditingFile(null)} className="text-slate-400 hover:text-rose-500 transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">اسم الملف الجديد</label>
              <input 
                type="text" 
                value={newFileName} 
                onChange={(e) => setNewFileName(e.target.value)} 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-all text-left dir-ltr" 
              />
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setEditingFile(null)} className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors">
                إلغاء
              </button>
              <button onClick={saveFileEdit} className="px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center gap-2">
                <CheckCircle2 size={18} />
                حفظ التعديل
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}