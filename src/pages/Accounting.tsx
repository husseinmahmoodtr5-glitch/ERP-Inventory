import { useEffect, useState, useCallback } from 'react';
import { Calculator, Pencil, History, Wallet, Package, TrendingDown, Layers, Download, Printer } from 'lucide-react';
import { supabase, Item, PriceLog, ProductionOrder } from '@/lib/supabase';
import { fmtMoney, fmtNum, fmtDateTime } from '@/lib/format';
import { exportToCSV, printHTML } from '@/lib/csv';
import { Badge, Button, Modal, Field, Input, Textarea, Spinner, PageHeader, EmptyState } from '@/components/ui';

export default function Accounting() {
  const [items, setItems] = useState<Item[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [logs, setLogs] = useState<(PriceLog & { items: { name: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'valuation' | 'price' | 'costing'>('valuation');
  const [priceModal, setPriceModal] = useState<Item | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [it, po, pl] = await Promise.all([
      supabase.from('items').select('*').order('name'),
      supabase.from('production_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('price_logs').select('*, items(name)').order('created_at', { ascending: false }).limit(100),
    ]);
    setItems((it.data as Item[]) || []);
    setOrders((po.data as ProductionOrder[]) || []);
    setLogs((pl.data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalValue = items.reduce((s, i) => s + i.quantity_on_hand * i.avg_unit_cost, 0);
  const rawValue = items.filter((i) => i.item_type === 'raw').reduce((s, i) => s + i.quantity_on_hand * i.avg_unit_cost, 0);
  const semiValue = items.filter((i) => i.item_type === 'semi').reduce((s, i) => s + i.quantity_on_hand * i.avg_unit_cost, 0);
  const finishedValue = items.filter((i) => i.item_type === 'finished').reduce((s, i) => s + i.quantity_on_hand * i.avg_unit_cost, 0);
  const completedOrders = orders.filter((o) => o.status === 'completed');

  const exportValuation = () => {
    exportToCSV(
      'تقييم_المخزون',
      ['الصنف', 'النوع', 'المخزون', 'متوسط التكلفة', 'القيمة الإجمالية', 'سعر الأساس'],
      items.map((i) => [i.name, i.item_type === 'raw' ? 'مادة خام' : i.item_type === 'semi' ? 'نصف مصنّع' : 'تام', fmtNum(i.quantity_on_hand, 3), fmtMoney(i.avg_unit_cost), fmtMoney(i.quantity_on_hand * i.avg_unit_cost), fmtMoney(i.baseline_price)])
    );
  };

  const exportCosting = () => {
    exportToCSV(
      'تكاليف_الإنتاج',
      ['رقم الأمر', 'المنتج', 'الحالة', 'الكمية', 'إجمالي التكلفة', 'تكلفة الوحدة'],
      orders.map((o) => [o.order_number, o.product_name, o.status === 'completed' ? 'مكتمل' : o.status === 'in_progress' ? 'قيد التنفيذ' : 'قيد الانتظار', fmtNum(o.planned_qty, 3), fmtMoney(o.total_cost), fmtMoney(o.unit_cost)])
    );
  };

  if (loading) {
    return (
      <>
        <PageHeader title="المحاسبة والتكاليف" />
        <Spinner />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="المحاسبة والتكاليف"
        subtitle="تقييم المخزون · إدارة الأسعار · تكاليف الإنتاج"
        action={
          tab === 'valuation' ? (
            <Button variant="secondary" size="sm" onClick={exportValuation}><Download size={16} /> تصدير</Button>
          ) : tab === 'costing' ? (
            <Button variant="secondary" size="sm" onClick={exportCosting}><Download size={16} /> تصدير</Button>
          ) : null
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'إجمالي قيمة المخزون', value: fmtMoney(totalValue), icon: Wallet, color: 'brand' },
          { label: 'قيمة المواد الخام', value: fmtMoney(rawValue), icon: Layers, color: 'amber' },
          { label: 'قيمة النصف مصنّعة', value: fmtMoney(semiValue), icon: Calculator, color: 'slate' },
          { label: 'قيمة البضائع التامة', value: fmtMoney(finishedValue), icon: Package, color: 'success' },
        ].map((c) => {
          const Icon = c.icon;
          const colors: Record<string, string> = {
            brand: 'from-brand-500 to-brand-700',
            success: 'from-success-500 to-success-700',
            amber: 'from-accent-500 to-accent-600',
            slate: 'from-ink-600 to-ink-800',
          };
          return (
            <div key={c.label} className="bg-white rounded-2xl ring-1 ring-ink-200 p-5 shadow-sm">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[c.color]} flex items-center justify-center mb-3 shadow-md`}>
                <Icon size={20} className="text-white" />
              </div>
              <p className="text-xs font-semibold text-ink-500 mb-1">{c.label}</p>
              <p className="text-xl font-bold text-ink-900">{c.value}</p>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-ink-200">
        {([
          { id: 'valuation', label: 'تقييم المخزون' },
          { id: 'price', label: 'إدارة الأسعار وسجل التغييرات' },
          { id: 'costing', label: 'تكاليف أوامر الإنتاج' },
        ] as const).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${tab === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Valuation tab */}
      {tab === 'valuation' && (
        <div className="bg-white rounded-2xl ring-1 ring-ink-200 shadow-sm overflow-hidden">
          {items.length === 0 ? (
            <EmptyState icon={<Wallet size={26} />} title="لا توجد أصناف" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-ink-800 text-ink-100 text-xs">
                    <th className="px-4 py-3 text-right font-semibold">الصنف</th>
                    <th className="px-4 py-3 text-right font-semibold">النوع</th>
                    <th className="px-4 py-3 text-right font-semibold">المخزون</th>
                    <th className="px-4 py-3 text-right font-semibold">متوسط التكلفة (WAC)</th>
                    <th className="px-4 py-3 text-right font-semibold">القيمة الإجمالية</th>
                    <th className="px-4 py-3 text-right font-semibold">سعر الأساس</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {items.map((i) => (
                    <tr key={i.id} className="hover:bg-ink-50 transition">
                      <td className="px-4 py-2.5 font-medium text-ink-800">{i.name}</td>
                      <td className="px-4 py-2.5"><Badge color={i.item_type === 'raw' ? 'amber' : i.item_type === 'semi' ? 'blue' : 'green'}>{i.item_type === 'raw' ? 'خام' : i.item_type === 'semi' ? 'نصف' : 'تام'}</Badge></td>
                      <td className="px-4 py-2.5 text-ink-700">{fmtNum(i.quantity_on_hand, 3)} {i.unit}</td>
                      <td className="px-4 py-2.5 text-ink-600">{fmtMoney(i.avg_unit_cost)}</td>
                      <td className="px-4 py-2.5 font-bold text-ink-900">{fmtMoney(i.quantity_on_hand * i.avg_unit_cost)}</td>
                      <td className="px-4 py-2.5 text-ink-500">{fmtMoney(i.baseline_price)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-ink-50 font-bold text-ink-900">
                    <td className="px-4 py-3" colSpan={4}>الإجمالي</td>
                    <td className="px-4 py-3">{fmtMoney(totalValue)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Price management tab */}
      {tab === 'price' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl ring-1 ring-ink-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-200 flex items-center gap-2">
              <Pencil size={18} className="text-brand-600" />
              <h3 className="font-bold text-ink-900 text-sm">تعديل أسعار الأصناف</h3>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-sm text-ink-400 text-center py-8">لا توجد أصناف</p>
              ) : (
                <div className="divide-y divide-ink-100">
                  {items.map((i) => (
                    <div key={i.id} className="flex items-center justify-between px-4 py-3 hover:bg-ink-50 transition">
                      <div>
                        <p className="text-sm font-medium text-ink-800">{i.name}</p>
                        <p className="text-xs text-ink-500">سعر الأساس الحالي: {fmtMoney(i.baseline_price)}</p>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => setPriceModal(i)}><Pencil size={14} /> تعديل</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl ring-1 ring-ink-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-200 flex items-center gap-2">
              <History size={18} className="text-ink-600" />
              <h3 className="font-bold text-ink-900 text-sm">سجل تغييرات الأسعار</h3>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-sm text-ink-400 text-center py-8">لا توجد تغييرات مسجلة</p>
              ) : (
                <div className="divide-y divide-ink-100">
                  {logs.map((l) => (
                    <div key={l.id} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-ink-800">{l.items?.name || '—'}</p>
                        <span className="text-xs text-ink-400">{fmtDateTime(l.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs">
                        <span className="text-ink-500">{fmtMoney(l.old_price)}</span>
                        <span className="text-ink-400">←</span>
                        <span className="text-success-700 font-semibold">{fmtMoney(l.new_price)}</span>
                        {l.reason && <span className="text-ink-400 mr-auto">({l.reason})</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Costing tab */}
      {tab === 'costing' && (
        <div className="bg-white rounded-2xl ring-1 ring-ink-200 shadow-sm overflow-hidden">
          {orders.length === 0 ? (
            <EmptyState icon={<TrendingDown size={26} />} title="لا توجد أوامر إنتاج" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-ink-800 text-ink-100 text-xs">
                    <th className="px-4 py-3 text-right font-semibold">رقم الأمر</th>
                    <th className="px-4 py-3 text-right font-semibold">المنتج</th>
                    <th className="px-4 py-3 text-right font-semibold">الحالة</th>
                    <th className="px-4 py-3 text-right font-semibold">الكمية</th>
                    <th className="px-4 py-3 text-right font-semibold">إجمالي التكلفة</th>
                    <th className="px-4 py-3 text-right font-semibold">تكلفة الوحدة</th>
                    <th className="px-4 py-3 text-right font-semibold">تاريخ الإكمال</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-ink-50 transition">
                      <td className="px-4 py-2.5 font-bold text-brand-700">{o.order_number}</td>
                      <td className="px-4 py-2.5 font-medium text-ink-800">{o.product_name}</td>
                      <td className="px-4 py-2.5"><Badge color={o.status === 'completed' ? 'green' : o.status === 'in_progress' ? 'blue' : 'amber'}>{o.status === 'completed' ? 'مكتمل' : o.status === 'in_progress' ? 'قيد التنفيذ' : 'قيد الانتظار'}</Badge></td>
                      <td className="px-4 py-2.5 text-ink-700">{fmtNum(o.planned_qty, 3)}</td>
                      <td className="px-4 py-2.5 font-semibold text-ink-900">{fmtMoney(o.total_cost)}</td>
                      <td className="px-4 py-2.5 text-ink-600">{fmtMoney(o.unit_cost)}</td>
                      <td className="px-4 py-2.5 text-ink-500">{fmtDateTime(o.completed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <PriceModal item={priceModal} onClose={() => setPriceModal(null)} onSaved={load} />
    </>
  );
}

function PriceModal({ item, onClose, onSaved }: { item: Item | null; onClose: () => void; onSaved: () => void }) {
  const [newPrice, setNewPrice] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setNewPrice(String(item.baseline_price));
      setReason('');
    }
  }, [item]);

  if (!item) return null;

  const save = async () => {
    const price = parseFloat(newPrice);
    if (isNaN(price)) return;
    setSaving(true);
    await supabase.from('price_logs').insert({
      item_id: item.id,
      old_price: item.baseline_price,
      new_price: price,
      reason: reason.trim() || null,
    });
    await supabase.from('items').update({ baseline_price: price }).eq('id', item.id);
    setSaving(false);
    onClose();
    onSaved();
  };

  return (
    <Modal open={!!item} onClose={onClose} title="تعديل سعر الأساس" size="md">
      <div className="space-y-4">
        <div className="bg-ink-50 rounded-lg px-3 py-2 text-sm">
          <p className="font-semibold text-ink-800">{item.name}</p>
          <p className="text-xs text-ink-500 mt-0.5">السعر الحالي: {fmtMoney(item.baseline_price)}</p>
        </div>
        <Field label="السعر الجديد" required>
          <Input type="number" step="0.001" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} autoFocus />
        </Field>
        <Field label="سبب التغيير">
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثال: زيادة سعر المورّد" />
        </Field>
        <div className="flex justify-end gap-2 pt-2 border-t border-ink-100">
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'حفظ التغيير'}</Button>
        </div>
      </div>
    </Modal>
  );
}
