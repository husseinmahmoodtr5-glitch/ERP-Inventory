import { useEffect, useState, useCallback } from 'react';
import { Factory, Plus, Play, CheckCircle2, Trash2, Package, AlertTriangle, Download, Printer, Search } from 'lucide-react';
import { supabase, ProductionOrder, Item, ProductionMaterial, ProductionScrap, ProductionOutput, OrderStatus } from '@/lib/supabase';
import { fmtMoney, fmtNum, fmtDate, fmtDateTime } from '@/lib/format';
import { exportToCSV, printHTML } from '@/lib/csv';
import { Badge, Button, Modal, Field, Input, Select, Textarea, Spinner, PageHeader, EmptyState } from '@/components/ui';

interface FullOrder extends ProductionOrder {
  materials: (ProductionMaterial & { items: { name: string; unit: string } | null })[];
  scrap: (ProductionScrap & { items: { name: string; unit: string } | null })[];
  outputs: (ProductionOutput & { items: { name: string; unit: string } | null })[];
}

const STATUS_LABEL: Record<OrderStatus, string> = { pending: 'قيد الانتظار', in_progress: 'قيد التنفيذ', completed: 'مكتمل' };
const STATUS_BADGE: Record<OrderStatus, 'amber' | 'blue' | 'green'> = { pending: 'amber', in_progress: 'blue', completed: 'green' };

