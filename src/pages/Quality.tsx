import React, { useState, useRef, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Beaker, ClipboardList, UploadCloud, Printer, Edit2, Trash2, 
  ArrowRight, Search, FileText, FileSpreadsheet, File, X, CheckCircle2, Eye, Bell
} from 'lucide-react';

// ==========================================
// --- إعدادات الاتصال بقاعدة البيانات ---
// ==========================================
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

// ==========================================
// --- مكون القائمة المنسدلة الذكية (Searchable Select - محصن) ---
// ==========================================
const SearchableSelect = ({ options = [], value, onChange, placeholder }: { options: string[], value: string, onChange: (val: string) => void, placeholder: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const safeOptions = Array.isArray(options) ? options : [];
  const filteredOptions = safeOptions.filter(opt => (opt || '').toLowerCase().includes((searchTerm || '').toLowerCase()));

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div 
        className="flex items-center justify-between w-full border border-slate-300 rounded-xl p-3 text-sm bg-white cursor-pointer focus-within:ring-2 focus-within:ring-indigo-500"
        onClick={() => setIsOpen(!isOpen)}
      >
        <input
          type="text"
          className="w-full outline-none bg-transparent cursor-pointer text-slate-800 font-bold"
          placeholder={placeholder}
          value={isOpen ? searchTerm : value}
          onChange={(e) => { setSearchTerm(e.target.value); setIsOpen(true); }}
          onFocus={() => { setSearchTerm(''); setIsOpen(true); }}
          readOnly={!isOpen}
        />
      </div>
      {isOpen && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, idx) => (
              <li key={idx} className="px-4 py-3 text-sm text-slate-700 hover:bg-indigo-50 cursor-pointer border-b last:border-0"
                onClick={() => { onChange(opt); setIsOpen(false); setSearchTerm(''); }}>
                {opt}
              </li>
            ))
          ) : <li className="px-4 py-3 text-sm text-slate-400 text-center">لا توجد نتائج</li>}
        </ul>
      )}
    </div>
  );
};

