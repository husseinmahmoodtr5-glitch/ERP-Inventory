import { useEffect, useState } from 'react';
import { Wallet, Package, AlertTriangle, Factory, TrendingDown, Layers, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight } from 'lucide-react';
import { supabase, Item, ProductionOrder } from '@/lib/supabase';
import { fmtMoney, fmtNum, fmtDate } from '@/lib/format';
import { Badge, Spinner, PageHeader } from '@/components/ui';

interface Metrics {
  totalInventoryValue: number;
  totalFinishedValue: number;
  rawValue: number;
  semiValue: number;
  todayConsumption: number;
  lowStock: Item[];
  activeOrders: ProductionOrder[];
  recentMovements: { id: string; item_name: string; type: string; qty: number; date: string }[];
}

export default function Dashboard() {
  const [m, setM] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [items, orders, movements] = await Promise.all([
        supabase.from('items').select('*'),
        supabase.from('production_orders').select('*').order('created_at', { ascending: false }).limit(5),
        supabase
          .from('movements')
          .select('id, item_id, movement_type, qty, movement_date, items!inner(name)')
          .order('created_at', { ascending: false })
          .limit(8),
      ]);

      const itemList = (items.data as Item[]) || [];
      const totalInventoryValue = itemList.reduce((s, i) => s + i.quantity_on_hand * i.avg_unit_cost, 0);
      const byType = (t: string) => itemList.filter((i) => i.item_type === t);
      const totalFinishedValue = byType('finished').reduce((s, i) => s + i.quantity_on_hand * i.avg_unit_cost, 0);
      const rawValue = byType('raw').reduce((s, i) => s + i.quantity_on_hand * i.avg_unit_cost, 0);
      const semiValue = byType('semi').reduce((s, i) => s + i.quantity_on_hand * i.avg_unit_cost, 0);
      const lowStock = itemList.filter((i) => i.min_stock > 0 && i.quantity_on_hand <= i.min_stock);

      const today = new Date().toISOString().slice(0, 10);
      const todayConsumption = ((movements.data as MovementRow[]) || [])
        .filter((mv) => mv.movement_type === 'out' && mv.movement_date === today)
        .reduce((s, mv) => s + mv.qty * 0, 0);

      const recentMovements = ((movements.data as MovementRow[]) || []).map((mv) => ({
        id: mv.id,
        item_name: (mv.items as any)?.name || '—',
        type: mv.movement_type,
        qty: mv.qty,
        date: mv.movement_date,
      }));

      setM({
        totalInventoryValue,
        totalFinishedValue,
        rawValue,
        semiValue,
        todayConsumption,
        lowStock,
        activeOrders: (orders.data as ProductionOrder[]) || [],
        recentMovements,
      });
      setLoading(false);
    })();
  }, []);

  if (loading || !m) {
    return (
      <>
        <PageHeader title="لوحة التحكم" subtitle="نظرة مالية وإنتاجية شاملة" />
        <Spinner />
      </>
    );
  }

  const cards = [
    { label: 'إجمالي قيمة المخزون', value: fmtMoney(m.totalInventoryValue), icon: Wallet, color: 'brand' },
    { label: 'قيمة البضائع التامة', value: fmtMoney(m.totalFinishedValue), icon: Package, color: 'success' },
    { label: 'قيمة المواد الخام', value: fmtMoney(m.rawValue), icon: Layers, color: 'amber' },
    { label: 'تكلفة استهلاك اليوم', value: fmtMoney(m.todayConsumption), icon: TrendingDown, color: 'slate' },
  ];

  return (
    <>
      <PageHeader title="لوحة التحكم" subtitle="نظرة مالية وإنتاجية شاملة" />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {cards.map((c) => {
          const Icon = c.icon;
          const colors: Record<string, string> = {
            brand: 'from-brand-500 to-brand-700',
            success: 'from-success-500 to-success-700',
            amber: 'from-accent-500 to-accent-600',
            slate: 'from-ink-600 to-ink-800',
          };
          return (
            <div key={c.label} className="bg-white rounded-2xl ring-1 ring-ink-200 p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${colors[c.color]} flex items-center justify-center shadow-md`}>
                  <Icon size={22} className="text-white" />
                </div>
              </div>
              <p className="text-xs font-semibold text-ink-500 mb-1">{c.label}</p>
              <p className="text-2xl font-bold text-ink-900 tracking-tight">{c.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Low stock alerts */}
        <div className="bg-white rounded-2xl ring-1 ring-ink-200 shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-ink-200">
            <AlertTriangle size={18} className="text-warning-600" />
            <h3 className="font-bold text-ink-900 text-sm">تنبيهات الحد الأدنى للمخزون</h3>
            <Badge color="red">{m.lowStock.length}</Badge>
          </div>
          <div className="p-3 max-h-80 overflow-y-auto">
            {m.lowStock.length === 0 ? (
              <p className="text-sm text-ink-400 text-center py-8">لا توجد تنبيهات — كل المواد ضمن الحد الآمن</p>
            ) : (
              <div className="space-y-2">
                {m.lowStock.map((i) => (
                  <div key={i.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-danger-50 ring-1 ring-danger-500/10">
                    <div>
                      <p className="text-sm font-semibold text-ink-800">{i.name}</p>
                      <p className="text-xs text-ink-500">الحد الأدنى: {fmtNum(i.min_stock, 3)} {i.unit}</p>
                    </div>
                    <Badge color="red">{fmtNum(i.quantity_on_hand, 3)} {i.unit}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Active production orders */}
        <div className="bg-white rounded-2xl ring-1 ring-ink-200 shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-ink-200">
            <Factory size={18} className="text-brand-600" />
            <h3 className="font-bold text-ink-900 text-sm">أوامر الإنتاج الأخيرة</h3>
          </div>
          <div className="p-3 max-h-80 overflow-y-auto">
            {m.activeOrders.length === 0 ? (
              <p className="text-sm text-ink-400 text-center py-8">لا توجد أوامر إنتاج بعد</p>
            ) : (
              <div className="space-y-2">
                {m.activeOrders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-ink-50 hover:bg-ink-100 transition">
                    <div>
                      <p className="text-sm font-semibold text-ink-800">{o.order_number}</p>
                      <p className="text-xs text-ink-500">{o.product_name}</p>
                    </div>
                    <Badge color={o.status === 'completed' ? 'green' : o.status === 'in_progress' ? 'blue' : 'amber'}>
                      {o.status === 'completed' ? 'مكتمل' : o.status === 'in_progress' ? 'قيد التنفيذ' : 'قيد الانتظار'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent movements */}
      <div className="bg-white rounded-2xl ring-1 ring-ink-200 shadow-sm mt-5">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-ink-200">
          <ArrowLeftRight size={18} className="text-ink-600" />
          <h3 className="font-bold text-ink-900 text-sm">أحدث حركات المخزون</h3>
        </div>
        <div className="overflow-x-auto">
          {m.recentMovements.length === 0 ? (
            <p className="text-sm text-ink-400 text-center py-8">لا توجد حركات بعد</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50 text-ink-600 text-xs">
                  <th className="px-5 py-2.5 text-right font-semibold">الصنف</th>
                  <th className="px-5 py-2.5 text-right font-semibold">النوع</th>
                  <th className="px-5 py-2.5 text-right font-semibold">الكمية</th>
                  <th className="px-5 py-2.5 text-right font-semibold">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {m.recentMovements.map((mv) => (
                  <tr key={mv.id} className="hover:bg-ink-50 transition">
                    <td className="px-5 py-2.5 font-medium text-ink-800">{mv.item_name}</td>
                    <td className="px-5 py-2.5">
                      {mv.type === 'in' ? (
                        <span className="inline-flex items-center gap-1 text-success-600 font-semibold"><ArrowDownToLine size={14} /> وارد</span>
                      ) : mv.type === 'out' ? (
                        <span className="inline-flex items-center gap-1 text-danger-600 font-semibold"><ArrowUpFromLine size={14} /> صادر</span>
                      ) : (
                        <span className="text-ink-500 font-semibold">تسوية</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-ink-700">{fmtNum(mv.qty, 3)}</td>
                    <td className="px-5 py-2.5 text-ink-500">{fmtDate(mv.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

interface MovementRow {
  id: string;
  movement_type: string;
  qty: number;
  movement_date: string;
  items: { name: string } | { name: string }[] | null;
}
