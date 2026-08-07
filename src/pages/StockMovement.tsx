import { useEffect, useState, useCallback } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Plus, Search, Download, Printer, ArrowLeftRight } from 'lucide-react';
import { supabase, Item, Movement, MovementType } from '@/lib/supabase';
import { fmtMoney, fmtNum, fmtDate } from '@/lib/format';
import { exportToCSV, printHTML } from '@/lib/csv';
import { Badge, Button, Modal, Field, Input, Select, Textarea, Spinner, PageHeader, EmptyState } from '@/components/ui';

interface Row extends Movement {
  items: { name: string; unit: string } | null;
}

export default function StockMovement() {
  const [rows, setRows] = useState<Row[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [modal, setModal] = useState<{ open: boolean; type: MovementType }>({ open: false, type: 'in' });

  const load = useCallback(async () => {
    setLoading(true);
    const [mv, it] = await Promise.all([
      supabase.from('movements').select('*, items(name,unit)').order('created_at', { ascending: false }).limit(500),
      supabase.from('items').select('*').order('name'),
    ]);
    setRows((mv.data as Row[]) || []);
    setItems((it.data as Item[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rows.filter((r) => {
    if (typeFilter && r.movement_type !== typeFilter) return false;
    if (search) {
      const name = r.items?.name || '';
      return name.toLowerCase().includes(search.toLowerCase()) || (r.batch_lot || '').toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const exportData = () => {
    exportToCSV(
      'حركات_المخزون',
      ['التاريخ', 'الصنف', 'النوع', 'الكمية', 'التكلفة', 'الدفعة', 'المورد/الوجهة', 'ملاحظات'],
      filtered.map((r) => [
        fmtDate(r.movement_date),
        r.items?.name || '—',
        r.movement_type === 'in' ? 'وارد' : r.movement_type === 'out' ? 'صادر' : 'تسوية',
        fmtNum(r.qty, 3),
        fmtMoney(r.unit_cost),
        r.batch_lot || '',
        r.supplier || r.destination || '',
        r.notes || '',
      ])
    );
  };

  const printData = () => {
    printHTML(
      'تقرير حركات المخزون',
      ['التاريخ', 'الصنف', 'النوع', 'الكمية', 'التكلفة', 'الدفعة', 'المورد/الوجهة'],
      filtered.map((r) => [
        fmtDate(r.movement_date),
        r.items?.name || '—',
        r.movement_type === 'in' ? 'وارد' : r.movement_type === 'out' ? 'صادر' : 'تسوية',
        fmtNum(r.qty, 3),
        fmtMoney(r.unit_cost),
        r.batch_lot || '',
        r.supplier || r.destination || '',
      ])
    );
  };

  return (
    <>
      <PageHeader
        title="حركة المخزون"
        subtitle="وارد / صادر مع حساب المتوسط المرجح تلقائياً"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={exportData}><Download size={16} /> CSV</Button>
            <Button variant="secondary" size="sm" onClick={printData}><Printer size={16} /> طباعة</Button>
            <Button variant="success" size="sm" onClick={() => setModal({ open: true, type: 'in' })}><ArrowDownToLine size={16} /> وارد</Button>
            <Button variant="danger" size="sm" onClick={() => setModal({ open: true, type: 'out' })}><ArrowUpFromLine size={16} /> صادر</Button>
          </div>
        }
      />

      <div className="bg-white rounded-2xl ring-1 ring-ink-200 shadow-sm p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <Input placeholder="بحث بالصنف أو رقم الدفعة..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
          </div>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-auto">
            <option value="">كل الأنواع</option>
            <option value="in">وارد فقط</option>
            <option value="out">صادر فقط</option>
            <option value="adjust">تسوية فقط</option>
          </Select>
        </div>
      </div>

      <div className="bg-white rounded-2xl ring-1 ring-ink-200 shadow-sm overflow-hidden">
        {loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<ArrowLeftRight size={26} />} title="لا توجد حركات" hint="ابدأ بتسجيل وارد أو صادر" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-800 text-ink-100 text-xs">
                  <th className="px-4 py-3 text-right font-semibold">التاريخ</th>
                  <th className="px-4 py-3 text-right font-semibold">الصنف</th>
                  <th className="px-4 py-3 text-right font-semibold">النوع</th>
                  <th className="px-4 py-3 text-right font-semibold">الكمية</th>
                  <th className="px-4 py-3 text-right font-semibold">التكلفة/وحدة</th>
                  <th className="px-4 py-3 text-right font-semibold">القيمة</th>
                  <th className="px-4 py-3 text-right font-semibold">الدفعة</th>
                  <th className="px-4 py-3 text-right font-semibold">المورد / الوجهة</th>
                  <th className="px-4 py-3 text-right font-semibold">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-ink-50 transition">
                    <td className="px-4 py-2.5 text-ink-600 whitespace-nowrap">{fmtDate(r.movement_date)}</td>
                    <td className="px-4 py-2.5 font-medium text-ink-800">{r.items?.name || '—'}</td>
                    <td className="px-4 py-2.5">
                      {r.movement_type === 'in' && <Badge color="green">وارد</Badge>}
                      {r.movement_type === 'out' && <Badge color="red">صادر</Badge>}
                      {r.movement_type === 'adjust' && <Badge color="amber">تسوية</Badge>}
                    </td>
                    <td className="px-4 py-2.5 text-ink-700 font-semibold">{fmtNum(r.qty, 3)} {r.items?.unit}</td>
                    <td className="px-4 py-2.5 text-ink-600">{fmtMoney(r.unit_cost)}</td>
                    <td className="px-4 py-2.5 text-ink-700 font-semibold">{fmtMoney(r.qty * r.unit_cost)}</td>
                    <td className="px-4 py-2.5 text-ink-500">{r.batch_lot || '—'}</td>
                    <td className="px-4 py-2.5 text-ink-500">{r.supplier || r.destination || '—'}</td>
                    <td className="px-4 py-2.5 text-ink-500 max-w-[200px] truncate">{r.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MovementModal modal={modal} items={items} onClose={() => setModal({ open: false, type: 'in' })} onSaved={load} />
    </>
  );
}

function MovementModal({
  modal,
  items,
  onClose,
  onSaved,
}: {
  modal: { open: boolean; type: MovementType };
  items: Item[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    item_id: '',
    qty: '',
    unit_cost: '',
    batch_lot: '',
    supplier: '',
    destination: '',
    movement_date: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (modal.open) {
      setForm({
        item_id: '',
        qty: '',
        unit_cost: '',
        batch_lot: '',
        supplier: '',
        destination: '',
        movement_date: new Date().toISOString().slice(0, 10),
        notes: '',
      });
      setError('');
    }
  }, [modal.open, modal.type]);

  const selectedItem = items.find((i) => i.id === form.item_id);

  const save = async () => {
    if (!form.item_id || !form.qty) {
      setError('يرجى اختيار الصنف وإدخال الكمية');
      return;
    }
    const qty = parseFloat(form.qty);
    if (qty <= 0) {
      setError('الكمية يجب أن تكون أكبر من صفر');
      return;
    }
    if (modal.type === 'out') {
      if (selectedItem && qty > selectedItem.quantity_on_hand) {
        setError(`الكمية المطلوبة (${fmtNum(qty, 3)}) أكبر من المخزون المتاح (${fmtNum(selectedItem.quantity_on_hand, 3)})`);
        return;
      }
    }
    setSaving(true);
    setError('');
    const unit_cost = modal.type === 'in' ? parseFloat(form.unit_cost) || 0 : 0;
    const { error: e } = await supabase.from('movements').insert({
      item_id: form.item_id,
      movement_type: modal.type,
      qty,
      unit_cost,
      batch_lot: form.batch_lot.trim() || null,
      supplier: modal.type === 'in' ? form.supplier.trim() || null : null,
      destination: modal.type === 'out' ? form.destination.trim() || null : null,
      movement_date: form.movement_date,
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

  const isOut = modal.type === 'out';

  return (
    <Modal open={modal.open} onClose={onClose} title={isOut ? 'إخراج من المخزون' : 'إدخال للمخزون'} size="lg">
      <div className="space-y-4">
        {error && (
          <div className="bg-danger-50 text-danger-700 text-sm rounded-lg px-3 py-2 ring-1 ring-danger-500/20">{error}</div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="الصنف" required>
            <Select value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value })}>
              <option value="">— اختر الصنف —</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} {i.sku ? `(${i.sku})` : ''} — متاح: {fmtNum(i.quantity_on_hand, 3)} {i.unit}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="التاريخ" required>
            <Input type="date" value={form.movement_date} onChange={(e) => setForm({ ...form, movement_date: e.target.value })} />
          </Field>
          <Field label="الكمية" required>
            <Input type="number" step="0.001" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} placeholder="0" autoFocus />
          </Field>
          {!isOut && (
            <Field label="سعر الوحدة" required>
              <Input type="number" step="0.001" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} placeholder="0.00" />
            </Field>
          )}
          <Field label="رقم الدفعة / اللوط">
            <Input value={form.batch_lot} onChange={(e) => setForm({ ...form, batch_lot: e.target.value })} placeholder="LOT-2024-001" />
          </Field>
          {isOut ? (
            <Field label="الوجهة / أمر الإنتاج">
              <Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder="إلى خط الإنتاج" />
            </Field>
          ) : (
            <Field label="المورّد">
              <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="اسم المورّد" />
            </Field>
          )}
        </div>
        <Field label="ملاحظات">
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="ملاحظات إضافية..." />
        </Field>
        {selectedItem && (
          <div className="bg-ink-50 rounded-lg px-3 py-2 text-xs text-ink-600 flex items-center justify-between">
            <span>المخزون الحالي: <strong>{fmtNum(selectedItem.quantity_on_hand, 3)} {selectedItem.unit}</strong></span>
            <span>متوسط التكلفة: <strong>{fmtMoney(selectedItem.avg_unit_cost)}</strong></span>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-ink-100">
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button variant={isOut ? 'danger' : 'success'} onClick={save} disabled={saving}>{saving ? 'جارٍ الحفظ...' : isOut ? 'تأكيد الإخراج' : 'تأكيد الإدخال'}</Button>
        </div>
      </div>
    </Modal>
  );
}
