# مشروع Quantum ERP (نظام إدارة مصنع كيبلات)

## عن المستخدم وطريقة الرد
- المستخدم مبتدئ بالبرمجة. اشرح ببساطة وبالعربية، وبعد كل مهمة اذكر أسماء الملفات التي تغيرت بالضبط.
- لا تسأل أكثر من سؤال واحد بكل مرة.

## التقنيات
React + TypeScript + Vite + Tailwind + Supabase (Postgres) + recharts + lucide-react. واجهة RTL عربية.
الأوامر: `npm run dev` (تشغيل)، `npm run build` (فحص أخطاء TypeScript + بناء).
الصفحات في `src/pages`: Dashboard, StockMovement, Production, Sales, Accounting, Quality, Reports, Users.

## قواعد العمل (لتوفير الاستهلاك وحماية المشروع)
1. مرحلة واحدة فقط بكل جلسة. ابدأ بخطة قصيرة (5 أسطر) وانتظر موافقتي قبل التعديل.
2. لا تقرأ المشروع كله. اقرأ فقط الملفات التي أسميها لك. الملفات الكبيرة (Accounting ~1100 سطر، StockMovement ~1090، Production ~800): استخدم grep لإيجاد الجزء المطلوب ثم اقرأ ذلك المقطع فقط.
3. لا تعمل refactor أو تحسينات خارج المهمة. لا تضف مكتبات بدون سؤال.
4. بعد كل تعديل شغّل `npm run build` وأصلح أي خطأ قبل أن تقول إنك انتهيت.
5. اعمل git commit بعد كل مرحلة ناجحة برسالة واضحة. لا تعمل git push ولا نشر (deploy).
6. لا تلمس ملفات `.env`. لا تحذف جداول أو بيانات.
7. أي تغيير بقاعدة البيانات يُكتب كملف SQL في `supabase/migrations/` وتعطيني إياه لأراجعه وأنفذه بنفسي في Supabase SQL Editor. لا تنفذ SQL مباشرة.
8. في نهاية كل جلسة حدّث قسم "سجل الإنجاز" بالأسفل بسطرين.

## قاعدة البيانات الحية (Supabase) - تم التحقق منها أكتوبر 2026
**مهم:** ملف `supabase/migrations/20260806152010_create_inventory_production_schema.sql` و `src/lib/supabase.ts` يصفان تصميماً قديماً (items/movements...) لم يُنفَّذ أبداً. لا تعتمد عليهما ولا تنفذهما.

الجداول الفعلية وفيها بيانات حقيقية:
- `materials` (31): id, material_code, warehouse_code, warehouse_name, material_name, unit, qc_required, min_stock, cost_price
- `inbound` (69): id, entry_number, transaction_date (نص), warehouse_code, warehouse_name, material_name, material_code, unit, quantity_received, reels_received, reference_or_notes, qc_status
- `outbound` (166): id, entry_number, transaction_date (نص), warehouse_code, warehouse_name, material_name, material_code, unit, quantity_issued, reels_issued, reels_issued_1, notes, qc_status
- `warehouses` (8): id, warehouse_code, warehouse_name
- `live_stock_view` (VIEW): material_code, material_name, warehouse_name, unit, min_stock, total_in, total_out, current_balance
- `accounts` (765): id uuid, code, name, category, is_active, parent_code, type
- `journal_entries` (7): id text, date text, reference, description, lines (jsonb), pdf_url, pdf_name, created_at
- `contacts` (18): id, party_name

جداول فاضية أو بقايا قديمة (لا تحذفها الآن): accounting_transactions, inventory_movements, inventory_tree, items, categories, production_orders, production_order_materials.

**غير موجودة نهائياً بالقاعدة:** `sales_orders`, `sales_dispatches`, `quality_records`.

## حالة كل صفحة (من فحص الكود)
- StockMovement: يعمل مع materials/inbound/outbound/warehouses/live_stock_view.
- Production: يكتب outbound (صرف مواد) و inbound (استلام منتج تام) وقد يضيف المنتج التام إلى materials. لكن الوصفات (BOM) وأوامر الإنتاج محفوظة في localStorage فقط (`app_boms`, `app_production_orders`).
- Sales: القراءة من Supabase تفشل (الجداول غير موجودة)، فيعتمد على localStorage فقط (`app_sales_orders`, `app_sales_dispatches`). لا يؤثر على المخزون ولا المحاسبة.
- Quality: الحفظ في `quality_records` يفشل (غير موجود)، والملفات في localStorage (`app_quality_files`).
- Accounting: يعمل مع accounts و journal_entries، لكن القيود يدوية ومنفصلة عن المخزون والمبيعات.
- Reports: كان يقرأ جداول فاضية (inventory_movements / inventory_tree). يجب أن يقرأ من inbound/outbound/materials/live_stock_view.
- Dashboard: بيانات وهمية (كود Supabase معلّق).
- Users: لا يحفظ أي شيء (useState فقط) ولا يوجد تسجيل دخول. الموقع مفتوح للجميع.

نصوص حالة الفحص (QC) المستخدمة: `مقبول (مطابق)`، `مرفوض (غير مطابق)`، `قيد الفحص`، `-` (بدون فحص).
كل صفحة تنشئ عميل Supabase خاص بها (غير موحّد).

## خطة المراحل (نفّذ بالترتيب، مرحلة بكل جلسة)
1. Reports تقرأ من الجداول الحقيقية.
2. المبيعات والجودة: إنشاء جداول `sales_orders`, `sales_dispatches`, `quality_records` (SQL أراجعه)، ونقل الحفظ من localStorage إلى Supabase مع الحفاظ على البيانات الموجودة.
3. ربط تسليم المبيعات بالمخزون: كل تسليم يُنشئ سطراً في `outbound`.
4. الإنتاج: نقل الوصفات وأوامر الإنتاج إلى Supabase.
5. قيود محاسبية تلقائية في `journal_entries` من الاستلام والتسليم.
6. المستخدمون وتسجيل الدخول بحساب Google مع موافقة المدير + صلاحيات لكل قسم (RLS في Supabase). هذه آخر مرحلة.

## سجل الإنجاز
(يُحدَّث نهاية كل جلسة)