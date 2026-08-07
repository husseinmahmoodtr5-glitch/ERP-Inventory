import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronDown, Folder, FolderOpen, Plus, Package, Pencil, Trash2, Search, MapPin, Layers } from 'lucide-react';
import { supabase, Category, Item, ItemType } from '@/lib/supabase';
import { fmtMoney, fmtNum } from '@/lib/format';
import { Badge, Button, Modal, Field, Input, Select, Textarea, Spinner, PageHeader, EmptyState } from '@/components/ui';

interface TreeNode extends Category {
  children: TreeNode[];
  items: Item[];
  expanded: boolean;
}

const TYPE_LABEL: Record<ItemType, string> = { raw: 'مادة خام', semi: 'نصف مصنّع', finished: 'تام الصنع' };
const TYPE_BADGE: Record<ItemType, 'amber' | 'blue' | 'green'> = { raw: 'amber', semi: 'blue', finished: 'green' };

export default function InventoryTree() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catModal, setCatModal] = useState<{ open: boolean; parent: Category | null; edit: Category | null }>({ open: false, parent: null, edit: null });
  const [itemModal, setItemModal] = useState<{ open: boolean; category: Category | null; edit: Item | null }>({ open: false, category: null, edit: null });

  const load = useCallback(async () => {
    setLoading(true);
    const [cats, items] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('items').select('*').order('name'),
    ]);
    const catList = (cats.data as Category[]) || [];
    const itemList = (items.data as Item[]) || [];
    const map = new Map<string, TreeNode>();
    catList.forEach((c) => map.set(c.id, { ...c, children: [], items: [], expanded: true }));
    const roots: TreeNode[] = [];
    catList.forEach((c) => {
      const node = map.get(c.id)!;
      if (c.parent_id && map.has(c.parent_id)) {
        map.get(c.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    itemList.forEach((it) => {
      if (it.category_id && map.has(it.category_id)) {
        map.get(it.category_id)!.items.push(it);
      }
    });
    setTree(roots);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id: string) => {
    setTree((prev) => {
      const toggleNode = (nodes: TreeNode[]): TreeNode[] =>
        nodes.map((n) => {
          if (n.id === id) return { ...n, expanded: !n.expanded };
          if (n.children.length) return { ...n, children: toggleNode(n.children) };
          return n;
        });
      return toggleNode(prev);
    });
  };

  const deleteCategory = async (c: Category) => {
    if (!confirm(`حذف التصنيف "${c.name}"؟ لا يمكن الحذف إذا كان يحتوي على أصناف.`)) return;
    const { error } = await supabase.from('categories').delete().eq('id', c.id);
    if (error) {
      alert('تعذّر الحذف — تأكد أن التصنيف لا يحتوي على أصناف أو تصنيفات فرعية');
      return;
    }
    load();
  };

  const deleteItem = async (it: Item) => {
    if (!confirm(`حذف الصنف "${it.name}"؟ لا يمكن الحذف إذا كانت هناك حركات مرتبطة.`)) return;
    const { error } = await supabase.from('items').delete().eq('id', it.id);
    if (error) {
      alert('تعذّر الحذف — يوجد حركات مخزون مرتبطة بهذا الصنف');
      return;
    }
    load();
  };

  const matches = (it: Item, q: string) => !q || it.name.toLowerCase().includes(q.toLowerCase()) || (it.sku || '').toLowerCase().includes(q.toLowerCase());

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    const filteredItems = node.items.filter((it) => matches(it, search));
    const hasMatchingChildren = (n: TreeNode): boolean =>
      n.items.some((it) => matches(it, search)) || n.children.some((c) => hasMatchingChildren(c));
    const show = !search || hasMatchingChildren(node);

    if (!show) return null;

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-ink-100 group transition"
          style={{ paddingRight: `${depth * 20 + 8}px` }}
        >
          <button onClick={() => toggle(node.id)} className="p-1 rounded text-ink-400 hover:text-ink-700 hover:bg-ink-200 transition">
            {node.expanded ? <ChevronDown size={16} /> : <ChevronLeft size={16} />}
          </button>
          {node.expanded ? (
            <FolderOpen size={17} className="text-brand-600" />
          ) : (
            <Folder size={17} className="text-brand-600" />
          )}
          <span className="text-sm font-semibold text-ink-800 flex-1">{node.name}</span>
          <span className="text-xs text-ink-400">{node.items.length} صنف</span>
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition">
            <button
              onClick={() => setCatModal({ open: true, parent: node, edit: null })}
              className="p-1 rounded text-ink-500 hover:bg-ink-200 hover:text-brand-600"
              title="إضافة تصنيف فرعي"
            >
              <Plus size={15} />
            </button>
            <button
              onClick={() => setItemModal({ open: true, category: node, edit: null })}
              className="p-1 rounded text-ink-500 hover:bg-ink-200 hover:text-success-600"
              title="إضافة صنف"
            >
              <Package size={15} />
            </button>
            <button
              onClick={() => setCatModal({ open: true, parent: null, edit: node })}
              className="p-1 rounded text-ink-500 hover:bg-ink-200 hover:text-ink-700"
              title="تعديل"
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={() => deleteCategory(node)}
              className="p-1 rounded text-ink-500 hover:bg-ink-200 hover:text-danger-600"
              title="حذف"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {node.expanded && (
          <div>
            {filteredItems.map((it) => (
              <div
                key={it.id}
                className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-brand-50/50 group transition border-r-2 border-transparent hover:border-brand-400"
                style={{ paddingRight: `${depth * 20 + 36}px` }}
              >
                <Package size={15} className="text-ink-400" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink-800 truncate">{it.name}</span>
                    <Badge color={TYPE_BADGE[it.item_type]}>{TYPE_LABEL[it.item_type]}</Badge>
                    {it.min_stock > 0 && it.quantity_on_hand <= it.min_stock && (
                      <Badge color="red">تحت الحد الأدنى</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-ink-500">
                    {it.sku && <span>SKU: {it.sku}</span>}
                    {it.warehouse_location && (
                      <span className="inline-flex items-center gap-0.5"><MapPin size={11} /> {it.warehouse_location}{it.bin_rack ? ` / ${it.bin_rack}` : ''}</span>
                    )}
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-ink-900">{fmtNum(it.quantity_on_hand, 3)} <span className="text-xs font-normal text-ink-500">{it.unit}</span></p>
                  <p className="text-xs text-ink-500">متوسط: {fmtMoney(it.avg_unit_cost)}</p>
                </div>
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition">
                  <button
                    onClick={() => setItemModal({ open: true, category: null, edit: it })}
                    className="p-1 rounded text-ink-500 hover:bg-ink-200 hover:text-ink-700"
                    title="تعديل"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => deleteItem(it)}
                    className="p-1 rounded text-ink-500 hover:bg-ink-200 hover:text-danger-600"
                    title="حذف"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
            {node.children.map((c) => renderNode(c, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="شجرة المخزون"
        subtitle="تصنيفات هرمية للمواد الخام والنصف مصنّعة والتامة"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCatModal({ open: true, parent: null, edit: null })}>
              <Plus size={16} /> تصنيف رئيسي
            </Button>
            <Button size="sm" onClick={() => setItemModal({ open: true, category: null, edit: null })}>
              <Plus size={16} /> صنف جديد
            </Button>
          </div>
        }
      />

      <div className="bg-white rounded-2xl ring-1 ring-ink-200 shadow-sm p-4 mb-4">
        <div className="relative">
          <Search size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input
            placeholder="بحث بالاسم أو رمز الصنف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl ring-1 ring-ink-200 shadow-sm p-3 min-h-[400px]">
        {loading ? (
          <Spinner />
        ) : tree.length === 0 ? (
          <EmptyState icon={<Layers size={26} />} title="لا توجد تصنيفات بعد" hint="ابدأ بإضافة تصنيف رئيسي مثل «مواد خام»" />
        ) : (
          <div className="space-y-0.5">{tree.map((n) => renderNode(n, 0))}</div>
        )}
      </div>

      <CategoryModal state={catModal} onClose={() => setCatModal({ open: false, parent: null, edit: null })} onSaved={load} />
      <ItemModal state={itemModal} onClose={() => setItemModal({ open: false, category: null, edit: null })} onSaved={load} />
    </>
  );
}

function CategoryModal({
  state,
  onClose,
  onSaved,
}: {
  state: { open: boolean; parent: Category | null; edit: Category | null };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (state.open) setName(state.edit?.name || '');
  }, [state.open, state.edit]);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    if (state.edit) {
      await supabase.from('categories').update({ name: name.trim() }).eq('id', state.edit.id);
    } else {
      await supabase.from('categories').insert({ name: name.trim(), parent_id: state.parent?.id || null });
    }
    setSaving(false);
    onClose();
    onSaved();
  };

  return (
    <Modal open={state.open} onClose={onClose} title={state.edit ? 'تعديل تصنيف' : 'تصنيف جديد'} size="md">
      <div className="space-y-4">
        {state.parent && <p className="text-xs text-ink-500 bg-ink-50 rounded-lg px-3 py-2">تحت: {state.parent.name}</p>}
        <Field label="اسم التصنيف" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: مواد خام" autoFocus />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'حفظ'}</Button>
        </div>
      </div>
    </Modal>
  );
}

function ItemModal({
  state,
  onClose,
  onSaved,
}: {
  state: { open: boolean; category: Category | null; edit: Item | null };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    category_id: '' as string,
    item_type: 'raw' as ItemType,
    unit: 'وحدة',
    min_stock: '0',
    warehouse_location: '',
    bin_rack: '',
    baseline_price: '0',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (state.open) {
      supabase.from('categories').select('*').order('name').then(({ data }) => setCategories((data as Category[]) || []));
      if (state.edit) {
        const e = state.edit;
        setForm({
          name: e.name,
          sku: e.sku || '',
          category_id: e.category_id || '',
          item_type: e.item_type,
          unit: e.unit,
          min_stock: String(e.min_stock),
          warehouse_location: e.warehouse_location || '',
          bin_rack: e.bin_rack || '',
          baseline_price: String(e.baseline_price),
        });
      } else {
        setForm({
          name: '',
          sku: '',
          category_id: state.category?.id || '',
          item_type: 'raw',
          unit: 'وحدة',
          min_stock: '0',
          warehouse_location: '',
          bin_rack: '',
          baseline_price: '0',
        });
      }
    }
  }, [state.open, state.edit, state.category]);

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      category_id: form.category_id || null,
      item_type: form.item_type,
      unit: form.unit.trim() || 'وحدة',
      min_stock: parseFloat(form.min_stock) || 0,
      warehouse_location: form.warehouse_location.trim() || null,
      bin_rack: form.bin_rack.trim() || null,
      baseline_price: parseFloat(form.baseline_price) || 0,
    };
    if (state.edit) {
      await supabase.from('items').update(payload).eq('id', state.edit.id);
    } else {
      await supabase.from('items').insert(payload);
    }
    setSaving(false);
    onClose();
    onSaved();
  };

  return (
    <Modal open={state.open} onClose={onClose} title={state.edit ? 'تعديل صنف' : 'صنف جديد'} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="اسم الصنف" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: حديد سلك 6مم" autoFocus />
          </Field>
          <Field label="رمز الصنف (SKU)">
            <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="RAW-001" />
          </Field>
          <Field label="التصنيف">
            <Select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">— بدون تصنيف —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="نوع الصنف">
            <Select value={form.item_type} onChange={(e) => setForm({ ...form, item_type: e.target.value as ItemType })}>
              <option value="raw">مادة خام</option>
              <option value="semi">نصف مصنّع</option>
              <option value="finished">تام الصنع</option>
            </Select>
          </Field>
          <Field label="وحدة القياس">
            <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="كجم / متر / وحدة" />
          </Field>
          <Field label="الحد الأدنى للمخزون">
            <Input type="number" step="0.001" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
          </Field>
          <Field label="الموقع بالمخزن">
            <Input value={form.warehouse_location} onChange={(e) => setForm({ ...form, warehouse_location: e.target.value })} placeholder="مخزن A" />
          </Field>
          <Field label="الرف / البِن">
            <Input value={form.bin_rack} onChange={(e) => setForm({ ...form, bin_rack: e.target.value })} placeholder="R-12" />
          </Field>
          <Field label="سعر الأساس (مرجعي)">
            <Input type="number" step="0.001" value={form.baseline_price} onChange={(e) => setForm({ ...form, baseline_price: e.target.value })} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-ink-100">
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'حفظ الصنف'}</Button>
        </div>
      </div>
    </Modal>
  );
}
