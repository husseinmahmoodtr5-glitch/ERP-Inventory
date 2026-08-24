import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Factory, Plus, Trash2, Layers, ClipboardList, CheckCircle2, 
  AlertCircle, X, Settings, Play, Check, Activity, BarChart3, Edit2, Bell
} from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

// ==========================================
// --- واجهات البيانات (Interfaces) ---
// ==========================================
interface BOMItem {
  material_name: string;
  quantity_per_meter: number;
  unit: string;
  waste_percent: number;
}

interface BOM {
  id: string;
  product_name: string;
  product_code: string;
  unit: string;
  items: BOMItem[];
}

interface Material { 
  id: string | number; 
  material_code: string; 
  warehouse_name: string; 
  material_name: string; 
  unit: string; 
}

interface ProductionOrder {
  id: string;
  order_number: string;
  product_name: string;
  target_quantity: number;
  unit: string;
  start_date: string;
  completed_date?: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  materials_used: { name: string; quantity: number; unit: string }[];
}

const normalizeText = (str: string) => {
  if (!str) return '';
  return String(str).trim().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').toLowerCase();
};

export default function Production() {
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'BOM' | 'LOG'>('ORDERS');
  
  const [boms, setBoms] = useState<BOM[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [liveStock, setLiveStock] = useState<any[]>([]); // 🚀 تم استبدال الحركات العشوائية بجدول الأرصدة الحية
  const [warehouses, setWarehouses] = useState<any[]>([]); // لحل مشكلة العلاقات (FK)
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  
  const [showBomModal, setShowBomModal] = useState<boolean>(false);
  const [editingBomId, setEditingBomId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  
  const [isCustomProduct, setIsCustomProduct] = useState<boolean>(false);
  const [customProductName, setCustomProductName] = useState<string>('');
  const [customProductCode, setCustomProductCode] = useState<string>('');

  const [selectedMaterialsList, setSelectedMaterialsList] = useState<string[]>([]);
  const [bomItemsConfig, setBomItemsConfig] = useState<BOMItem[]>([]);
  const [bomStep, setBomStep] = useState<1 | 2>(1);

  const [orderNumber, setOrderNumber] = useState<string>('');
  const [selectedBomId, setSelectedBomId] = useState<string>('');
  const [targetQuantity, setTargetQuantity] = useState<number>(5000);

  // إعدادات الإشعارات (الجرس 🔔)
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<any[]>([
    { id: 1, message: "الجودة: تم اجتياز الفحص لكابل 2x35 بنجاح، يمكنك بدء الإنتاج.", isRead: false, date: "قبل قليل" }
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

  useEffect(() => {
    fetchInitialData();
    generateOrderNumber();
  }, []);

  const generateOrderNumber = () => {
    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, '');
    const randomNum = Math.floor(100 + Math.random() * 900);
    setOrderNumber(`PROD-${dateStr}-${randomNum}`);
  };

  const fetchInitialData = async () => {
    try {
      const localBoms = localStorage.getItem('app_boms');
      if (localBoms) setBoms(JSON.parse(localBoms) || []);

      const localOrders = localStorage.getItem('app_production_orders');
      if (localOrders) setOrders(JSON.parse(localOrders) || []);

      if (supabase) {
        // 🚀 جلب مباشر وسريع جداً: المواد، المخازن، والرصيد النهائي الجاهز (Anti-Lag)
        const [matRes, whRes, stockRes] = await Promise.all([
          supabase.from('materials').select('*'),
          supabase.from('warehouses').select('*'),
          supabase.from('live_stock_view').select('*')
        ]);

        if (matRes.error) throw matRes.error;
        if (whRes.error) throw whRes.error;
        if (stockRes.error) throw stockRes.error;

        if (matRes.data) setMaterials(matRes.data as Material[]);
        if (whRes.data) setWarehouses(whRes.data);
        if (stockRes.data) setLiveStock(stockRes.data);
      }
    } catch (error: any) {
      console.warn('تعذر جلب البيانات من السيرفر. يتم الاعتماد على التخزين المحلي.', error?.message);
    }
  };

  const saveBoms = (updated: BOM[]) => {
    const safeUpdated = Array.isArray(updated) ? updated : [];
    setBoms(safeUpdated);
    try {
      localStorage.setItem('app_boms', JSON.stringify(safeUpdated));
    } catch (e) {
      console.warn("Storage Full", e);
    }
  };

  const saveOrders = (updated: ProductionOrder[]) => {
    const safeUpdated = Array.isArray(updated) ? updated : [];
    setOrders(safeUpdated);
    try {
      localStorage.setItem('app_production_orders', JSON.stringify(safeUpdated));
    } catch (e) {
      console.warn("Storage Full", e);
    }
  };

  // 🚀 قراءة الرصيد لحظياً بدون أي عمليات حسابية ثقيلة
  const getStock = (itemName: string) => {
    if (!itemName) return 0;
    const targetNorm = normalizeText(itemName);
    const record = liveStock.find(s => normalizeText(s.material_name) === targetNorm);
    return record ? Number(record.current_balance) : 0;
  };

  const allAvailableItems = useMemo(() => {
    const itemsMap = new Map<string, {name: string, code: string, unit: string, warehouse_name: string}>();
    
    liveStock.forEach(m => {
      if (m?.material_name) {
        itemsMap.set(normalizeText(m.material_name), { 
          name: m.material_name, code: m.material_code || '-', unit: m.unit || 'وحدة', warehouse_name: m.warehouse_name || '' 
        });
      }
    });

    materials.forEach(m => {
      if (m?.material_name && !itemsMap.has(normalizeText(m.material_name))) {
        itemsMap.set(normalizeText(m.material_name), { 
          name: m.material_name, code: m.material_code || '-', unit: m.unit || 'وحدة', warehouse_name: m.warehouse_name || '' 
        });
      }
    });

    return Array.from(itemsMap.values());
  }, [liveStock, materials]);

  const { displayProducts, displayMaterials } = useMemo(() => {
    const products = allAvailableItems.filter(item => 
      item?.warehouse_name?.trim() === 'مخزن الانتاج التام' || item?.warehouse_name?.trim() === 'مخزن الإنتاج التام'
    );
    const rawMaterials = allAvailableItems.filter(item => 
      item?.warehouse_name?.trim() !== 'مخزن الانتاج التام' && item?.warehouse_name?.trim() !== 'مخزن الإنتاج التام'
    );
    return { displayProducts: products, displayMaterials: rawMaterials };
  }, [allAvailableItems]);

  const handleStartProduction = async () => {
    if (!selectedBomForCalc) return;
    if (!window.confirm(`تأكيد بدء أمر الإنتاج (${orderNumber})؟ سيتم خصم المواد من المخزن.`)) return;

    const todayDate = new Date().toISOString().split('T')[0];
    const materialsUsedSummary: { name: string; quantity: number; unit: string }[] = [];
    const newOutMovements: any[] = [];
    
    const safeItems = Array.isArray(selectedBomForCalc.items) ? selectedBomForCalc.items : [];
    
    // جلب كود مخزن الإنتاج لتلبية متطلبات (Foreign Key)
    const prodWarehouse = warehouses.find(w => normalizeText(w.warehouse_name).includes('انتاج')) || { warehouse_code: '2', warehouse_name: 'قسم الإنتاج' };

    safeItems.forEach(item => {
      if (!item) return;
      const netNeeded = (Number(item.quantity_per_meter) || 0) * (Number(targetQuantity) || 0);
      const grossNeeded = netNeeded * (1 + ((Number(item.waste_percent) || 0) / 100));
      const qtyRounded = Number(grossNeeded.toFixed(3));

      materialsUsedSummary.push({ name: item.material_name || '', quantity: qtyRounded, unit: item.unit || '' });
      
      const matCode = materials.find(m => normalizeText(m.material_name) === normalizeText(item.material_name))?.material_code || null;

      newOutMovements.push({
        transaction_date: todayDate,
        warehouse_name: prodWarehouse.warehouse_name,
        warehouse_code: prodWarehouse.warehouse_code, // 🛡️ تم إضافة كود المخزن للحماية
        material_name: item.material_name,
        material_code: matCode, // 🛡️ تم إضافة كود المادة للحماية
        unit: item.unit,
        quantity_issued: qtyRounded,
        reels_issued: 0,
        recipient: 'صالة الإنتاج',
        notes: `صرف آلي لأمر إنتاج (${orderNumber}) - لإنتاج ${selectedBomForCalc.product_name}`,
        qc_status: 'مقبول (مطابق)',
        entry_number: orderNumber
      });
    });

    const newOrder: ProductionOrder = {
      id: Date.now().toString(),
      order_number: orderNumber,
      product_name: selectedBomForCalc.product_name,
      target_quantity: targetQuantity,
      unit: 'متر',
      start_date: new Date().toLocaleString('ar-IQ'),
      status: 'IN_PROGRESS',
      materials_used: materialsUsedSummary
    };

    try {
      if (supabase) {
        const { error } = await supabase.from('outbound').insert(newOutMovements);
        if (error) throw error;
      }
    } catch (error: any) {
      console.warn('خطأ بالاتصال بالسيرفر أثناء إنشاء الأمر (تم الحفظ محلياً)', error?.message);
    }

    saveOrders([newOrder, ...orders]);
    alert(`✅ تم تأكيد الأمر بنجاح وخصم المواد من المخزن!`);
    
    generateOrderNumber();
    setActiveTab('LOG');
    fetchInitialData(); // 🚀 تحديث الأرصدة الحية فوراً
  };

  const handleCompleteOrder = async (order: ProductionOrder) => {
    if (!order) return;
    if (!window.confirm(`هل اكتمل التصنيع؟ سيتم إضافة (${order.target_quantity.toLocaleString()}) كـ "وارد جديد" إلى المخزن.`)) return;

    const todayDate = new Date().toISOString().split('T')[0];
    const targetWarehouse = warehouses.find(w => normalizeText(w.warehouse_name).includes('تام')) || { warehouse_code: '3', warehouse_name: 'مخزن الانتاج التام' };
    let finalMatCode = '';

    try {
      if (supabase) {
        const { data: existingMaterial, error: checkError } = await supabase
          .from('materials')
          .select('*')
          .eq('material_name', order.product_name)
          .maybeSingle();

        if (checkError) throw checkError;

        if (!existingMaterial) {
          const safeBoms = Array.isArray(boms) ? boms : [];
          const relatedBom = safeBoms.find(b => b?.product_name === order.product_name);
          finalMatCode = relatedBom?.product_code || `PRD-${Date.now().toString().slice(-4)}`;
          
          const { error: insertError } = await supabase.from('materials').insert([{
            material_name: order.product_name,
            material_code: finalMatCode,
            warehouse_name: targetWarehouse.warehouse_name,
            warehouse_code: targetWarehouse.warehouse_code, // 🛡️
            unit: order.unit,
            qc_required: false,
            min_stock: 0,
            cost_price: 0
          }]);
          if (insertError) throw insertError;
        } else {
          finalMatCode = existingMaterial.material_code;
        }

        const finishedProductMovement = {
          transaction_date: todayDate,
          warehouse_name: targetWarehouse.warehouse_name,
          warehouse_code: targetWarehouse.warehouse_code, // 🛡️
          material_name: order.product_name,
          material_code: finalMatCode, // 🛡️
          unit: order.unit,
          quantity_received: order.target_quantity,
          reels_received: 0,
          source: 'صالة الإنتاج',
          reference_or_notes: `إيداع آلي لمنتج تام عن أمر الإنتاج (${order.order_number})`,
          qc_status: 'مقبول (مطابق)',
          entry_number: order.order_number
        };

        const { error: moveError } = await supabase.from('inbound').insert([finishedProductMovement]);
        if (moveError) throw moveError;
      }

      const safeOrders = Array.isArray(orders) ? orders : [];
      const updatedOrders = safeOrders.map(o => o?.id === order.id ? { ...o, status: 'COMPLETED' as const, completed_date: new Date().toLocaleString('ar-IQ') } : o);
      saveOrders(updatedOrders);
      
      alert(`🎉 تمت العملية بنجاح!\n\nتم إيداع المنتج في مخزن الإنتاج التام.\n(إذا كان المنتج جديداً، تم تعريفه تلقائياً في فهرس المخازن).`);
      fetchInitialData(); // 🚀 تحديث الأرصدة الحية فوراً
      
    } catch (err: any) {
      console.error('خطأ بالاتصال بالسيرفر', err);
      alert('حدث خطأ أثناء حفظ الإيداع. يرجى المحاولة مرة أخرى أو التأكد من التوافق.');
    }
  };

  const toggleMaterialSelection = (materialName: string) => {
    if (!materialName) return;
    if (selectedMaterialsList.includes(materialName)) {
      setSelectedMaterialsList(prev => prev.filter(m => m !== materialName));
    } else {
      setSelectedMaterialsList(prev => [...prev, materialName]);
    }
  };

  const handleEditBom = (bom: BOM) => {
    if (!bom) return;
    setEditingBomId(bom.id);
    
    const safeDisplayProducts = Array.isArray(displayProducts) ? displayProducts : [];
    const isCustom = !safeDisplayProducts.some(p => p?.name === bom.product_name);
    setIsCustomProduct(isCustom);
    
    if (isCustom) {
      setCustomProductName(bom.product_name || '');
      setCustomProductCode(bom.product_code || '');
      setSelectedProduct('');
    } else {
      setSelectedProduct(bom.product_name || '');
      setCustomProductName('');
      setCustomProductCode('');
    }

    const safeItems = Array.isArray(bom.items) ? bom.items : [];
    setSelectedMaterialsList(safeItems.map(item => item?.material_name || '').filter(name => name !== ''));
    setBomItemsConfig(safeItems);
    setBomStep(1);
    setShowBomModal(true);
  };

  const proceedToBomFormula = () => {
    const finalProductName = isCustomProduct ? customProductName.trim() : selectedProduct;
    
    if (!finalProductName) return alert('الرجاء تحديد أو كتابة المنتج المراد تصنيعه');
    if (selectedMaterialsList.length === 0) return alert('الرجاء اختيار مادة خام واحدة على الأقل');

    const safeBomItemsConfig = Array.isArray(bomItemsConfig) ? bomItemsConfig : [];
    const safeDisplayMaterials = Array.isArray(displayMaterials) ? displayMaterials : [];

    const newConfig = selectedMaterialsList.map(matName => {
      const existingItem = safeBomItemsConfig.find(item => item?.material_name === matName);
      if (existingItem) return existingItem;

      const found = safeDisplayMaterials.find(t => t?.name === matName);
      return { material_name: matName, quantity_per_meter: 0, unit: found ? found.unit : 'كجم', waste_percent: 1.5 };
    });
    
    setBomItemsConfig(newConfig);
    setBomStep(2);
  };

  const handleSaveBom = () => {
    const safeBomItemsConfig = Array.isArray(bomItemsConfig) ? bomItemsConfig : [];
    const hasZero = safeBomItemsConfig.some(item => Number(item?.quantity_per_meter) <= 0);
    if (hasZero) return alert('الرجاء إدخال كميات صحيحة أكبر من صفر لكل المواد');

    const finalProductName = isCustomProduct ? customProductName.trim() : selectedProduct;
    const safeDisplayProducts = Array.isArray(displayProducts) ? displayProducts : [];
    const finalProductCode = isCustomProduct 
      ? (customProductCode.trim() || `PRD-${Date.now().toString().slice(-4)}`) 
      : (safeDisplayProducts.find(t => t?.name === finalProductName)?.code || `PRD-${Date.now().toString().slice(-4)}`);

    const newBom: BOM = {
      id: editingBomId || Date.now().toString(),
      product_name: finalProductName,
      product_code: finalProductCode,
      unit: 'متر',
      items: safeBomItemsConfig
    };

    const safeBoms = Array.isArray(boms) ? boms : [];
    if (editingBomId) {
      saveBoms(safeBoms.map(b => b?.id === editingBomId ? newBom : b));
    } else {
      saveBoms([newBom, ...safeBoms.filter(b => b?.product_name !== finalProductName)]);
    }
    
    setShowBomModal(false);
    resetBomModal();
  };

  const resetBomModal = () => {
    setBomStep(1); 
    setSelectedProduct(''); 
    setIsCustomProduct(false);
    setCustomProductName('');
    setCustomProductCode('');
    setSelectedMaterialsList([]); 
    setBomItemsConfig([]);
    setEditingBomId(null);
  };

  const handleDeleteBom = (id: string) => {
    const safeBoms = Array.isArray(boms) ? boms : [];
    if (window.confirm('هل أنت متأكد من حذف هذه الوصفة؟')) saveBoms(safeBoms.filter(b => b?.id !== id));
  };

  const safeBomsCalc = Array.isArray(boms) ? boms : [];
  const selectedBomForCalc = safeBomsCalc.find(b => b?.id === selectedBomId);
  const safeSelectedBomItems = selectedBomForCalc ? (Array.isArray(selectedBomForCalc.items) ? selectedBomForCalc.items : []) : [];
  
  const canProduce = selectedBomForCalc ? safeSelectedBomItems.every(item => {
    if (!item) return false;
    const grossNeeded = (Number(item.quantity_per_meter) * Number(targetQuantity)) * (1 + (Number(item.waste_percent) / 100));
    return getStock(item.material_name) >= grossNeeded;
  }) : false;

  const safeOrdersCount = Array.isArray(orders) ? orders : [];
  const activeOrdersCount = safeOrdersCount.filter(o => o?.status === 'IN_PROGRESS').length;
  const completedOrdersCount = safeOrdersCount.filter(o => o?.status === 'COMPLETED').length;

  return (
    <div dir="rtl" className="p-6 bg-slate-50 min-h-screen font-sans pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Factory className="text-blue-600" /> إدارة ودورة حياة الإنتاج
          </h1>
          <p className="text-sm text-slate-500 mt-1">تخطيط الأوامر، الخصم الآلي، ومتابعة الأوامر قيد التشغيل والمكتملة.</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex bg-slate-200 p-1 rounded-xl w-full md:w-auto overflow-x-auto hide-scrollbar">
            <button onClick={() => setActiveTab('ORDERS')} className={`px-4 py-2.5 rounded-lg text-sm font-bold transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'ORDERS' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}><ClipboardList size={18} /> أمر جديد</button>
            <button onClick={() => setActiveTab('LOG')} className={`px-4 py-2.5 rounded-lg text-sm font-bold transition flex items-center gap-2 whitespace-nowrap relative ${activeTab === 'LOG' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>
              <Activity size={18} /> سجل الأوامر
              {activeOrdersCount > 0 && <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold absolute -top-1 -right-1">{activeOrdersCount}</span>}
            </button>
            <button onClick={() => setActiveTab('BOM')} className={`px-4 py-2.5 rounded-lg text-sm font-bold transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'BOM' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}><Layers size={18} /> وصفات التصنيع (BOM)</button>
          </div>

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
                  <span className="font-bold text-slate-800 text-sm">إشعارات الإنتاج</span>
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
                          <span className={`text-xs font-bold text-slate-500`}>تنبيه جديد</span>
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div><div className="text-xs font-bold text-slate-400">الأوامر قيد التشغيل حالياً</div><div className="text-2xl font-bold text-blue-600 mt-1">{activeOrdersCount} أمر</div></div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Activity size={24} /></div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div><div className="text-xs font-bold text-slate-400">الأوامر المكتملة</div><div className="text-2xl font-bold text-emerald-600 mt-1">{completedOrdersCount} أمر</div></div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><CheckCircle2 size={24} /></div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div><div className="text-xs font-bold text-slate-400">إجمالي الأوامر الكلي</div><div className="text-2xl font-bold text-slate-800 mt-1">{safeOrdersCount.length} أمر</div></div>
          <div className="p-3 bg-slate-100 text-slate-600 rounded-xl"><BarChart3 size={24} /></div>
        </div>
      </div>

      {activeTab === 'ORDERS' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-5 border-b pb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Settings className="text-blue-600" size={20} /> إعداد أمر إنتاج جديد</h2>
              <div className="flex items-center gap-2"><span className="text-sm font-bold text-slate-500">رقم الأمر:</span><input type="text" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} className="bg-slate-100 border-none rounded-lg px-3 py-1.5 text-sm font-mono font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 w-48"/></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-xl border border-slate-200">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">المنتج المراد تصنيعه (من الوصفات المعتمدة)</label>
                <select value={selectedBomId} onChange={e => setSelectedBomId(e.target.value)} className="w-full border border-slate-300 rounded-lg p-3 text-sm bg-white font-bold text-slate-800 shadow-sm focus:border-blue-500 outline-none">
                  <option value="">-- يرجى اختيار الوصفة --</option>
                  {safeBomsCalc.map(b => b ? <option key={b.id} value={b.id}>{b.product_name} [{b.product_code}]</option> : null)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">الكمية المستهدفة (بالمتر)</label>
                <div className="relative">
                  <input type="number" min="1" value={targetQuantity} onChange={e => setTargetQuantity(Number(e.target.value))} className="w-full border border-slate-300 rounded-lg p-3 text-lg font-bold text-blue-700 shadow-sm focus:border-blue-500 outline-none"/>
                  <span className="absolute left-3 top-3.5 text-sm font-bold text-slate-400">متر (m)</span>
                </div>
              </div>
            </div>
          </div>

          {selectedBomForCalc && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800 text-lg">تحليل المواد لإنتاج <span className="text-blue-600">{Number(targetQuantity).toLocaleString()} متر</span> من {selectedBomForCalc.product_name}</h3>
               </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th className="p-4 font-semibold">المادة الأولية</th>
                      <th className="p-4 text-center font-semibold text-slate-300">المعادلة (للمتر)</th>
                      <th className="p-4 text-center font-semibold text-blue-300">الصافي المطلوب (بدون هدر)</th>
                      <th className="p-4 text-center font-semibold text-amber-300">الإجمالي المطلوب (مع الهدر)</th>
                      <th className="p-4 text-center font-semibold">المتوفر في المخزن</th>
                      <th className="p-4 text-center font-semibold">حالة الرصيد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {safeSelectedBomItems.map((item, idx) => {
                      if (!item) return null;
                      const netNeeded = (Number(item.quantity_per_meter) || 0) * (Number(targetQuantity) || 0);
                      const grossNeeded = netNeeded * (1 + ((Number(item.waste_percent) || 0) / 100));
                      const stockAvailable = getStock(item.material_name);
                      const isSufficient = stockAvailable >= grossNeeded;
                      const deficit = grossNeeded - stockAvailable;

                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-4 font-bold text-slate-800">{item.material_name}</td>
                          <td className="p-4 text-center font-mono text-xs text-slate-500">{item.quantity_per_meter} {item.unit}</td>
                          <td className="p-4 text-center font-bold text-blue-600 bg-blue-50/50">{netNeeded.toLocaleString(undefined, {maximumFractionDigits: 2})} {item.unit}</td>
                          <td className="p-4 text-center font-bold text-amber-600 bg-amber-50/50">{grossNeeded.toLocaleString(undefined, {maximumFractionDigits: 2})} {item.unit}</td>
                          <td className="p-4 text-center font-mono font-bold text-slate-700">{stockAvailable.toLocaleString(undefined, {maximumFractionDigits: 2})} {item.unit}</td>
                          <td className="p-4 text-center">
                            {isSufficient ? <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold"><CheckCircle2 size={16} /> رصيد كافٍ</span> : <span className="inline-flex items-center gap-1.5 bg-rose-100 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold"><AlertCircle size={16} /> عجز ({deficit.toLocaleString(undefined, {maximumFractionDigits: 2})} {item.unit})</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-6 flex justify-end">
                <button disabled={!canProduce} onClick={handleStartProduction} className={`px-8 py-3 rounded-xl font-bold text-lg flex items-center gap-2 shadow-lg transition-all ${canProduce ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}><Play size={20} fill="currentColor" /> {canProduce ? 'تأكيد وبدء الإنتاج (سحب من المخزن)' : 'المخزون لا يكفي للإنتاج'}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'LOG' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm animate-in fade-in">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Activity className="text-blue-600" size={20} /> سجل أوامر الإنتاج</h2>
          {safeOrdersCount.length === 0 ? <div className="text-center py-12 text-slate-400"><ClipboardList size={48} className="mx-auto mb-2 opacity-40" /><p className="font-bold">لا توجد أوامر إنتاج صادرة بعد.</p></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b">
                  <tr>
                    <th className="p-3">رقم الأمر</th>
                    <th className="p-3">المنتج الهدف</th>
                    <th className="p-3 text-center">الكمية</th>
                    <th className="p-3 text-center">التاريخ</th>
                    <th className="p-3 text-center">الحالة</th>
                    <th className="p-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {safeOrdersCount.map(order => order && (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-blue-700">{order.order_number}</td>
                      <td className="p-3 font-bold text-slate-800">{order.product_name}</td>
                      <td className="p-3 text-center font-bold text-slate-700">{Number(order.target_quantity).toLocaleString()} {order.unit}</td>
                      <td className="p-3 text-center text-xs font-mono text-slate-500">{order.start_date}</td>
                      <td className="p-3 text-center">
                        {order.status === 'IN_PROGRESS' ? <span className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold animate-pulse"><Activity size={14} /> قيد التشغيل</span> : <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold"><CheckCircle2 size={14} /> مكتمل</span>}
                      </td>
                      <td className="p-3 text-center">
                        {order.status === 'IN_PROGRESS' && <button onClick={() => handleCompleteOrder(order)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow transition flex items-center gap-1 mx-auto cursor-pointer"><Check size={14} /> إكمال وإيداع</button>}
                        {order.status === 'COMPLETED' && <span className="text-xs text-slate-400 font-bold">تم الإيداع</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'BOM' && (
        <div className="animate-in fade-in">
          <div className="flex justify-between items-center mb-6">
            <div><h2 className="text-xl font-bold text-slate-800">وصفات التصنيع المعتمدة (BOM)</h2><p className="text-sm text-slate-500 mt-1">المقادير المعيارية لإنتاج متر واحد.</p></div>
            <button onClick={() => { resetBomModal(); setShowBomModal(true); }} className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md cursor-pointer"><Plus size={20} /> بناء وصفة جديدة</button>
          </div>
          {safeBomsCalc.length === 0 ? <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300"><Layers size={32} className="text-slate-400 mx-auto mb-4" /><h3 className="text-lg font-bold text-slate-700">لا توجد وصفات</h3></div> : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {safeBomsCalc.map(bom => bom && (
                <div key={bom.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-800 p-4 flex justify-between items-center">
                    <div><h3 className="font-bold text-white text-lg">{bom.product_name}</h3><p className="text-xs text-slate-300 mt-1">الكمية المعيارية: 1 {bom.unit}</p></div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEditBom(bom)} className="text-blue-400 hover:text-white hover:bg-blue-500 p-2 rounded-lg transition" title="تعديل الوصفة">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDeleteBom(bom.id)} className="text-rose-400 hover:text-white hover:bg-rose-500 p-2 rounded-lg transition" title="حذف الوصفة">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="space-y-3">
                      {Array.isArray(bom.items) ? bom.items.map((item, idx) => item && (
                        <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="font-bold text-slate-700 text-sm flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div>{item.material_name}</span>
                          <div className="text-right"><div className="font-mono font-bold text-blue-700 text-sm">{item.quantity_per_meter} {item.unit}</div><div className="text-[10px] font-bold text-slate-400 mt-0.5">هدر: {item.waste_percent}%</div></div>
                        </div>
                      )) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showBomModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-800 p-5 flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold text-white flex items-center gap-2"><Settings className="text-blue-400" /> {bomStep === 1 ? 'الخطوة 1: تحديد المواد' : 'الخطوة 2: هندسة المقادير'}</h3>
              <button onClick={() => setShowBomModal(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={24} /></button>
            </div>
            <div className="p-6 overflow-y-auto grow">
              {bomStep === 1 && (
                <div className="space-y-6">
                  
                  {/* إدخال المنتج التام (من المخزن أو جديد) */}
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <label className="block text-sm font-bold text-slate-700">المنتج التام المراد تصنيعه</label>
                      <button 
                        onClick={() => setIsCustomProduct(!isCustomProduct)}
                        className="text-xs font-bold text-blue-600 hover:underline bg-blue-50 px-3 py-1 rounded-lg"
                      >
                        {isCustomProduct ? 'العودة لقائمة المخزن' : '+ إدخال منتج جديد يدوياً'}
                      </button>
                    </div>

                    {isCustomProduct ? (
                      <div className="grid grid-cols-2 gap-3 bg-blue-50 p-4 rounded-xl border border-blue-200">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">اسم المنتج الجديد *</label>
                          <input type="text" placeholder="مثال: كابل 2x35 ملم" value={customProductName} onChange={e => setCustomProductName(e.target.value)} className="w-full border border-blue-300 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-blue-600" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">كود المنتج (اختياري)</label>
                          <input type="text" placeholder="PRD-1234" value={customProductCode} onChange={e => setCustomProductCode(e.target.value)} className="w-full border border-blue-300 rounded-lg p-2.5 text-sm font-mono outline-none focus:border-blue-600" />
                        </div>
                      </div>
                    ) : (
                      <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} className="w-full border-2 border-slate-200 rounded-xl p-3 text-sm bg-slate-50 font-bold text-indigo-700 outline-none focus:border-indigo-500">
                        <option value="">-- اختر من قائمة مخزن الانتاج التام --</option>
                        {Array.isArray(displayProducts) ? displayProducts.map((item, i) => item ? <option key={i} value={item.name}>{item.name}</option> : null) : null}
                      </select>
                    )}
                  </div>
                  
                  {/* القائمة السفلية: كل المواد عدا مواد مخزن الانتاج التام */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-3 border-b pb-2">حدد جميع المواد الأولية المطلوبة لصناعة هذا الكابل</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Array.isArray(displayMaterials) ? displayMaterials.map((item, i) => item ? (
                        <div key={i} onClick={() => toggleMaterialSelection(item.name)} className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${selectedMaterialsList.includes(item.name) ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                          <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${selectedMaterialsList.includes(item.name) ? 'bg-blue-500 text-white' : 'bg-slate-200'}`}>{selectedMaterialsList.includes(item.name) && <CheckCircle2 size={14} />}</div>
                          <div className="text-sm font-bold text-slate-700 leading-tight">{item.name}</div>
                        </div>
                      ) : null) : null}
                    </div>
                  </div>

                </div>
              )}
              {bomStep === 2 && (
                <div className="space-y-3">
                  <div className="bg-blue-50 text-blue-800 p-4 rounded-xl flex items-start gap-3 mb-4"><AlertCircle className="shrink-0 mt-0.5" size={20} /><p className="text-sm font-semibold">أدخل الكمية لإنتاج <strong className="text-lg">متر واحد (1m)</strong> فقط من المنتج.</p></div>
                  {Array.isArray(bomItemsConfig) ? bomItemsConfig.map((item, index) => item ? (
                    <div key={index} className="grid grid-cols-12 gap-4 items-center bg-white p-4 rounded-xl border border-slate-200">
                      <div className="col-span-12 md:col-span-5"><div className="font-bold text-slate-800">{item.material_name}</div></div>
                      <div className="col-span-6 md:col-span-4">
                        <label className="text-xs font-bold text-slate-500 block mb-1">الكمية لكل 1 متر</label>
                        <input type="number" step="0.0001" value={item.quantity_per_meter || ''} onChange={e => { const updated = [...bomItemsConfig]; if (updated[index]) updated[index].quantity_per_meter = Number(e.target.value); setBomItemsConfig(updated); }} className="w-full border-2 rounded-lg p-2 text-sm font-bold text-blue-700 text-center outline-none" placeholder="0.00" />
                      </div>
                      <div className="col-span-6 md:col-span-3">
                        <label className="text-xs font-bold text-slate-500 block mb-1">هدر %</label>
                        <input type="number" step="0.1" value={item.waste_percent} onChange={e => { const updated = [...bomItemsConfig]; if (updated[index]) updated[index].waste_percent = Number(e.target.value); setBomItemsConfig(updated); }} className="w-full border-2 rounded-lg p-2 text-sm font-bold text-amber-600 text-center outline-none" />
                      </div>
                    </div>
                  ) : null) : null}
                </div>
              )}
            </div>
            <div className="bg-slate-50 p-5 border-t border-slate-200 flex justify-between shrink-0">
              {bomStep === 1 ? (
                <><button onClick={() => setShowBomModal(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-200 rounded-xl">إلغاء</button><button onClick={proceedToBomFormula} className="px-6 py-2.5 text-sm font-bold bg-blue-600 text-white rounded-xl">التالي</button></>
              ) : (
                <><button onClick={() => setBomStep(1)} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-200 rounded-xl">رجوع</button><button onClick={handleSaveBom} className="px-6 py-2.5 text-sm font-bold bg-emerald-600 text-white rounded-xl">حفظ واعتماد</button></>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}