export default function Production() {
  const [orders, setOrders] = useState<FullOrder[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<FullOrder | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [po, it] = await Promise.all([
      supabase.from('production_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('items').select('*').order('name'),
    ]);
    const orderList = (po.data as ProductionOrder[]) || [];
    const ids = orderList.map((o) => o.id);
    let mats: (ProductionMaterial & { items: { name: string; unit: string } | null })[] = [];
    let scrap: (ProductionScrap & { items: { name: string; unit: string } | null })[] = [];
    let outs: (ProductionOutput & { items: { name: string; unit: string } | null })[] = [];
    if (ids.length) {
      const [m, s, o] = await Promise.all([
        supabase.from('production_materials').select('*, items(name,unit)').in('order_id', ids),
        supabase.from('production_scrap').select('*, items(name,unit)').in('order_id', ids),
        supabase.from('production_outputs').select('*, items(name,unit)').in('order_id', ids),
      ]);
      mats = (m.data as any) || [];
      scrap = (s.data as any) || [];
      outs = (o.data as any) || [];
    }
    const full: FullOrder[] = orderList.map((o) => ({
      ...o,
      materials: mats.filter((x) => x.order_id === o.id),
      scrap: scrap.filter((x) => x.order_id === o.id),
      outputs: outs.filter((x) => x.order_id === o.id),
    }));
    setOrders(full);
    setItems((it.data as Item[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = orders.filter((o) => {
    if (statusFilter && o.status !== statusFilter) return false;
    if (search) return o.order_number.toLowerCase().includes(search.toLowerCase()) || o.product_name.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const startOrder = async (o: FullOrder) => {
    if (o.materials.length === 0) {
      alert('أضف المواد المطلوبة قبل بدء الإنتاج');
      return;
    }
    await supabase.from('production_orders').update({ status: 'in_progress', started_at: new Date().toISOString() }).eq('id', o.id);
    load();
  };

  const deleteOrder = async (o: FullOrder) => {
    if (o.status !== 'pending') {
      alert('لا يمكن حذف أمر إنتاج بدأ أو اكتمل');
      return;
    }
    if (!confirm(`حذف أمر الإنتاج "${o.order_number}"؟`)) return;
    await supabase.from('production_orders').delete().eq('id', o.id);
    load();
  };

  const exportData = () => {
    exportToCSV(
      'أوامر_الإنتاج',
      ['رقم الأمر', 'المنتج', 'الحالة', 'الكمية المخططة', 'إجمالي التكلفة', 'تكلفة الوحدة', 'تاريخ البدء', 'تاريخ الإكمال'],
      filtered.map((o) => [
        o.order_number,
        o.product_name,
        STATUS_LABEL[o.status],
        fmtNum(o.planned_qty, 3),
        fmtMoney(o.total_cost),
        fmtMoney(o.unit_cost),
        fmtDateTime(o.started_at),
        fmtDateTime(o.completed_at),
      ])
    );
  };

  return (
    <>
      <PageHeader
        title="الإنتاج"
        subtitle="أوامر إنتاج · تخصيص مواد · هدر · إخراج تام"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={exportData}><Download size={16} /> CSV</Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}><Plus size={16} /> أمر إنتاج جديد</Button>
          </div>
        }
      />

      <div className="bg-white rounded-2xl ring-1 ring-ink-200 shadow-sm p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <Input placeholder="بحث برقم الأمر أو المنتج..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto">
            <option value="">كل الحالات</option>
            <option value="pending">قيد الانتظار</option>
            <option value="in_progress">قيد التنفيذ</option>
            <option value="completed">مكتمل</option>
          </Select>
        </div>
      </div>

      <div className="bg-white rounded-2xl ring-1 ring-ink-200 shadow-sm overflow-hidden">
        {loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Factory size={26} />} title="لا توجد أوامر إنتاج" hint="ابدأ بإنشاء أمر إنتاج جديد" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-800 text-ink-100 text-xs">
                  <th className="px-4 py-3 text-right font-semibold">رقم الأمر</th>
                  <th className="px-4 py-3 text-right font-semibold">المنتج</th>
                  <th className="px-4 py-3 text-right font-semibold">الحالة</th>
                  <th className="px-4 py-3 text-right font-semibold">الكمية</th>
                  <th className="px-4 py-3 text-right font-semibold">المواد</th>
                  <th className="px-4 py-3 text-right font-semibold">الهدر</th>
                  <th className="px-4 py-3 text-right font-semibold">إجمالي التكلفة</th>
                  <th className="px-4 py-3 text-right font-semibold">تكلفة الوحدة</th>
                  <th className="px-4 py-3 text-right font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-ink-50 transition cursor-pointer" onClick={() => setDetail(o)}>
                    <td className="px-4 py-3 font-bold text-brand-700">{o.order_number}</td>
                    <td className="px-4 py-3 font-medium text-ink-800">{o.product_name}</td>
                    <td className="px-4 py-3"><Badge color={STATUS_BADGE[o.status]}>{STATUS_LABEL[o.status]}</Badge></td>
                    <td className="px-4 py-3 text-ink-700">{fmtNum(o.planned_qty, 3)}</td>
                    <td className="px-4 py-3 text-ink-600">{o.materials.length}</td>
                    <td className="px-4 py-3 text-ink-600">{o.scrap.length}</td>
                    <td className="px-4 py-3 font-semibold text-ink-800">{fmtMoney(o.total_cost)}</td>
                    <td className="px-4 py-3 text-ink-600">{fmtMoney(o.unit_cost)}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {o.status === 'pending' && (
                          <button onClick={() => startOrder(o)} className="p-1.5 rounded-lg text-brand-600 hover:bg-brand-50" title="بدء الإنتاج"><Play size={16} /></button>
                        )}
                        {o.status === 'pending' && (
                          <button onClick={() => deleteOrder(o)} className="p-1.5 rounded-lg text-danger-600 hover:bg-danger-50" title="حذف"><Trash2 size={16} /></button>
                        )}
                        <button onClick={() => setDetail(o)} className="p-1.5 rounded-lg text-ink-500 hover:bg-ink-100" title="تفاصيل"><Package size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateOrderModal open={createOpen} items={items} onClose={() => setCreateOpen(false)} onSaved={load} />
      <OrderDetailModal order={detail} items={items} onClose={() => setDetail(null)} onSaved={load} />
    </>
  );
}

function CreateOrderModal({ open, items, onClose, onSaved }: { open: boolean; items: Item[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ order_number: '', product_name: '', planned_qty: '1', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      const num = `PRD-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      setForm({ order_number: num, product_name: '', planned_qty: '1', notes: '' });
      setError('');
    }
  }, [open]);

  const save = async () => {
    if (!form.order_number.trim() || !form.product_name.trim()) {
      setError('رقم الأمر واسم المنتج مطلوبان');
      return;
    }
    setSaving(true);
    const { error: e } = await supabase.from('production_orders').insert({
      order_number: form.order_number.trim(),
      product_name: form.product_name.trim(),
      planned_qty: parseFloat(form.planned_qty) || 1,
      status: 'pending',
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    onClose();
    onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} title="أمر إنتاج جديد" size="md">
      <div className="space-y-4">
        {error && <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-3 py-2 ring-1 ring-danger-500/20">{error}</div>}
        <Field label="رقم الأمر" required>
          <Input value={form.order_number} onChange={(e) => setForm({ ...form, order_number: e.target.value })} />
        </Field>
        <Field label="اسم المنتج" required>
          <Input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} placeholder="مثال: كرسي مكتب موديل A" autoFocus />
        </Field>
        <Field label="الكمية المخططة">
          <Input type="number" step="0.001" value={form.planned_qty} onChange={(e) => setForm({ ...form, planned_qty: e.target.value })} />
        </Field>
        <Field label="ملاحظات">
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2 pt-2 border-t border-ink-100">
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'إنشاء الأمر'}</Button>
        </div>
      </div>
    </Modal>
  );
}

function OrderDetailModal({
  order,
  items,
  onClose,
  onSaved,
}: {
  order: FullOrder | null;
  items: Item[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<'materials' | 'scrap' | 'outputs'>('materials');
  const [matForm, setMatForm] = useState({ item_id: '', qty: '' });
  const [scrapForm, setScrapForm] = useState({ item_id: '', qty: '', notes: '' });
  const [outForm, setOutForm] = useState({ item_id: '', qty: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (order) {
      setTab('materials');
      setMatForm({ item_id: '', qty: '' });
      setScrapForm({ item_id: '', qty: '', notes: '' });
      setOutForm({ item_id: '', qty: '' });
    }
  }, [order]);

  if (!order) return null;

  const canEdit = order.status !== 'completed';

  const addMaterial = async () => {
    if (!matForm.item_id || !matForm.qty) return;
    const it = items.find((i) => i.id === matForm.item_id)!;
    const qty = parseFloat(matForm.qty);
    if (qty > it.quantity_on_hand) {
      alert(`الكمية المطلوبة (${fmtNum(qty, 3)}) أكبر من المخزون المتاح (${fmtNum(it.quantity_on_hand, 3)})`);
      return;
    }
    setBusy(true);
    // Create stock-out movement (deduct from inventory)
    const { data: mv, error: mve } = await supabase.from('movements').insert({
      item_id: it.id,
      movement_type: 'out',
      qty,
      unit_cost: it.avg_unit_cost,
      batch_lot: null,
      destination: order.order_number,
      production_order_id: order.id,
      notes: `تخصيص للأمر ${order.order_number}`,
      movement_date: new Date().toISOString().slice(0, 10),
    }).select().single();
    if (mve) {
      alert(mve.message);
      setBusy(false);
      return;
    }
    await supabase.from('production_materials').insert({
      order_id: order.id,
      item_id: it.id,
      qty,
      unit_cost: it.avg_unit_cost,
      movement_id: mv.id,
    });
    await recalcOrderCost(order.id);
    setBusy(false);
    setMatForm({ item_id: '', qty: '' });
    onSaved();
  };

  const addScrap = async () => {
    if (!scrapForm.item_id || !scrapForm.qty) return;
    const it = items.find((i) => i.id === scrapForm.item_id)!;
    const qty = parseFloat(scrapForm.qty);
    setBusy(true);
    await supabase.from('production_scrap').insert({
      order_id: order.id,
      item_id: it.id,
      qty,
      unit_cost: it.avg_unit_cost,
      notes: scrapForm.notes.trim() || null,
    });
    await recalcOrderCost(order.id);
    setBusy(false);
    setScrapForm({ item_id: '', qty: '', notes: '' });
    onSaved();
  };

  const completeOrder = async () => {
    if (!outForm.item_id || !outForm.qty) {
      alert('حدد الصنف التام والكمية المنتجة قبل الإكمال');
      return;
    }
    if (!confirm('تأكيد إكمال أمر الإنتاج؟ سيتم إضافة المنتج التام للمخزون وحساب التكلفة النهائية.')) return;
    setBusy(true);
    const it = items.find((i) => i.id === outForm.item_id)!;
    const outQty = parseFloat(outForm.qty);
    // Recalculate final cost
    const [mats, scrap] = await Promise.all([
      supabase.from('production_materials').select('qty,unit_cost').eq('order_id', order.id),
      supabase.from('production_scrap').select('qty,unit_cost').eq('order_id', order.id),
    ]);
    const matCost = ((mats.data as ProductionMaterial[]) || []).reduce((s, m) => s + m.qty * m.unit_cost, 0);
    const scrapCost = ((scrap.data as ProductionScrap[]) || []).reduce((s, m) => s + m.qty * m.unit_cost, 0);
    const totalCost = matCost + scrapCost;
    const unitCost = outQty > 0 ? totalCost / outQty : 0;

    // Push finished goods into inventory (stock-in movement)
    const { data: mv, error: mve } = await supabase.from('movements').insert({
      item_id: it.id,
      movement_type: 'in',
      qty: outQty,
      unit_cost: unitCost,
      batch_lot: order.order_number,
      supplier: `إنتاج داخلي - ${order.order_number}`,
      production_order_id: order.id,
      notes: `إخراج من الإنتاج ${order.order_number}`,
      movement_date: new Date().toISOString().slice(0, 10),
    }).select().single();
    if (mve) {
      alert(mve.message);
      setBusy(false);
      return;
    }
    await supabase.from('production_outputs').insert({
      order_id: order.id,
      item_id: it.id,
      qty: outQty,
      unit_cost: unitCost,
      movement_id: mv.id,
    });
    await supabase.from('production_orders').update({
      status: 'completed',
      total_cost: totalCost,
      unit_cost: unitCost,
      completed_at: new Date().toISOString(),
    }).eq('id', order.id);
    setBusy(false);
    onClose();
    onSaved();
  };

  const matCost = order.materials.reduce((s, m) => s + m.qty * m.unit_cost, 0);
  const scrapCost = order.scrap.reduce((s, m) => s + m.qty * m.unit_cost, 0);

  return (
    <Modal open={!!order} onClose={onClose} title={`أمر إنتاج: ${order.order_number}`} size="xl">
      <div className="space-y-4">
        {/* Header info */}
        <div className="flex flex-wrap items-center gap-3 bg-ink-50 rounded-xl px-4 py-3">
          <div><p className="text-xs text-ink-500">المنتج</p><p className="font-semibold text-ink-800">{order.product_name}</p></div>
          <div className="w-px h-8 bg-ink-200" />
          <div><p className="text-xs text-ink-500">الحالة</p><Badge color={STATUS_BADGE[order.status]}>{STATUS_LABEL[order.status]}</Badge></div>
          <div className="w-px h-8 bg-ink-200" />
          <div><p className="text-xs text-ink-500">الكمية المخططة</p><p className="font-semibold text-ink-800">{fmtNum(order.planned_qty, 3)}</p></div>
          <div className="w-px h-8 bg-ink-200" />
          <div><p className="text-xs text-ink-500">تكلفة المواد</p><p className="font-semibold text-ink-800">{fmtMoney(matCost)}</p></div>
          <div><p className="text-xs text-ink-500">تكلفة الهدر</p><p className="font-semibold text-danger-600">{fmtMoney(scrapCost)}</p></div>
          <div className="w-px h-8 bg-ink-200" />
          <div><p className="text-xs text-ink-500">الإجمالي</p><p className="font-bold text-brand-700">{fmtMoney(matCost + scrapCost)}</p></div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-ink-200">
          {([
            { id: 'materials', label: `المواد المخصصة (${order.materials.length})` },
            { id: 'scrap', label: `الهدر (${order.scrap.length})` },
            { id: 'outputs', label: `الإخراج التام (${order.outputs.length})` },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
                tab === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Materials tab */}
        {tab === 'materials' && (
          <div className="space-y-3">
            {canEdit && (
              <div className="flex gap-2 bg-ink-50 rounded-lg p-3">
                <Select value={matForm.item_id} onChange={(e) => setMatForm({ ...matForm, item_id: e.target.value })} className="flex-1">
                  <option value="">— اختر مادة —</option>
                  {items.filter((i) => i.item_type !== 'finished').map((i) => (
                    <option key={i.id} value={i.id}>{i.name} (متاح: {fmtNum(i.quantity_on_hand, 3)} {i.unit})</option>
                  ))}
                </Select>
                <Input type="number" step="0.001" placeholder="الكمية" value={matForm.qty} onChange={(e) => setMatForm({ ...matForm, qty: e.target.value })} className="w-32" />
                <Button size="sm" onClick={addMaterial} disabled={busy}><Plus size={15} /> إضافة</Button>
              </div>
            )}
            {order.materials.length === 0 ? (
              <p className="text-sm text-ink-400 text-center py-6">لم يتم تخصيص مواد بعد</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="text-ink-500 text-xs"><th className="px-3 py-2 text-right">المادة</th><th className="px-3 py-2 text-right">الكمية</th><th className="px-3 py-2 text-right">التكلفة/وحدة</th><th className="px-3 py-2 text-right">الإجمالي</th></tr></thead>
                <tbody className="divide-y divide-ink-100">
                  {order.materials.map((m) => (
                    <tr key={m.id}><td className="px-3 py-2 text-ink-800">{m.items?.name}</td><td className="px-3 py-2">{fmtNum(m.qty, 3)} {m.items?.unit}</td><td className="px-3 py-2">{fmtMoney(m.unit_cost)}</td><td className="px-3 py-2 font-semibold">{fmtMoney(m.qty * m.unit_cost)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Scrap tab */}
        {tab === 'scrap' && (
          <div className="space-y-3">
            {canEdit && (
              <div className="flex gap-2 bg-ink-50 rounded-lg p-3">
                <Select value={scrapForm.item_id} onChange={(e) => setScrapForm({ ...scrapForm, item_id: e.target.value })} className="flex-1">
                  <option value="">— اختر مادة —</option>
                  {items.map((i) => (<option key={i.id} value={i.id}>{i.name}</option>))}
                </Select>
                <Input type="number" step="0.001" placeholder="الكمية" value={scrapForm.qty} onChange={(e) => setScrapForm({ ...scrapForm, qty: e.target.value })} className="w-32" />
                <Input placeholder="سبب الهدر" value={scrapForm.notes} onChange={(e) => setScrapForm({ ...scrapForm, notes: e.target.value })} className="flex-1" />
                <Button size="sm" variant="danger" onClick={addScrap} disabled={busy}><Plus size={15} /> إضافة</Button>
              </div>
            )}
            {order.scrap.length === 0 ? (
              <p className="text-sm text-ink-400 text-center py-6">لا يوجد هدر مسجل</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="text-ink-500 text-xs"><th className="px-3 py-2 text-right">المادة</th><th className="px-3 py-2 text-right">الكمية</th><th className="px-3 py-2 text-right">التكلفة</th><th className="px-3 py-2 text-right">السبب</th></tr></thead>
                <tbody className="divide-y divide-ink-100">
                  {order.scrap.map((s) => (
                    <tr key={s.id}><td className="px-3 py-2 text-ink-800">{s.items?.name}</td><td className="px-3 py-2 text-danger-600 font-semibold">{fmtNum(s.qty, 3)} {s.items?.unit}</td><td className="px-3 py-2">{fmtMoney(s.qty * s.unit_cost)}</td><td className="px-3 py-2 text-ink-500">{s.notes || '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Outputs / complete tab */}
        {tab === 'outputs' && (
          <div className="space-y-3">
            {order.outputs.length > 0 && (
              <table className="w-full text-sm">
                <thead><tr className="text-ink-500 text-xs"><th className="px-3 py-2 text-right">المنتج التام</th><th className="px-3 py-2 text-right">الكمية</th><th className="px-3 py-2 text-right">تكلفة الوحدة</th><th className="px-3 py-2 text-right">الإجمالي</th></tr></thead>
                <tbody className="divide-y divide-ink-100">
                  {order.outputs.map((o) => (
                    <tr key={o.id}><td className="px-3 py-2 text-ink-800">{o.items?.name}</td><td className="px-3 py-2 font-semibold">{fmtNum(o.qty, 3)} {o.items?.unit}</td><td className="px-3 py-2">{fmtMoney(o.unit_cost)}</td><td className="px-3 py-2 font-semibold text-success-700">{fmtMoney(o.qty * o.unit_cost)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            {canEdit && order.status === 'in_progress' && (
              <div className="bg-success-50 rounded-xl p-4 ring-1 ring-success-500/20">
                <p className="text-sm font-semibold text-success-700 mb-3 flex items-center gap-1.5"><CheckCircle2 size={16} /> إكمال الإنتاج</p>
                <div className="flex gap-2">
                  <Select value={outForm.item_id} onChange={(e) => setOutForm({ ...outForm, item_id: e.target.value })} className="flex-1">
                    <option value="">— اختر المنتج التام —</option>
                    {items.filter((i) => i.item_type === 'finished').map((i) => (<option key={i.id} value={i.id}>{i.name}</option>))}
                  </Select>
                  <Input type="number" step="0.001" placeholder="الكمية المنتجة" value={outForm.qty} onChange={(e) => setOutForm({ ...outForm, qty: e.target.value })} className="w-40" />
                  <Button variant="success" onClick={completeOrder} disabled={busy}><CheckCircle2 size={16} /> إكمال</Button>
                </div>
                <p className="text-xs text-ink-500 mt-2">سيتم حساب التكلفة النهائية (مواد + هدر) وإضافة المنتج التام للمخزون تلقائياً.</p>
              </div>
            )}
            {order.status === 'pending' && (
              <div className="bg-warning-50 rounded-lg px-4 py-3 text-sm text-warning-600 flex items-center gap-2">
                <AlertTriangle size={16} /> يجب بدء الإنتاج أولاً قبل الإكمال
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

async function recalcOrderCost(orderId: string) {
  const [mats, scrap] = await Promise.all([
    supabase.from('production_materials').select('qty,unit_cost').eq('order_id', orderId),
    supabase.from('production_scrap').select('qty,unit_cost').eq('order_id', orderId),
  ]);
  const matCost = ((mats.data as ProductionMaterial[]) || []).reduce((s, m) => s + m.qty * m.unit_cost, 0);
  const scrapCost = ((scrap.data as ProductionScrap[]) || []).reduce((s, m) => s + m.qty * m.unit_cost, 0);
  await supabase.from('production_orders').update({ total_cost: matCost + scrapCost }).eq('id', orderId);
}