export default function Quality() {
  const [activeTab, setActiveTab] = useState<'lab' | 'management'>('lab');
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  
  const [materialsList, setMaterialsList] = useState<string[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [uploadData, setUploadData] = useState({ material: '', contract: '', notes: '', file: null as File | null });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // إعدادات الإشعارات (الجرس 🔔)
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<any[]>([
    { id: 1, message: "إشعار من الإنتاج: اكتمل أمر التصنيع (101)، يرجى سحب عينة لفحص المنتج التام.", reference: "101", material_name: "3*120+70+16", type: 'production', isRead: false, date: "الآن" },
    { id: 2, message: "إشعار من المخازن: استلام شحنة مواد خام (نحاس 8 ملم)، يرجى إجراء فحص المطابقة.", reference: "IN-905", material_name: "نحاس 8 ملم", type: 'warehouse', isRead: false, date: "قبل ساعتين" }
  ]);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const labDepartments = ["فحوصات المواد الخام", "فحوصات المواد أثناء التصنيع", "فحوصات المنتج التام", "فحوصات أخرى", "معايرة الأجهزة", "المواصفات المختبرية", "إصدار الشهادات", "الموظفون", "محاضر الفحص", "⚙️ مخصص"];
  const managementDepartments = ["بيانات البكرات (مراجعة/تالفة)", "بيانات البكرات المنتجة", "بيانات البكرات المسلمة", "المواصفات العالمية", "فحوصات العقود", "قائمة التعبئة", "الجرد اليومي", "⚙️ مخصص"];

  useEffect(() => {
    const handleClickOutsideNotif = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setIsNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutsideNotif);
    return () => document.removeEventListener('mousedown', handleClickOutsideNotif);
  }, []);

  useEffect(() => {
    fetchMaterialsAndFiles();
  }, []);

  const fetchMaterialsAndFiles = async () => {
    setLoading(true);
    try {
      if (supabase) {
        const [matRes, filesRes] = await Promise.all([
          supabase.from('materials').select('material_name'),
          supabase.from('quality_records').select('*').order('created_at', { ascending: false }).limit(100) // Anti-Lag
        ]);

        if (matRes.data) {
          const uniqueMaterials = Array.from(new Set(matRes.data.map((m: any) => m?.material_name).filter(Boolean)));
          setMaterialsList(uniqueMaterials as string[]);
        }
        
        if (filesRes.data && filesRes.data.length > 0) {
          setFiles(filesRes.data);
        } else {
          loadLocalFiles();
        }
      } else {
        loadLocalFiles();
      }
    } catch (err: any) {
      console.warn("استخدام التخزين المحلي لغياب الاتصال بالسيرفر");
      loadLocalFiles();
    } finally {
      setLoading(false);
    }
  };

  const loadLocalFiles = () => {
    const local = localStorage.getItem('app_quality_files');
    if (local) setFiles(JSON.parse(local));
  };

  const saveFilesState = (updatedFiles: any[]) => {
    setFiles(updatedFiles);
    localStorage.setItem('app_quality_files', JSON.stringify(updatedFiles));
  };

  // 🚀 تفاعل الإشعار الذكي (يفتح القسم المناسب ويعبئ البيانات آلياً)
  const handleNotificationClick = (notif: any) => {
    setNotifications(notifications.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
    setIsNotifOpen(false);

    // توجيه ذكي للقسم
    const targetDept = notif.type === 'production' ? "فحوصات المنتج التام" : "فحوصات المواد الخام";
    setSelectedDept(targetDept);
    
    // فتح نافذة الإضافة معبأة مسبقاً
    setEditingId(null);
    setUploadData({ 
      material: notif.material_name, 
      contract: notif.reference, 
      notes: `تم فتح سجل الفحص بناءً على إشعار النظام الآلي...`, 
      file: null 
    });
    setShowUploadModal(true);
  };

  const handleSaveUpload = async () => {
    if (!uploadData.material) return alert('يرجى اختيار المادة.');
    
    const safeFiles = Array.isArray(files) ? files : [];
    let updatedFiles = [];

    // تنبيه: الروابط المحلية للملفات (createObjectURL) تعمل فقط في الجلسة الحالية
    // في بيئة الإنتاج الفعلية يتم رفع الملف إلى Supabase Storage وحفظ رابطه الحقيقي
    const fileUrl = uploadData.file ? URL.createObjectURL(uploadData.file) : '';
    const fileName = uploadData.file ? uploadData.file.name : '';

    if (editingId) {
      updatedFiles = safeFiles.map(f => f?.id === editingId ? { 
        ...f, 
        material: uploadData.material, 
        contract: uploadData.contract, 
        notes: uploadData.notes,
        fileUrl: uploadData.file ? fileUrl : f.fileUrl,
        name: uploadData.file ? fileName : f.name 
      } : f);
    } else {
      if (!uploadData.file) return alert('يرجى اختيار ملف المرفق.');
      const newFile = {
        id: Date.now(),
        material: uploadData.material,
        contract: uploadData.contract,
        name: fileName,
        notes: uploadData.notes,
        date: new Date().toISOString().split('T')[0],
        department: selectedDept,
        fileUrl: fileUrl
      };
      updatedFiles = [newFile, ...safeFiles];
    }

    try {
      // حفظ في Supabase إن أمكن، وإلا تخزين محلي
      if (supabase && !editingId) {
        await supabase.from('quality_records').insert([{
          material: uploadData.material,
          contract: uploadData.contract,
          name: fileName,
          notes: uploadData.notes,
          department: selectedDept,
          date: new Date().toISOString().split('T')[0],
          fileUrl: 'local-blob' // Placeholder لحين إعداد Storage
        }]);
      }
    } catch (e) {}

    saveFilesState(updatedFiles);
    setShowUploadModal(false);
    setUploadData({ material: '', contract: '', notes: '', file: null });
    setEditingId(null);
  };

  const handlePrint = (fileData: any) => {
    if (!fileData) return;
    if (fileData.fileUrl && fileData.fileUrl !== 'local-blob') {
      window.open(fileData.fileUrl, '_blank');
    } else {
      alert("عفواً، لا يوجد ملف مرفق فعلي لفتحه أو تم انتهاء صلاحية الرابط المحلي.");
    }
  };

  const openEdit = (file: any) => {
    if (!file) return;
    setEditingId(file.id);
    setUploadData({ material: file.material || '', contract: file.contract || '', notes: file.notes || '', file: null });
    setShowUploadModal(true);
  };

  const handleDelete = async (id: number) => {
    const safeFiles = Array.isArray(files) ? files : [];
    if (window.confirm('هل أنت متأكد من حذف هذا الفحص/الشهادة؟')) {
      const updatedFiles = safeFiles.filter(f => f?.id !== id);
      saveFilesState(updatedFiles);
      if (supabase) {
        try { await supabase.from('quality_records').delete().eq('id', id); } catch(e) {}
      }
    }
  };

  const safeFilesForFilter = Array.isArray(files) ? files : [];
  const filteredFiles = safeFilesForFilter.filter(f => {
    if (!f) return false;
    const inDept = f.department === selectedDept;
    const matchSearch = (f.material || '').includes(searchQuery) || (f.contract || '').includes(searchQuery);
    
    // 🚀 فلترة التاريخ تم إصلاحها وتفعيلها
    let inDateRange = true;
    if (dateStart || dateEnd) {
      const recordDate = new Date(f.date).getTime();
      const sDate = dateStart ? new Date(dateStart).getTime() : 0;
      const eDate = dateEnd ? new Date(dateEnd).getTime() : Infinity;
      if (recordDate < sDate || recordDate > eDate) {
        inDateRange = false;
      }
    }

    return inDept && matchSearch && inDateRange;
  });

  // ==========================================
  // واجهة الأقسام الرئيسية
  // ==========================================
  if (!selectedDept) {
    return (
      <div dir="rtl" className="p-6 max-w-7xl mx-auto font-sans animate-in fade-in">
        
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Beaker className="text-indigo-600" size={32} /> السيطرة النوعية
          </h1>

          {/* أيقونة الجرس 🔔 */}
          <div className="relative" ref={notifRef}>
            <button 
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="relative p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition shadow-sm cursor-pointer"
            >
              <Bell size={22} />
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-rose-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                  {unreadCount}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute top-14 left-0 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-100 p-3 flex justify-between items-center">
                  <span className="font-bold text-slate-800 text-sm">طلبات الفحص (مهام الجودة)</span>
                  <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">{unreadCount} جديد</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-sm font-bold">لا توجد إشعارات حالياً</div>
                  ) : (
                    notifications.map(notif => (
                      <div 
                        key={notif.id} 
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-3 border-b border-slate-50 cursor-pointer transition ${notif.isRead ? 'bg-white hover:bg-slate-50' : 'bg-indigo-50/50 hover:bg-indigo-50'}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-xs font-bold flex items-center gap-1 ${notif.isRead ? 'text-slate-500' : 'text-indigo-700'}`}>
                            {notif.type === 'production' ? 'طلب فحص إنتاج تام' : 'طلب فحص مواد خام'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{notif.date}</span>
                        </div>
                        <p className={`text-sm mt-1 ${notif.isRead ? 'text-slate-600' : 'text-slate-800 font-medium'}`}>{notif.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl w-fit mb-8 shadow-inner overflow-x-auto">
          <button onClick={() => setActiveTab('lab')} className={`px-8 py-3 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${activeTab === 'lab' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>مختبر الفحص</button>
          <button onClick={() => setActiveTab('management')} className={`px-8 py-3 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${activeTab === 'management' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>إدارة الجودة</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {(activeTab === 'lab' ? labDepartments : managementDepartments).map((dept, idx) => (
            <button key={idx} onClick={() => setSelectedDept(dept)} className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all text-right group cursor-pointer">
              <h3 className="font-bold text-slate-800 group-hover:text-indigo-700">{dept}</h3>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ==========================================
  // واجهة داخل القسم (الفحوصات)
  // ==========================================
  return (
    <div dir="rtl" className="p-6 max-w-7xl mx-auto font-sans animate-in slide-in-from-left-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => setSelectedDept(null)} className="flex items-center justify-center p-2 bg-white rounded-xl shadow-sm border hover:bg-slate-50 text-slate-500 transition-colors cursor-pointer" title="رجوع">
            <ArrowRight size={20} />
          </button>
          <h1 className="text-2xl font-black text-slate-900">{selectedDept}</h1>
        </div>
        <button onClick={() => { setEditingId(null); setUploadData({ material: '', contract: '', notes: '', file: null }); setShowUploadModal(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-all w-full md:w-auto cursor-pointer">
          <UploadCloud size={20} /> إضافة فحص جديد
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border mb-6 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex items-center gap-2 w-full flex-1">
          <Search className="text-slate-400" size={20} />
          <input placeholder="البحث باسم المادة أو العقد..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full outline-none font-medium text-slate-700" />
        </div>
        <div className="flex gap-2 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 items-center">
          <span className="text-xs font-bold text-slate-400">تصفية التاريخ:</span>
          <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="border rounded-lg p-2 text-sm outline-none focus:border-indigo-500 w-full" />
          <span className="text-slate-400">-</span>
          <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="border rounded-lg p-2 text-sm outline-none focus:border-indigo-500 w-full" />
        </div>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full whitespace-nowrap text-right">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 text-slate-600 font-bold">المادة</th>
              <th className="p-4 text-slate-600 font-bold">رقم العقد / الطلبية</th>
              <th className="p-4 text-slate-600 font-bold">التاريخ</th>
              <th className="p-4 text-slate-600 font-bold">ملاحظات ونتائج الفحص</th>
              <th className="p-4 text-slate-600 font-bold text-center">عرض / تعديل</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredFiles.length === 0 ? (
              <tr><td colSpan={5} className="p-10 text-center text-slate-400 font-medium">لا توجد سجلات مضافة أو مطابقة للبحث في هذا القسم.</td></tr>
            ) : (
              filteredFiles.map(f => f && (
                <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-bold text-slate-800">{f.material}</td>
                  <td className="p-4 font-mono text-slate-600">{f.contract || '-'}</td>
                  <td className="p-4 font-mono text-slate-500">{f.date}</td>
                  <td className="p-4 text-sm text-slate-600 max-w-xs truncate">{f.notes || '-'}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => handlePrint(f)} className="p-2 text-slate-400 hover:text-indigo-600 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-indigo-300 transition-colors cursor-pointer" title="عرض وطباعة المرفق">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => openEdit(f)} className="p-2 text-slate-400 hover:text-amber-600 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-amber-300 transition-colors cursor-pointer" title="تعديل البيانات">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(f.id)} className="p-2 text-slate-400 hover:text-rose-600 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-rose-300 transition-colors cursor-pointer" title="حذف القيد">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-lg space-y-5 shadow-2xl border-t-8 border-indigo-500">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <h2 className="font-black text-xl flex items-center gap-2 text-slate-800">
                {editingId ? <Edit2 className="text-amber-500" size={24}/> : <UploadCloud className="text-indigo-600" size={24}/>}
                {editingId ? 'تعديل السجل' : 'إضافة نتيجة فحص / شهادة'}
              </h2>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-rose-500 bg-slate-100 p-1.5 rounded-lg cursor-pointer"><X size={20}/></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">اسم المادة *</label>
                <SearchableSelect 
                  options={materialsList.length > 0 ? materialsList : ["جاري جلب المواد من المخزن..."]} 
                  value={uploadData.material} 
                  onChange={(v) => setUploadData({...uploadData, material: v})} 
                  placeholder="اختر المادة..." 
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">رقم العقد / الطلبية (المرجع)</label>
                <input type="text" placeholder="مثال: 2026-HQ-55 أو 101" value={uploadData.contract} className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono" onChange={(e) => setUploadData({...uploadData, contract: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">ملاحظات وتفاصيل الفحص</label>
                <textarea placeholder="اكتب حالة المطابقة، أرقام الباتشات، نتائج الاختبار، الخ..." value={uploadData.notes} className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:border-indigo-500 resize-none h-24" onChange={(e) => setUploadData({...uploadData, notes: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">الملف المرفق {editingId && '(اختياري)'} *</label>
                <input type="file" ref={fileInputRef} onChange={(e) => e.target.files && setUploadData({...uploadData, file: e.target.files[0]})} className="w-full border border-slate-300 p-2 rounded-xl text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer" />
                {editingId && !uploadData.file && <p className="text-xs text-amber-600 mt-1">اترك هذا الحقل فارغاً إذا كنت لا تريد تغيير الملف المرفق مسبقاً.</p>}
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 mt-4">
              <button onClick={() => setShowUploadModal(false)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer">إلغاء</button>
              <button onClick={handleSaveUpload} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 flex items-center gap-2 transition-colors cursor-pointer">
                <CheckCircle2 size={18}/> {editingId ? 'حفظ التعديلات' : 'توثيق واعتماد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}