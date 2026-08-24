import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  ShoppingCart, Truck, FileCheck, TrendingUp, AlertCircle, 
  Plus, Search, CheckCircle2, X, FileSpreadsheet, PackageOpen,
  Edit2, Trash2, Bell, Clock, Ban
} from 'lucide-react';

// ==========================================
// --- إعدادات الاتصال بقاعدة البيانات ---
// ==========================================
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

export default function Sales() {
  const [activeTab, setActiveTab] = useState<'orders' | 'dispatches'>('orders');
  const [orders, setOrders] = useState<any[]>([]);
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // حالات النوافذ المنبثقة (Modals) ووضع التعديل
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | number | null>(null);
  const [editingDispatchId, setEditingDispatchId] = useState<string | number | null>(null);
  
  // بيانات الإدخال
  const [newOrder, setNewOrder] = useState({ date: new Date().toISOString().split('T')[0], orderNo: '', customer: '', cableType: '', reqQty: '', price: '', deliveryDate: '' });
  const [newDispatch, setNewDispatch] = useState({ date: new Date().toISOString().split('T')[0], orderNo: '', qty: '', shipment: '', receipt: '', driver: '', notes: '' });

  // إعدادات الإشعارات (الجرس 🔔)
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<any[]>([
    { id: 1, message: "تمت الموافقة من قبل المخازن على صرف الطلبية رقم 101. (بانتظار تسوية المحاسبة)", type: 'success', isRead: false, date: "الآن" },
    { id: 2, message: "عفواً، قام أمين المخزن برفض طلب التجهيز للطلبية 24/2026 لعدم توفر الرصيد.", type: 'rejected', isRead: false, date: "قبل ساعة" }
  ]);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    const handleClickOutsideNotif = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setIsNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutsideNotif);
    return () => document.removeEventListener('mousedown', handleClickOutsideNotif);
  }, []);

  const handleReadNotification = (id: number) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
    setIsNotifOpen(false);
  };

  // ==========================================
  // --- جلب البيانات السحابية (مع دعم محلي) ---
  // ==========================================
  useEffect(() => {
    fetchSalesData();
  }, []);

  const fetchSalesData = async () => {
    setLoading(true);
    try {
      if (supabase) {
        const [ordersRes, dispatchesRes] = await Promise.all([
          supabase.from('sales_orders').select('*'),
          supabase.from('sales_dispatches').select('*')
        ]);

        if (!ordersRes.error && ordersRes.data) {
          setOrders(ordersRes.data);
        } else {
          const localOrders = localStorage.getItem('app_sales_orders');
          if (localOrders) setOrders(JSON.parse(localOrders));
        }

        if (!dispatchesRes.error && dispatchesRes.data) {
          setDispatches(dispatchesRes.data);
        } else {
          const localDisp = localStorage.getItem('app_sales_dispatches');
          if (localDisp) setDispatches(JSON.parse(localDisp));
        }
      } else {
        setOrders(JSON.parse(localStorage.getItem('app_sales_orders') || '[]'));
        setDispatches(JSON.parse(localStorage.getItem('app_sales_dispatches') || '[]'));
      }
    } catch (error) {
      console.warn("استخدام التخزين المحلي كبديل بسبب خطأ في الاتصال");
      setOrders(JSON.parse(localStorage.getItem('app_sales_orders') || '[]'));
      setDispatches(JSON.parse(localStorage.getItem('app_sales_dispatches') || '[]'));
    } finally {
      setLoading(false);
    }
  };

  const saveOrdersToStorageAndDb = async (updatedOrders: any[]) => {
    setOrders(updatedOrders);
    localStorage.setItem('app_sales_orders', JSON.stringify(updatedOrders));
    // ملاحظة: يتم هنا التخزين المحلي فوراً، ويمكن مستقبلاً إضافة دالة Insert لـ Supabase إذا تم بناء الجداول الخاصة بها.
  };

  const saveDispatchesToStorageAndDb = async (updatedDispatches: any[]) => {
    setDispatches(updatedDispatches);
    localStorage.setItem('app_sales_dispatches', JSON.stringify(updatedDispatches));
  };

  // ==========================================
  // --- العقل والمنطق والحسابات المحصنة ---
  // ==========================================
  const processedOrders = useMemo(() => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    const safeDispatches = Array.isArray(dispatches) ? dispatches : [];

    return safeOrders.map(order => {
      if (!order) return null;

      // حساب المجهز يتجاهل الطلبات المرفوضة
      const dispatchedQty = safeDispatches
        .filter(d => d?.orderNo === order.orderNo && d?.status !== 'REJECTED') 
        .reduce((sum, d) => sum + (Number(d?.qty) || 0), 0);
      
      const reqQty = Number(order.reqQty) || 0;
      const price = Number(order.price) || 0;

      const remainingQty = reqQty - dispatchedQty;
      const totalPrice = reqQty * price;
      const dispatchedPrice = dispatchedQty * price;
      const remainingPrice = remainingQty * price;
      const progress = reqQty > 0 ? Math.min(100, Math.round((dispatchedQty / reqQty) * 100)) : 0;

      return { ...order, dispatchedQty, remainingQty, totalPrice, dispatchedPrice, remainingPrice, progress };
    }).filter(o => o && ((o.orderNo || '').includes(searchQuery) || (o.customer || '').includes(searchQuery)));
  }, [orders, dispatches, searchQuery]);

  const processedDispatches = useMemo(() => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    const safeDispatches = Array.isArray(dispatches) ? dispatches : [];

    return safeDispatches.map(dispatch => {
      if (!dispatch) return null;
      const parentOrder = safeOrders.find(o => o?.orderNo === dispatch.orderNo);
      const price = parentOrder ? (Number(parentOrder.price) || 0) : 0;
      const dispatchedPrice = (Number(dispatch.qty) || 0) * price;
      return { ...dispatch, parentOrder, price, dispatchedPrice };
    }).filter(d => d && ((d.orderNo || '').includes(searchQuery) || ((d.parentOrder?.customer) || '').includes(searchQuery)));
  }, [dispatches, orders, searchQuery]);

  const safeProcessedOrders = Array.isArray(processedOrders) ? processedOrders : [];
  const totalRequired = safeProcessedOrders.reduce((sum, o) => sum + (Number(o?.reqQty) || 0), 0);
  const totalDispatched = safeProcessedOrders.reduce((sum, o) => sum + (Number(o?.dispatchedQty) || 0), 0);
  const totalRemaining = safeProcessedOrders.reduce((sum, o) => sum + (Number(o?.remainingQty) || 0), 0);

  // ==========================================
  // --- دوال فتح النوافذ ---
  // ==========================================
  const openNewOrderModal = () => {
    setEditingOrderId(null);
    setNewOrder({ date: new Date().toISOString().split('T')[0], orderNo: '', customer: '', cableType: '', reqQty: '', price: '', deliveryDate: '' });
    setShowOrderModal(true);
  };

  const openNewDispatchModal = () => {
    setEditingDispatchId(null);
    setNewDispatch({ date: new Date().toISOString().split('T')[0], orderNo: '', qty: '', shipment: '', receipt: '', driver: '', notes: '' });
    setShowDispatchModal(true);
  };

  // ==========================================
  // --- دوال الحفظ والتحقق من المتبقي ---
  // ==========================================
  const handleSaveOrder = () => {
    try {
      if (!newOrder.orderNo || !newOrder.customer || !newOrder.reqQty) return alert("يرجى ملء الحقول الإجبارية");
      
      const safeOrders = Array.isArray(orders) ? orders : [];
      let updated = [];

      if (editingOrderId) {
        updated = safeOrders.map(o => o?.id === editingOrderId ? { ...o, ...newOrder, reqQty: Number(newOrder.reqQty) || 0, price: Number(newOrder.price) || 0 } : o);
      } else {
        updated = [{ id: Date.now().toString(), ...newOrder, reqQty: Number(newOrder.reqQty) || 0, price: Number(newOrder.price) || 0 }, ...safeOrders];
      }
      
      saveOrdersToStorageAndDb(updated);
      setShowOrderModal(false);
      setEditingOrderId(null);
    } catch (error: any) {
      alert("حدث خطأ أثناء حفظ العقد: " + (error?.message || ""));
    }
  };

  const handleSaveDispatch = () => {
    try {
      if (!newDispatch.orderNo || !newDispatch.qty) return alert("يرجى اختيار الطلب وكتابة الكمية");
      
      const safeOrders = Array.isArray(orders) ? orders : [];
      const safeDispatches = Array.isArray(dispatches) ? dispatches : [];

      const selectedOrder = safeOrders.find(o => o?.orderNo === newDispatch.orderNo);
      
      const previouslyDispatched = safeDispatches
        .filter(d => d?.orderNo === newDispatch.orderNo && d?.id !== editingDispatchId && d?.status !== 'REJECTED')
        .reduce((sum, d) => sum + (Number(d?.qty) || 0), 0);
      
      const remainingAllowable = (Number(selectedOrder?.reqQty) || 0) - previouslyDispatched;

      if ((Number(newDispatch.qty) || 0) > remainingAllowable) {
        return alert(`❌ خطأ: الكمية المطلوبة (${newDispatch.qty}) أكبر من المتبقي المسموح به (${remainingAllowable})!`);
      }

      let updated = [];
      if (editingDispatchId) {
        updated = safeDispatches.map(d => d?.id === editingDispatchId ? { ...d, ...newDispatch, qty: Number(newDispatch.qty) || 0 } : d);
      } else {
        // إنشاء الطلب بحالة الانتظار
        updated = [{ id: Date.now().toString(), ...newDispatch, qty: Number(newDispatch.qty) || 0, status: 'PENDING_WAREHOUSE' }, ...safeDispatches];
        setTimeout(() => {
          alert(`✅ تم إرسال طلب التجهيز بنجاح!\n\nتم إرسال إشعار آلي إلى "قسم المخازن" بانتظار الاعتماد والصرف.`);
        }, 300);
      }
      
      saveDispatchesToStorageAndDb(updated);
      setShowDispatchModal(false);
      setEditingDispatchId(null);
    } catch (error: any) {
      alert("حدث خطأ أثناء إرسال طلب التجهيز: " + (error?.message || ""));
    }
  };

  const handleEditOrder = (order: any) => {
    if (!order) return;
    setEditingOrderId(order.id);
    setNewOrder({
      date: order.date || '', orderNo: order.orderNo || '', customer: order.customer || '', 
      cableType: order.cableType || '', reqQty: (order.reqQty || 0).toString(), 
      price: (order.price || 0).toString(), deliveryDate: order.deliveryDate || ''
    });
    setShowOrderModal(true);
  };

  const handleDeleteOrder = (id: string | number) => {
    if (window.confirm('⚠️ تحذير: هل أنت متأكد من حذف هذا العقد؟\n(سيتم حذف جميع التسليمات اليومية المرتبطة به أيضاً!)')) {
      const orderToDelete = orders.find(o => o?.id === id);
      const updatedOrders = orders.filter(o => o?.id !== id);
      saveOrdersToStorageAndDb(updatedOrders);
      if (orderToDelete) {
        const updatedDispatches = dispatches.filter(d => d?.orderNo !== orderToDelete.orderNo);
        saveDispatchesToStorageAndDb(updatedDispatches);
      }
    }
  };

  const handleEditDispatch = (dispatch: any) => {
    if (!dispatch) return;
    setEditingDispatchId(dispatch.id);
    setNewDispatch({
      date: dispatch.date || '', orderNo: dispatch.orderNo || '', qty: (dispatch.qty || 0).toString(), 
      shipment: dispatch.shipment || '', receipt: dispatch.receipt || '', 
      driver: dispatch.driver || '', notes: dispatch.notes || ''
    });
    setShowDispatchModal(true);
  };

  const handleDeleteDispatch = (id: string | number) => {
    if (window.confirm('هل أنت متأكد من سحب/إلغاء طلب التجهيز هذا؟')) {
      const updated = dispatches.filter(d => d?.id !== id);
      saveDispatchesToStorageAndDb(updated);
    }
  };

  return (
    <div dir="rtl" className="p-6 max-w-[1500px] mx-auto font-sans animate-in fade-in duration-500 pb-20">
      
      {/* الرأس المحسن مع الجرس */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <ShoppingCart className="text-indigo-600" size={32} /> إدارة المبيعات والعقود
          </h1>
          <p className="text-slate-500 mt-1 font-medium">متابعة الطلبات، طلبات التجهيز، والأرصدة المتبقية</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          
          {/* أيقونة الجرس للمبيعات 🔔 */}
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
                  <span className="font-bold text-slate-800 text-sm">إشعارات المخازن والمحاسبة</span>
                  <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">{unreadCount} جديد</span>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-sm font-bold">لا توجد إشعارات حالياً</div>
                  ) : (
                    notifications.map(notif => (
                      <div 
                        key={notif.id} 
                        onClick={() => handleReadNotification(notif.id)}
                        className={`p-3 border-b border-slate-50 cursor-pointer transition ${notif.isRead ? 'bg-white hover:bg-slate-50' : 'bg-blue-50/50 hover:bg-blue-50'}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-xs font-bold flex items-center gap-1 ${notif.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {notif.type === 'success' ? <CheckCircle2 size={14}/> : <Ban size={14}/>}
                            تحديث حالة طلبية
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

          <button onClick={openNewOrderModal} className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-all cursor-pointer">
            <FileCheck size={20} /> عقد جديد
          </button>
          <button onClick={openNewDispatchModal} className="flex-1 md:flex-none bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 transition-all cursor-pointer">
            <Truck size={20} /> طلب تجهيز
          </button>
        </div>
      </div>

      {/* لوحة التحكم */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="bg-blue-100 p-4 rounded-xl text-blue-600"><FileSpreadsheet size={28}/></div>
          <div>
            <p className="text-slate-500 font-bold text-sm">إجمالي الأمتار المطلوبة</p>
            <p className="text-2xl font-black text-slate-800">{totalRequired.toLocaleString()} <span className="text-sm text-slate-400">متر</span></p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="bg-emerald-100 p-4 rounded-xl text-emerald-600"><TrendingUp size={28}/></div>
          <div>
            <p className="text-slate-500 font-bold text-sm">إجمالي المجهز الفعلي</p>
            <p className="text-2xl font-black text-slate-800">{totalDispatched.toLocaleString()} <span className="text-sm text-slate-400">متر</span></p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="bg-rose-100 p-4 rounded-xl text-rose-600"><PackageOpen size={28}/></div>
          <div>
            <p className="text-slate-500 font-bold text-sm">إجمالي المتبقي الفعلي</p>
            <p className="text-2xl font-black text-slate-800">{totalRemaining.toLocaleString()} <span className="text-sm text-slate-400">متر</span></p>
          </div>
        </div>
      </div>

      {/* التبويبات والبحث */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto hide-scrollbar">
          <button onClick={() => setActiveTab('orders')} className={`px-6 py-2.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${activeTab === 'orders' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>سجل الطلبات الرئيسية</button>
          <button onClick={() => setActiveTab('dispatches')} className={`px-6 py-2.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${activeTab === 'dispatches' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>سجل طلبات التجهيز</button>
        </div>
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 w-full md:w-72">
          <Search className="text-slate-400" size={18} />
          <input type="text" placeholder="بحث بالطلب أو الزبون..." className="bg-transparent border-none outline-none p-2.5 w-full text-sm font-bold" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* 1. جدول الطلبات الرئيسية */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto animate-in fade-in">
          <table className="w-full whitespace-nowrap text-right text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 font-bold text-slate-600">تاريخ الطلب</th>
                <th className="p-4 font-bold text-slate-600">رقم الطلب</th>
                <th className="p-4 font-bold text-slate-600">الزبون / الشركة</th>
                <th className="p-4 font-bold text-slate-600">نوع القابلو</th>
                <th className="p-4 font-bold text-slate-600">الكمية المطلوبة</th>
                <th className="p-4 font-bold text-slate-600 bg-amber-50/50">سعر المتر</th>
                <th className="p-4 font-bold text-slate-600 bg-amber-50/50">سعر الطلب</th>
                <th className="p-4 font-bold text-emerald-600">المجهز</th>
                <th className="p-4 font-bold text-emerald-600 bg-emerald-50/30">سعر المجهز</th>
                <th className="p-4 font-bold text-rose-600">المتبقي</th>
                <th className="p-4 font-bold text-rose-600 bg-rose-50/30">سعر المتبقي</th>
                <th className="p-4 font-bold text-slate-600">نسبة الإنجاز</th>
                <th className="p-4 font-bold text-slate-600 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={13} className="p-8 text-center text-slate-400">جاري التحميل...</td></tr>
              ) : safeProcessedOrders.length === 0 ? (
                <tr><td colSpan={13} className="p-8 text-center text-slate-400">لا توجد بيانات للعرض</td></tr>
              ) : safeProcessedOrders.map(order => order && (
                <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-mono text-slate-500">{order.date || '-'}</td>
                  <td className="p-4 font-black text-indigo-700 bg-indigo-50/50">{order.orderNo || '-'}</td>
                  <td className="p-4 font-bold text-slate-800">{order.customer || '-'}</td>
                  <td className="p-4 font-mono text-slate-600">{order.cableType || '-'}</td>
                  <td className="p-4 font-bold">{Number(order.reqQty).toLocaleString()} m</td>
                  <td className="p-4 font-bold text-amber-700 bg-amber-50/30">{Number(order.price).toLocaleString()}</td>
                  <td className="p-4 font-bold text-slate-800 bg-amber-50/30">{Number(order.totalPrice).toLocaleString()}</td>
                  <td className="p-4 font-bold text-emerald-600">{Number(order.dispatchedQty).toLocaleString()} m</td>
                  <td className="p-4 font-bold text-emerald-700 bg-emerald-50/30">{Number(order.dispatchedPrice).toLocaleString()}</td>
                  <td className="p-4 font-bold text-rose-600">{Number(order.remainingQty).toLocaleString()} m</td>
                  <td className="p-4 font-bold text-rose-700 bg-rose-50/30">{Number(order.remainingPrice).toLocaleString()}</td>
                  <td className="p-4 w-24">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${order.progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${order.progress || 0}%` }}></div>
                      </div>
                      <span className="text-[10px] font-bold w-6 text-slate-500">{order.progress || 0}%</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => handleEditOrder(order)} className="p-1.5 text-slate-400 hover:text-amber-600 bg-white border border-slate-200 rounded-lg transition-colors cursor-pointer" title="تعديل"><Edit2 size={16} /></button>
                      <button onClick={() => handleDeleteOrder(order.id)} className="p-1.5 text-slate-400 hover:text-rose-600 bg-white border border-slate-200 rounded-lg transition-colors cursor-pointer" title="حذف"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 2. جدول طلبات التجهيز (بميزة الحالة) */}
      {activeTab === 'dispatches' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto animate-in fade-in">
          <table className="w-full whitespace-nowrap text-right text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 font-bold text-slate-600">التاريخ</th>
                <th className="p-4 font-bold text-slate-600">الطلب (الشركة)</th>
                <th className="p-4 font-bold text-slate-600 bg-blue-50/50">الكمية المطلوبة</th>
                <th className="p-4 font-bold text-slate-600">رقم الشحنة</th>
                <th className="p-4 font-bold text-slate-600 text-center">حالة الموافقة</th>
                <th className="p-4 font-bold text-slate-600 text-center">إلغاء الطلب</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">جاري التحميل...</td></tr>
              ) : safeProcessedOrders.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-400">لا توجد طلبات لعرضها</td></tr>
              ) : Array.isArray(processedDispatches) && processedDispatches.map(d => d && (
                <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-mono text-slate-500">{d.date || '-'}</td>
                  <td className="p-4 font-bold text-slate-800">
                    <span className="font-black text-indigo-700">{d.orderNo}</span> - {d.parentOrder?.customer || '---'}
                  </td>
                  <td className="p-4 font-black text-blue-700 bg-blue-50/30">{Number(d.qty).toLocaleString()} m</td>
                  <td className="p-4 text-slate-600 font-mono text-xs">{d.shipment || '-'}</td>
                  
                  {/* عمود الحالة */}
                  <td className="p-4 text-center">
                    {d.status === 'PENDING_WAREHOUSE' && <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1 rounded-full text-xs font-bold animate-pulse"><Clock size={14}/> بانتظار المخزن</span>}
                    {d.status === 'COMPLETED' && <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-bold"><CheckCircle2 size={14}/> تم الصرف</span>}
                    {d.status === 'REJECTED' && <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1 rounded-full text-xs font-bold"><Ban size={14}/> مرفوض</span>}
                  </td>
                  
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => handleDeleteDispatch(d.id)} 
                        disabled={d.status === 'COMPLETED'}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${d.status === 'COMPLETED' ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-rose-600 bg-white border border-slate-200 hover:border-rose-300'}`} 
                        title="إلغاء الطلب"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* النوافذ المنبثقة (Modals) */}
      
      {/* 1. نافذة طلبية رئيسية */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white p-6 rounded-2xl w-full max-w-xl shadow-2xl">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4">
              <h2 className="font-black text-xl flex items-center gap-2 text-slate-800">
                <FileCheck className="text-indigo-600"/> {editingOrderId ? 'تعديل بيانات العقد' : 'عقد / طلب جديد'}
              </h2>
              <button onClick={() => setShowOrderModal(false)} className="p-2 bg-slate-100 text-slate-500 hover:text-rose-600 rounded-xl cursor-pointer"><X size={20}/></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-bold text-slate-700 mb-1">رقم الطلب (العقد) *</label><input type="text" className="w-full border p-2.5 rounded-xl outline-none focus:border-indigo-500 font-mono" value={newOrder.orderNo} onChange={e => setNewOrder({...newOrder, orderNo: e.target.value})} disabled={!!editingOrderId} /></div>
              <div><label className="block text-sm font-bold text-slate-700 mb-1">تاريخ الطلب</label><input type="date" className="w-full border p-2.5 rounded-xl outline-none focus:border-indigo-500" value={newOrder.date} onChange={e => setNewOrder({...newOrder, date: e.target.value})} /></div>
              <div className="col-span-2"><label className="block text-sm font-bold text-slate-700 mb-1">اسم الزبون / الشركة *</label><input type="text" className="w-full border p-2.5 rounded-xl outline-none focus:border-indigo-500" value={newOrder.customer} onChange={e => setNewOrder({...newOrder, customer: e.target.value})} /></div>
              <div className="col-span-2"><label className="block text-sm font-bold text-slate-700 mb-1">نوع السلك أو القابلو</label><input type="text" className="w-full border p-2.5 rounded-xl outline-none focus:border-indigo-500" value={newOrder.cableType} onChange={e => setNewOrder({...newOrder, cableType: e.target.value})} /></div>
              <div><label className="block text-sm font-bold text-slate-700 mb-1">الكمية المطلوبة (بالمتر) *</label><input type="number" className="w-full border p-2.5 rounded-xl outline-none focus:border-indigo-500 bg-blue-50" value={newOrder.reqQty} onChange={e => setNewOrder({...newOrder, reqQty: e.target.value})} /></div>
              <div><label className="block text-sm font-bold text-slate-700 mb-1">سعر المتر (د.ع)</label><input type="number" className="w-full border p-2.5 rounded-xl outline-none focus:border-indigo-500" value={newOrder.price} onChange={e => setNewOrder({...newOrder, price: e.target.value})} /></div>
              <div className="col-span-2"><label className="block text-sm font-bold text-slate-700 mb-1">تاريخ التسليم المتوقع</label><input type="date" className="w-full border p-2.5 rounded-xl outline-none focus:border-indigo-500" value={newOrder.deliveryDate} onChange={e => setNewOrder({...newOrder, deliveryDate: e.target.value})} /></div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
              <button onClick={() => setShowOrderModal(false)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer">إلغاء</button>
              <button onClick={handleSaveOrder} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-2 cursor-pointer"><CheckCircle2 size={18}/> حفظ البيانات</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. نافذة طلب تجهيز */}
      {showDispatchModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white p-6 rounded-2xl w-full max-w-xl shadow-2xl border-t-8 border-amber-400">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-4">
              <h2 className="font-black text-xl flex items-center gap-2 text-slate-800">
                <Truck className="text-amber-500"/> إنشاء طلب تجهيز للمخازن
              </h2>
              <button onClick={() => setShowDispatchModal(false)} className="p-2 bg-slate-100 text-slate-500 hover:text-rose-600 rounded-xl cursor-pointer"><X size={20}/></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">اختر الطلبية / العقد *</label>
                <select 
                  className="w-full border-2 border-slate-200 p-3 rounded-xl outline-none focus:border-amber-500 font-bold text-indigo-700"
                  value={newDispatch.orderNo}
                  onChange={e => setNewDispatch({...newDispatch, orderNo: e.target.value})}
                  disabled={!!editingDispatchId}
                >
                  <option value="" disabled>-- اختر رقم الطلب --</option>
                  {Array.isArray(orders) && orders.map(o => o && (
                    <option key={o.id} value={o.orderNo}>{o.orderNo} - {o.customer} ({o.cableType})</option>
                  ))}
                </select>
              </div>

              {newDispatch.orderNo && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex justify-between items-center animate-in fade-in zoom-in-95">
                  <div>
                    <p className="text-xs text-slate-500 font-bold mb-1">الرصيد المتبقي المسموح بالطلب</p>
                    <p className="text-xl font-black text-rose-600">
                      {((Number(orders.find(o => o?.orderNo === newDispatch.orderNo)?.reqQty) || 0) - 
                      (Array.isArray(dispatches) ? dispatches : []).filter(d => d?.orderNo === newDispatch.orderNo && d?.id !== editingDispatchId && d?.status !== 'REJECTED').reduce((sum, d) => sum + (Number(d?.qty) || 0), 0)).toLocaleString()} متر
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-slate-500 font-bold mb-1">السعر المتفق عليه</p>
                    <p className="text-lg font-bold text-slate-800">{(Number(orders.find(o => o?.orderNo === newDispatch.orderNo)?.price) || 0).toLocaleString()} د.ع/م</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-bold text-slate-700 mb-1">الكمية المطلوبة (متر) *</label>
                  <input type="number" className="w-full border-2 border-amber-200 p-2.5 rounded-xl outline-none focus:border-amber-500 bg-amber-50 text-amber-900 font-black text-lg" value={newDispatch.qty} onChange={e => setNewDispatch({...newDispatch, qty: e.target.value})} />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-bold text-slate-700 mb-1">تاريخ الطلب</label>
                  <input type="date" className="w-full border p-2.5 rounded-xl outline-none focus:border-amber-500" value={newDispatch.date} onChange={e => setNewDispatch({...newDispatch, date: e.target.value})} />
                </div>
                <div><label className="block text-sm font-bold text-slate-700 mb-1">رقم الشحنة المقترح</label><input type="text" className="w-full border p-2.5 rounded-xl outline-none focus:border-amber-500" value={newDispatch.shipment} onChange={e => setNewDispatch({...newDispatch, shipment: e.target.value})} /></div>
                <div className="col-span-2"><label className="block text-sm font-bold text-slate-700 mb-1">ملاحظات للمخزن</label><input type="text" className="w-full border p-2.5 rounded-xl outline-none focus:border-amber-500" value={newDispatch.notes} onChange={e => setNewDispatch({...newDispatch, notes: e.target.value})} placeholder="اكتب تعليمات لأمين المخزن هنا..."/></div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
              <button onClick={() => setShowDispatchModal(false)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer">إلغاء</button>
              <button onClick={handleSaveDispatch} className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-amber-200 cursor-pointer">
                <Truck size={18}/> إرسال الطلب للمخازن
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}