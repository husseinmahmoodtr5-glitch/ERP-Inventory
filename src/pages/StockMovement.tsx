import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Scale, 
  ListCheck, 
  Printer, 
  FileSpreadsheet, 
  Search, 
  Edit, 
  Trash2, 
  X 
} from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Movement {
  id: string;
  date: string;
  type: 'IN' | 'OUT';
  item_name: string;
  quantity: number;
  unit: string;
  doc_number?: string;
  qc_status?: string;
  notes?: string;
}

export default function InventoryMovements() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  
  const [showModal, setShowModal] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editId, setEditId] = useState<string>('');

  const [formData, setFormData] = useState<Omit<Movement, 'id'>>({
    date: new Date().toISOString().split('T')[0],
    type: 'IN',
    item_name: '',
    quantity: 0,
    unit: 'كجم',
    doc_number: '',
    qc_status: 'مقبول (مطابق)',
    notes: ''
  });

  useEffect(() => {
    fetchMovements();
  }, []);

  const fetchMovements = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory_movements')
        .select('*')
        .order('date', { ascending: false });

      if (!error && data) {
        setMovements(data as Movement[]);
      } else {
        const local = localStorage.getItem('app_inventory_movements');
        if (local) setMovements(JSON.parse(local));
      }
    } catch {
      const local = localStorage.getItem('app_inventory_movements');
      if (local) setMovements(JSON.parse(local));
    }
    setLoading(false);
  };

  const saveToLocalAndDB = (updatedList: Movement[]) => {
    setMovements(updatedList);
    localStorage.setItem('app_inventory_movements', JSON.stringify(updatedList));
  };

  const openNewModal = (type: 'IN' | 'OUT') => {
    setIsEditing(false);
    setEditId('');
    setFormData({
      date: new Date().toISOString().split('T')[0],
      type: type,
      item_name: '',
      quantity: 0,
      unit: 'كجم',
      doc_number: '',
      qc_status: 'مقبول (مطابق)',
      notes: ''
    });
    setShowModal(true);
  };

  const openEditModal = (item: Movement) => {
    setIsEditing(true);
    setEditId(item.id);
    setFormData({
      date: item.date,
      type: item.type,
      item_name: item.item_name,
      quantity: item.quantity,
      unit: item.unit,
      doc_number: item.doc_number || '',
      qc_status: item.qc_status || 'مقبول (مطابق)',
      notes: item.notes || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditing) {
      await supabase
        .from('inventory_movements')
        .update(formData)
        .eq('id', editId);

      const updated = movements.map(m => m.id === editId ? { ...formData, id: editId } : m);
      saveToLocalAndDB(updated);
    } else {
      const newId = Date.now().toString();
      const newRecord: Movement = { id: newId, ...formData };
      
      await supabase.from('inventory_movements').insert([newRecord]);
      saveToLocalAndDB([newRecord, ...movements]);
    }

    setShowModal(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`هل أنت متأكد من حذف حركة المادة "${name}"؟`)) {
      await supabase.from('inventory_movements').delete().eq('id', id);
      const updated = movements.filter(m => m.id !== id);
      saveToLocalAndDB(updated);
    }
  };

  const totalIn = movements.filter(m => m.type === 'IN').reduce((acc, curr) => acc + Number(curr.quantity), 0);
  const totalOut = movements.filter(m => m.type === 'OUT').reduce((acc, curr) => acc + Number(curr.quantity), 0);
  const netBalance = totalIn - totalOut;

  const filteredMovements = movements.filter(m => {
    const matchesFilter = filterType === 'ALL' || m.type === filterType;
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      (m.item_name && m.item_name.toLowerCase().includes(query)) ||
      (m.doc_number && m.doc_number.toLowerCase().includes(query)) ||
      (m.notes && m.notes.toLowerCase().includes(query));
    return matchesFilter && matchesSearch;
  });

  const exportToCSV = () => {
    if (movements.length === 0) {
      alert('لا توجد بيانات لتصديرها');
      return;
    }
    let csv = '\uFEFFالتاريخ,نوع الحركة,اسم المادة,الكمية,الوحدة,رقم المستند,فحص الجودة,الملاحظات\n';
    movements.forEach(m => {
      csv += `${m.date},${m.type === 'IN' ? 'وارد' : 'صادر'},"${m.item_name}",${m.quantity},${m.unit},"${m.doc_number || ''}","${m.qc_status || ''}","${m.notes || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `حركة_المخزن_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div dir="rtl" className="p-6 bg-slate-50 min-h-screen font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">حركة المخزون</h1>
          <p className="text-sm text-slate-500 mt-1">تسجيل الوارد والصادر ومتابعة الأرصدة وفحوصات الجودة.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => openNewModal('IN')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm transition"
          >
            <ArrowDownLeft size={18} /> وارد جديد
          </button>
          <button 
            onClick={() => openNewModal('OUT')}
            className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm transition"
          >
            <ArrowUpRight size={18} /> صادر جديد
          </button>
          <button 
            onClick={exportToCSV}
            className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-3 py-2 rounded-lg font-medium flex items-center gap-2 transition"
          >
            <FileSpreadsheet size={18} className="text-emerald-600" /> CSV
          </button>
          <button 
            onClick={() => window.print()}
            className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-3 py-2 rounded-lg font-medium flex items-center gap-2 transition"
          >
            <Printer size={18} className="text-blue-600" /> طباعة
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
          <div>
            <p className="text-xs text-slate-500 font-semibold mb-1">إجمالي الوارد</p>
            <p className="text-xl font-bold text-emerald-600">{totalIn.toLocaleString()} <span className="text-xs font-normal">وحدة</span></p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600"><ArrowDownLeft size={22} /></div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
          <div>
            <p className="text-xs text-slate-500 font-semibold mb-1">إجمالي الصادر</p>
            <p className="text-xl font-bold text-rose-600">{totalOut.toLocaleString()} <span className="text-xs font-normal">وحدة</span></p>
          </div>
          <div className="p-3 bg-rose-50 rounded-lg text-rose-600"><ArrowUpRight size={22} /></div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
          <div>
            <p className="text-xs text-slate-500 font-semibold mb-1">صافي حركة الرصيد</p>
            <p className="text-xl font-bold text-blue-600">{netBalance.toLocaleString()} <span className="text-xs font-normal">وحدة</span></p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg text-blue-600"><Scale size={22} /></div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
          <div>
            <p className="text-xs text-slate-500 font-semibold mb-1">إجمالي الحركات</p>
            <p className="text-xl font-bold text-purple-600">{movements.length} <span className="text-xs font-normal">عملية</span></p>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg text-purple-600"><ListCheck size={22} /></div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row justify-between gap-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute right-3 top-3 text-slate-400" />
          <input 
            type="text"
            placeholder="ابحث باسم المادة، رقم المستند، أو الملاحظات..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setFilterType('ALL')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition ${filterType === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            الكل
          </button>
          <button 
            onClick={() => setFilterType('IN')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition ${filterType === 'IN' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            الوارد فقط
          </button>
          <button 
            onClick={() => setFilterType('OUT')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition ${filterType === 'OUT' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            الصادر فقط
          </button>
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="p-3">التاريخ</th>
                <th className="p-3">نوع الحركة</th>
                <th className="p-3">اسم المادة</th>
                <th className="p-3 text-center">الكمية</th>
                <th className="p-3">رقم المستند / الإذن</th>
                <th className="p-3">فحص الجودة (QC)</th>
                <th className="p-3">الملاحظات</th>
                <th className="p-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-400">جاري تحميل الحركات المخزنية...</td></tr>
              ) : filteredMovements.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-400">لا توجد حركات مخزنية مطابقة للبحث</td></tr>
              ) : (
                filteredMovements.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3 text-slate-600 font-mono text-xs">{m.date}</td>
                    <td className="p-3">
                      {m.type === 'IN' ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded font-semibold">
                          <ArrowDownLeft size={14} /> وارد
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-xs px-2 py-0.5 rounded font-semibold">
                          <ArrowUpRight size={14} /> صادر
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-bold text-slate-800">{m.item_name}</td>
                    <td className="p-3 text-center font-bold text-slate-900">
                      {Number(m.quantity).toLocaleString()} <span className="text-xs text-slate-500 font-normal">{m.unit}</span>
                    </td>
                    <td className="p-3 text-slate-600 font-mono text-xs">{m.doc_number || '-'}</td>
                    <td className="p-3">
                      <span className="text-xs px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {m.qc_status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 text-xs max-w-xs truncate">{m.notes || '-'}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={() => openEditModal(m)} 
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                          title="تعديل"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(m.id, m.item_name)} 
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded transition"
                          title="حذف"
                        >
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
      </div>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-800">
                {isEditing ? 'تعديل حركة مخزنية' : formData.type === 'IN' ? 'تسجيل حركة وارد جديد' : 'تسجيل حركة صادر جديد'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">نوع الحركة *</label>
                  <select 
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as 'IN' | 'OUT' })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white"
                  >
                    <option value="IN">وارد (إدخال للمخزن)</option>
                    <option value="OUT">صادر (صرف للإنتاج)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">التاريخ *</label>
                  <input 
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">اسم المادة / المنتج *</label>
                <input 
                  type="text"
                  required
                  placeholder="مثال: سلك نحاس 8 ملم / سبيكة ألومنيوم"
                  value={formData.item_name}
                  onChange={e => setFormData({ ...formData, item_name: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">الكمية *</label>
                  <input 
                    type="number"
                    step="0.001"
                    required
                    placeholder="0"
                    value={formData.quantity}
                    onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">وحدة القياس *</label>
                  <input 
                    type="text"
                    required
                    placeholder="كجم، متر، طن..."
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">رقم المستند / الإذن</label>
                  <input 
                    type="text"
                    placeholder="مثال: REC-102"
                    value={formData.doc_number}
                    onChange={e => setFormData({ ...formData, doc_number: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">حالة الفحص (QC)</label>
                  <select 
                    value={formData.qc_status}
                    onChange={e => setFormData({ ...formData, qc_status: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white"
                  >
                    <option value="مقبول (مطابق)">مقبول (مطابق)</option>
                    <option value="قيد الفحص">قيد الفحص</option>
                    <option value="مرفوض">مرفوض</option>
                    <option value="غير مطلوب">غير مطلوب</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ملاحظات</label>
                <textarea 
                  rows={2}
                  placeholder="أي تفاصيل إضافية..."
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
                >
                  {isEditing ? 'حفظ التعديلات' : 'تسجيل الحركة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}