import { useEffect, useState, useCallback } from 'react';
import { FileBarChart, Download, Printer, FileText, Boxes, ArrowLeftRight, Factory, Wallet } from 'lucide-react';
import { supabase, Item, Movement, ProductionOrder } from '@/lib/supabase';
import { fmtMoney, fmtNum, fmtDate, fmtDateTime } from '@/lib/format';
import { exportToCSV, printHTML } from '@/lib/csv';
import { Button, Spinner, PageHeader, EmptyState, Badge } from '@/components/ui';

interface ReportData {
  items: Item[];
  movements: (Movement & { items: { name: string; unit: string } | null })[];
  orders: ProductionOrder[];
}

export default function Reports() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [it, mv, po] = await Promise.all([
      supabase.from('items').select('*').order('name'),
      supabase.from('movements').select('*, items(name,unit)').order('created_at', { ascending: false }).limit(1000),
      supabase.from('production_orders').select('*').order('created_at', { ascending: false }),
    ]);
    setData({
      items: (it.data as Item[]) || [],
      movements: (mv.data as any) || [],
      orders: (po.data as ProductionOrder[]) || [],
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !data) {
    return (
      <>
        <PageHeader title="التقارير" subtitle="تصدير وطباعة بيانات النظام" />
        <Spinner />
      </>
    );
  }

  const totalValue = data.items.reduce((s, i) => s + i.quantity_on_hand * i.avg_unit_cost, 0);

  const reportCards = [
    {
      title: 'حالة المخزون',
      desc: 'كميات وقيمة كل صنف مع موقع التخزين',
      icon: Boxes,
      color: 'brand',
      count: data.items.length,
      onCSV: () =>
        exportToCSV(
          'حالة_المخزون',
          ['الصنف', 'SKU', 'النوع', 'الوحدة', 'المخزون', 'الحد الأدنى', 'متوسط التكلفة', 'القيمة', 'المخزن', 'الرف'],
          data.items.map((i) => [
            i.name,
            i.sku || '',
            i.item_type === 'raw' ? 'مادة خام' : i.item_type === 'semi' ? 'نصف مصنّع' : 'تام الصنع',
            i.unit,
            fmtNum(i.quantity_on_hand, 3),
            fmtNum(i.min_stock, 3),
            fmtMoney(i.avg_unit_cost),
            fmtMoney(i.quantity_on_hand * i.avg_unit_cost),
            i.warehouse_location || '',
            i.bin_rack || '',
          ])
        ),
      onPrint: () =>
        printHTML(
          'تقرير حالة المخزون',
          ['الصنف', 'النوع', 'المخزون', 'متوسط التكلفة', 'القيمة', 'الموقع'],
          data.items.map((i) => [
            i.name,
            i.item_type === 'raw' ? 'خام' : i.item_type === 'semi' ? 'نصف' : 'تام',
            `${fmtNum(i.quantity_on_hand, 3)} ${i.unit}`,
            fmtMoney(i.avg_unit_cost),
            fmtMoney(i.quantity_on_hand * i.avg_unit_cost),
            `${i.warehouse_location || '—'} / ${i.bin_rack || '—'}`,
          ])
        ),
    },
    {
      title: 'حركات المخزون',
      desc: 'سجل الوارد والصادر مع التواريخ والدفعات',
      icon: ArrowLeftRight,
      color: 'amber',
      count: data.movements.length,
      onCSV: () =>
        exportToCSV(
          'حركات_المخزون',
          ['التاريخ', 'الصنف', 'النوع', 'الكمية', 'التكلفة/وحدة', 'القيمة', 'الدفعة', 'المورد/الوجهة', 'ملاحظات'],
          data.movements.map((m) => [
            fmtDate(m.movement_date),
            m.items?.name || '—',
            m.movement_type === 'in' ? 'وارد' : m.movement_type === 'out' ? 'صادر' : 'تسوية',
            fmtNum(m.qty, 3),
            fmtMoney(m.unit_cost),
            fmtMoney(m.qty * m.unit_cost),
            m.batch_lot || '',
            m.supplier || m.destination || '',
            m.notes || '',
          ])
        ),
      onPrint: () =>
        printHTML(
          'تقرير حركات المخزون',
          ['التاريخ', 'الصنف', 'النوع', 'الكمية', 'القيمة', 'الدفعة'],
          data.movements.map((m) => [
            fmtDate(m.movement_date),
            m.items?.name || '—',
            m.movement_type === 'in' ? 'وارد' : m.movement_type === 'out' ? 'صادر' : 'تسوية',
            `${fmtNum(m.qty, 3)} ${m.items?.unit || ''}`,
            fmtMoney(m.qty * m.unit_cost),
            m.batch_lot || '—',
          ])
        ),
    },
    {
      title: 'تكاليف أوامر الإنتاج',
      desc: 'تكلفة المواد والهدر والتكلفة النهائية لكل أمر',
      icon: Factory,
      color: 'success',
      count: data.orders.length,
      onCSV: () =>
        exportToCSV(
          'تكاليف_الإنتاج',
          ['رقم الأمر', 'المنتج', 'الحالة', 'الكمية', 'إجمالي التكلفة', 'تكلفة الوحدة', 'تاريخ البدء', 'تاريخ الإكمال'],
          data.orders.map((o) => [
            o.order_number,
            o.product_name,
            o.status === 'completed' ? 'مكتمل' : o.status === 'in_progress' ? 'قيد التنفيذ' : 'قيد الانتظار',
            fmtNum(o.planned_qty, 3),
            fmtMoney(o.total_cost),
            fmtMoney(o.unit_cost),
            fmtDateTime(o.started_at),
            fmtDateTime(o.completed_at),
          ])
        ),
      onPrint: () =>
        printHTML(
          'تقرير تكاليف الإنتاج',
          ['رقم الأمر', 'المنتج', 'الحالة', 'الكمية', 'إجمالي التكلفة', 'تكلفة الوحدة'],
          data.orders.map((o) => [
            o.order_number,
            o.product_name,
            o.status === 'completed' ? 'مكتمل' : o.status === 'in_progress' ? 'قيد التنفيذ' : 'قيد الانتظار',
            fmtNum(o.planned_qty, 3),
            fmtMoney(o.total_cost),
            fmtMoney(o.unit_cost),
          ])
        ),
    },
    {
      title: 'تقييم المخزون المالي',
      desc: 'القيمة الإجمالية للمخزون موزّعة حسب النوع',
      icon: Wallet,
      color: 'slate',
      count: data.items.length,
      onCSV: () =>
        exportToCSV(
          'التقييم_المالي',
          ['الصنف', 'النوع', 'المخزون', 'متوسط التكلفة', 'القيمة الإجمالية'],
          [
            ...data.items.map((i) => [
              i.name,
              i.item_type === 'raw' ? 'مادة خام' : i.item_type === 'semi' ? 'نصف مصنّع' : 'تام الصنع',
              fmtNum(i.quantity_on_hand, 3),
              fmtMoney(i.avg_unit_cost),
              fmtMoney(i.quantity_on_hand * i.avg_unit_cost),
            ]),
            ['الإجمالي', '', '', '', fmtMoney(totalValue)],
          ]
        ),
      onPrint: () =>
        printHTML(
          'تقرير التقييم المالي للمخزون',
          ['الصنف', 'النوع', 'القيمة الإجمالية'],
          [
            ...data.items.map((i) => [
              i.name,
              i.item_type === 'raw' ? 'خام' : i.item_type === 'semi' ? 'نصف' : 'تام',
              fmtMoney(i.quantity_on_hand * i.avg_unit_cost),
            ]),
            ['الإجمالي', '', fmtMoney(totalValue)],
          ]
        ),
    },
  ];

  const colors: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600 ring-brand-200',
    amber: 'bg-warning-50 text-warning-600 ring-warning-500/20',
    success: 'bg-success-50 text-success-600 ring-success-500/20',
    slate: 'bg-ink-100 text-ink-700 ring-ink-200',
  };

  return (
    <>
      <PageHeader title="التقارير" subtitle="تصدير وطباعة بيانات النظام بصيغة CSV وقابل للطباعة" />

      {data.items.length === 0 && data.movements.length === 0 && data.orders.length === 0 ? (
        <div className="bg-white rounded-2xl ring-1 ring-ink-200 shadow-sm">
          <EmptyState icon={<FileText size={26} />} title="لا توجد بيانات للتصدير" hint="ابدأ بإضافة أصناف وحركات وأوامر إنتاج" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {reportCards.map((r) => {
            const Icon = r.icon;
            return (
              <div key={r.title} className="bg-white rounded-2xl ring-1 ring-ink-200 shadow-sm p-5 hover:shadow-md transition">
                <div className="flex items-start gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-xl ring-1 flex items-center justify-center ${colors[r.color]}`}>
                    <Icon size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-ink-900 text-sm">{r.title}</h3>
                    <p className="text-xs text-ink-500 mt-0.5">{r.desc}</p>
                  </div>
                  <Badge color="gray">{r.count} سجل</Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={r.onCSV} className="flex-1"><Download size={15} /> تصدير CSV</Button>
                  <Button variant="secondary" size="sm" onClick={r.onPrint} className="flex-1"><Printer size={15} /> طباعة</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-5 bg-ink-800 rounded-2xl p-5 text-ink-200">
        <div className="flex items-center gap-2 mb-2">
          <FileBarChart size={18} className="text-brand-400" />
          <h3 className="font-bold text-white text-sm">ملخص مالي سريع</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
          <div><p className="text-xs text-ink-400">إجمالي قيمة المخزون</p><p className="text-lg font-bold text-white">{fmtMoney(totalValue)}</p></div>
          <div><p className="text-xs text-ink-400">عدد الأصناف</p><p className="text-lg font-bold text-white">{data.items.length}</p></div>
          <div><p className="text-xs text-ink-400">عدد الحركات</p><p className="text-lg font-bold text-white">{data.movements.length}</p></div>
          <div><p className="text-xs text-ink-400">أوامر الإنتاج</p><p className="text-lg font-bold text-white">{data.orders.length}</p></div>
        </div>
      </div>
    </>
  );
}
