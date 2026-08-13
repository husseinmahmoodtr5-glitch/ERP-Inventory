import React, { useState } from 'react';
import { UserPlus, Shield, Edit2, Lock, Trash2, X, CheckCircle2 } from 'lucide-react';

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // 🚀 حالة جديدة لمعرفة هل نحن في وضع "الإضافة" أم وضع "التعديل"
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [selectedScope, setSelectedScope] = useState('');
  const [customScope, setCustomScope] = useState('');

  // قوائم الرتب والنطاقات لمعرفة إذا كان الخيار "مخصص" أو لا
  const predefinedRoles = ["مدير النظام", "مساعد مدير", "مدير إنتاج", "مهندس جودة", "مدير مبيعات", "موظف مبيعات", "أمين مخزن", "محاسب", "موظف IT", "قسم التخطيط"];
  const predefinedScopes = ["كل الأقسام والمخازن", "إدارة المخازن (عام)", "مخزن المواد الخام فقط", "مخزن المنتج التام فقط", "خطوط الإنتاج", "الجودة والسيطرة النوعية", "المبيعات والتسويق", "الحسابات والمالية", "التخطيط والمتابعة"];

  // 🚀 دالة تصفير الحقول وإغلاق النافذة
  const resetForm = () => {
    setIsModalOpen(false);
    setEditingUserId(null);
    setName('');
    setEmail('');
    setSelectedRole('');
    setCustomRole('');
    setSelectedScope('');
    setCustomScope('');
  };

  // 🚀 دالة فتح نافذة التعديل (زر القلم)
  const handleEditClick = (user: any) => {
    setEditingUserId(user.id);
    setName(user.name);
    setEmail(user.email);
    
    // التحقق من الرتبة (هل هي جاهزة أم مخصصة؟)
    if (predefinedRoles.includes(user.role)) {
      setSelectedRole(user.role);
      setCustomRole('');
    } else {
      setSelectedRole('مخصص');
      setCustomRole(user.role);
    }

    // التحقق من النطاق (هل هو جاهز أم مخصص؟)
    if (predefinedScopes.includes(user.scope)) {
      setSelectedScope(user.scope);
      setCustomScope('');
    } else {
      setSelectedScope('مخصص');
      setCustomScope(user.scope);
    }
    
    setIsModalOpen(true);
  };

  // دالة الحفظ (تعمل للإضافة والتعديل معاً)
  const handleSaveUser = () => {
    const finalRole = selectedRole === 'مخصص' ? customRole : selectedRole;
    const finalScope = selectedScope === 'مخصص' ? customScope : selectedScope;

    if (editingUserId !== null) {
      // 📝 وضع التعديل: تحديث بيانات الموظف الحالي
      setUsers(users.map(user => 
        user.id === editingUserId 
          ? { ...user, name, email, role: finalRole, scope: finalScope }
          : user
      ));
    } else {
      // ➕ وضع الإضافة: إنشاء موظف جديد
      const newUser = {
        id: Date.now(),
        name: name || 'مستخدم جديد',
        email: email || 'new@quantum.com',
        role: finalRole || 'غير محدد',
        scope: finalScope || 'غير محدد',
        status: 'نشط',
        isOnline: true 
      };
      setUsers([...users, newUser]);
    }
    resetForm();
  };

  const handleDeleteUser = (id: number) => {
    setUsers(users.filter(user => user.id !== id));
  };

  const handleToggleStatus = (id: number) => {
    setUsers(users.map(user => {
      if (user.id === id) {
        return { ...user, status: user.status === 'نشط' ? 'غير نشط' : 'نشط' };
      }
      return user;
    }));
  };

  const handleToggleOnline = (id: number) => {
    setUsers(users.map(user => {
      if (user.id === id) {
        return { ...user, isOnline: !user.isOnline };
      }
      return user;
    }));
  };

  // دالة فتح نافذة الإضافة الجديدة
  const handleOpenAddModal = () => {
    resetForm(); // تصفير الحقول قبل الفتح لضمان عدم وجود بيانات قديمة
    setIsModalOpen(true);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto relative">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Shield className="text-indigo-600" size={32} />
            إدارة المستخدمين والصلاحيات
          </h1>
          <p className="text-slate-500 mt-2">التحكم المركزي في حسابات الموظفين وصلاحيات الوصول للنظام</p>
        </div>
        <button 
          onClick={handleOpenAddModal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-200">
          <UserPlus size={20} />
          إضافة مستخدم جديد
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-right">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 text-slate-600 font-bold">الاسم (حالة الاتصال)</th>
              <th className="p-4 text-slate-600 font-bold">البريد الإلكتروني</th>
              <th className="p-4 text-slate-600 font-bold">الرتبة</th>
              <th className="p-4 text-slate-600 font-bold">القسم الأساسي (نطاق الوصول)</th>
              <th className="p-4 text-slate-600 font-bold text-center">حالة الحساب</th>
              <th className="p-4 text-slate-600 font-bold text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500 font-medium bg-slate-50/50">
                  لا توجد حسابات حالياً. ابدأ بإضافة موظف جديد للنظام.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-bold text-slate-900 flex items-center gap-3">
                    <button 
                      onClick={() => handleToggleOnline(user.id)}
                      title={user.isOnline ? "متصل الآن - اضغط لتغيير الحالة للتجربة" : "غير متصل - اضغط لتغيير الحالة للتجربة"}
                      className={`relative w-3 h-3 rounded-full transition-all duration-300 ${
                        user.isOnline 
                        ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' 
                        : 'bg-slate-300'
                      }`}
                    >
                      {user.isOnline && (
                        <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-25"></span>
                      )}
                    </button>
                    {user.name}
                  </td>
                  <td className="p-4 text-slate-500">{user.email}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                      user.role === 'مدير النظام' ? 'bg-purple-100 text-purple-700' : 
                      user.role === 'مهندس جودة' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="p-4 text-slate-500 font-medium">{user.scope}</td>
                  
                  <td className="p-4 text-center">
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold transition-colors ${
                      user.status === 'نشط' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  
                  <td className="p-4 flex justify-center gap-4">
                    {/* 🚀 زر التعديل المربوط بالدالة */}
                    <button onClick={() => handleEditClick(user)} className="text-slate-400 hover:text-indigo-600 transition-colors" title="تعديل البيانات">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleToggleStatus(user.id)} className="text-slate-400 hover:text-amber-500 transition-colors" title={user.status === 'نشط' ? 'تجميد الحساب (إيقاف)' : 'تفعيل الحساب (فك الإيقاف)'}>
                      <Lock size={18} />
                    </button>
                    <button onClick={() => handleDeleteUser(user.id)} className="text-slate-400 hover:text-rose-600 transition-colors" title="حذف نهائي">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                {/* 🚀 تغيير العنوان حسب الحالة (إضافة أو تعديل) */}
                <UserPlus className="text-indigo-600" size={24} />
                {editingUserId ? 'تعديل بيانات الموظف' : 'إضافة مستخدم جديد'}
              </h2>
              <button onClick={resetForm} className="text-slate-400 hover:text-rose-500 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-8">
              
              <div className="space-y-5">
                <h3 className="font-bold text-slate-800 border-b pb-2 mb-4">المعلومات الشخصية والوظيفية</h3>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">اسم الموظف</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-all" placeholder="الاسم الكامل" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">البريد الإلكتروني (تسجيل الدخول)</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-all" placeholder="employee@quantum.com" />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">رتبة الموظف (Role)</label>
                  <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-all text-slate-700">
                    <option value="">اختر رتبة الموظف...</option>
                    <option value="مدير النظام">مدير النظام</option>
                    <option value="مساعد مدير">مساعد مدير</option>
                    <option value="مدير إنتاج">مدير إنتاج</option>
                    <option value="مهندس جودة">مهندس جودة</option>
                    <option value="مدير مبيعات">مدير مبيعات</option>
                    <option value="موظف مبيعات">موظف مبيعات</option>
                    <option value="أمين مخزن">أمين مخزن</option>
                    <option value="محاسب">محاسب</option>
                    <option value="موظف IT">موظف IT (دعم فني)</option>
                    <option value="قسم التخطيط">موظف قسم التخطيط</option>
                    <option value="مخصص">⚙️ مخصص (Custom)</option>
                  </select>
                </div>

                {selectedRole === 'مخصص' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-sm font-bold text-indigo-700 mb-2">المسمى الوظيفي المخصص</label>
                    <input type="text" value={customRole} onChange={(e) => setCustomRole(e.target.value)} className="w-full bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-all" placeholder="اكتب المسمى الوظيفي هنا..." />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">القسم الأساسي (نطاق الوصول)</label>
                  <select value={selectedScope} onChange={(e) => setSelectedScope(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-all text-slate-700">
                    <option value="">اختر القسم...</option>
                    <option value="كل الأقسام والمخازن">كل الأقسام والمخازن</option>
                    <option value="إدارة المخازن (عام)">إدارة المخازن (عام)</option>
                    <option value="مخزن المواد الخام فقط">مخزن المواد الخام فقط</option>
                    <option value="مخزن المنتج التام فقط">مخزن المنتج التام فقط</option>
                    <option value="خطوط الإنتاج">خطوط الإنتاج</option>
                    <option value="الجودة والسيطرة النوعية">الجودة والسيطرة النوعية</option>
                    <option value="المبيعات والتسويق">المبيعات والتسويق</option>
                    <option value="الحسابات والمالية">الحسابات والمالية</option>
                    <option value="التخطيط والمتابعة">التخطيط والمتابعة</option>
                    <option value="مخصص">⚙️ مخصص (Custom)</option>
                  </select>
                </div>

                {selectedScope === 'مخصص' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-sm font-bold text-indigo-700 mb-2">النطاق أو القسم المخصص</label>
                    <input type="text" value={customScope} onChange={(e) => setCustomScope(e.target.value)} className="w-full bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 transition-all" placeholder="اكتب اسم القسم أو المخزن هنا..." />
                  </div>
                )}
              </div>

              <div className="space-y-5">
                <h3 className="font-bold text-slate-800 border-b pb-2 mb-4">مصفوفة الصلاحيات الدقيقة</h3>
                
                <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100">
                  <p className="text-sm font-bold text-indigo-800 mb-1">صلاحية (الإضافة والتعديل) ✍️</p>
                  <p className="text-xs text-slate-500 mb-4">ضع علامة (صح) بجانب الأقسام التي يحق للموظف التعديل عليها. الأقسام غير المحددة ستكون للمشاهدة فقط تلقائياً.</p>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      'إدارة المخازن وحركة المواد',
                      'أوامر الإنتاج وخطوط التشغيل',
                      'مختبر الجودة وإدخال الفحوصات',
                      'قسم المبيعات والفواتير',
                      'القسم المالي والحسابات',
                      'لوحة التحكم والتقارير الشاملة'
                    ].map((dept, index) => (
                      <label key={index} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200">
                        <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        <span className="text-slate-700 font-medium text-sm">{dept}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 mt-auto">
              <button onClick={resetForm} className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors">
                إلغاء
              </button>
              <button onClick={handleSaveUser} className="px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center gap-2">
                <CheckCircle2 size={18} />
                {/* 🚀 تغيير نص الزر في حالة التعديل */}
                {editingUserId ? 'حفظ التعديلات' : 'حفظ وإصدار الحساب'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}