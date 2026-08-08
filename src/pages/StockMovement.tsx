<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>نظام إدارة المخزون - حركة المواد</title>
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- FontAwesome Icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <!-- Google Font Cairo -->
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap" rel="stylesheet">
    
    <style>
        * {
            font-family: 'Cairo', sans-serif;
        }
        @media print {
            .no-print {
                display: none !important;
            }
            .print-only {
                display: block !important;
            }
            body {
                background: #fff !important;
                color: #000 !important;
            }
            .shadow-custom {
                box-shadow: none !important;
                border: 1px solid #ccc !important;
            }
        }
        .print-only {
            display: none;
        }
    </style>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen pb-12">

    <!-- Header Section -->
    <header class="bg-slate-800 border-b border-slate-700 sticky top-0 z-30 shadow-lg no-print">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div class="flex items-center gap-3">
                <div class="p-3 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-500/30">
                    <i class="fa-solid fa-boxes-packing text-2xl"></i>
                </div>
                <div>
                    <h1 class="text-2xl font-bold text-white tracking-wide">حركة المخزن (الوارد والصادر)</h1>
                    <p class="text-xs text-slate-400">سجل إدخال وإخراج المواد، الفحص الفني، والتصدير</p>
                </div>
            </div>
            
            <div class="flex flex-wrap items-center gap-2">
                <button onclick="openModal()" class="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2.5 rounded-xl transition duration-200 flex items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95">
                    <i class="fa-solid fa-plus-circle"></i>
                    <span>تسجيل حركة جديدة</span>
                </button>
                <button onclick="exportToCSV()" class="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold px-4 py-2.5 rounded-xl transition duration-200 flex items-center gap-2 border border-slate-600 active:scale-95">
                    <i class="fa-solid fa-file-excel text-emerald-400"></i>
                    <span>تصدير CSV</span>
                </button>
                <button onclick="window.print()" class="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold px-4 py-2.5 rounded-xl transition duration-200 flex items-center gap-2 border border-slate-600 active:scale-95">
                    <i class="fa-solid fa-print text-blue-400"></i>
                    <span>طباعة التقرير</span>
                </button>
            </div>
        </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">

        <!-- KPI Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8 no-print">
            <div class="bg-slate-800 border border-slate-700/60 rounded-2xl p-5 shadow-lg flex items-center justify-between">
                <div>
                    <p class="text-xs font-semibold text-slate-400 mb-1">إجمالي الوارد</p>
                    <h3 id="stat-in" class="text-2xl font-extrabold text-emerald-400">0</h3>
                </div>
                <div class="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xl">
                    <i class="fa-solid fa-arrow-down-left"></i>
                </div>
            </div>

            <div class="bg-slate-800 border border-slate-700/60 rounded-2xl p-5 shadow-lg flex items-center justify-between">
                <div>
                    <p class="text-xs font-semibold text-slate-400 mb-1">إجمالي الصادر</p>
                    <h3 id="stat-out" class="text-2xl font-extrabold text-rose-400">0</h3>
                </div>
                <div class="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center text-xl">
                    <i class="fa-solid fa-arrow-up-right"></i>
                </div>
            </div>

            <div class="bg-slate-800 border border-slate-700/60 rounded-2xl p-5 shadow-lg flex items-center justify-between">
                <div>
                    <p class="text-xs font-semibold text-slate-400 mb-1">صافي الحركة</p>
                    <h3 id="stat-net" class="text-2xl font-extrabold text-blue-400">0</h3>
                </div>
                <div class="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center text-xl">
                    <i class="fa-solid fa-scale-balanced"></i>
                </div>
            </div>

            <div class="bg-slate-800 border border-slate-700/60 rounded-2xl p-5 shadow-lg flex items-center justify-between">
                <div>
                    <p class="text-xs font-semibold text-slate-400 mb-1">عدد الحركات المسجلة</p>
                    <h3 id="stat-count" class="text-2xl font-extrabold text-purple-400">0</h3>
                </div>
                <div class="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center text-xl">
                    <i class="fa-solid fa-list-check"></i>
                </div>
            </div>
        </div>

        <!-- Filter & Search Section -->
        <div class="bg-slate-800 border border-slate-700/60 rounded-2xl p-4 mb-6 no-print flex flex-col md:flex-row justify-between items-center gap-4">
            <div class="relative w-full md:w-96">
                <i class="fa-solid fa-magnifying-glass absolute right-3.5 top-3.5 text-slate-400"></i>
                <input type="text" id="searchInput" oninput="renderTable()" placeholder="ابحث باسم المادة، رقم المستند، أو الملاحظات..." class="w-full bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-xl pr-10 pl-4 py-2.5 focus:outline-none focus:border-blue-500 transition">
            </div>

            <div class="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                <button onclick="setFilter('ALL')" id="filter-ALL" class="filter-btn px-4 py-2 rounded-xl text-xs font-semibold transition bg-blue-600 text-white">الكل</button>
                <button onclick="setFilter('IN')" id="filter-IN" class="filter-btn px-4 py-2 rounded-xl text-xs font-semibold transition bg-slate-700 text-slate-300 hover:bg-slate-600">الوارد فقط</button>
                <button onclick="setFilter('OUT')" id="filter-OUT" class="filter-btn px-4 py-2 rounded-xl text-xs font-semibold transition bg-slate-700 text-slate-300 hover:bg-slate-600">الصادر فقط</button>
            </div>
        </div>

        <!-- Table Printable Header (Visible only in Print) -->
        <div class="print-only mb-6 text-center">
            <h2 class="text-2xl font-bold border-b pb-2">تقرير حركة المخزن (الوارد والصادر)</h2>
            <p class="text-sm text-gray-600 mt-1">تاريخ الاستخراج: <span id="printDate"></span></p>
        </div>

        <!-- Movements Table -->
        <div class="bg-slate-800 border border-slate-700/60 rounded-2xl shadow-xl overflow-hidden shadow-custom">
            <div class="overflow-x-auto">
                <table class="w-full text-right text-sm">
                    <thead class="bg-slate-900/80 text-slate-400 border-b border-slate-700 uppercase font-semibold">
                        <tr>
                            <th class="py-4 px-4 text-center">#</th>
                            <th class="py-4 px-4">التاريخ والوقت</th>
                            <th class="py-4 px-4">نوع الحركة</th>
                            <th class="py-4 px-4">اسم المادة</th>
                            <th class="py-4 px-4 text-center">الكمية والوحدة</th>
                            <th class="py-4 px-4">رقم الإذن / المستند</th>
                            <th class="py-4 px-4">حالة الفحص (QC)</th>
                            <th class="py-4 px-4">الملاحظات</th>
                            <th class="py-4 px-4 text-center no-print">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody id="movementsTable" class="divide-y divide-slate-700/50">
                        <!-- Table Rows Rendered via JS -->
                    </tbody>
                </table>
            </div>

            <!-- Empty State -->
            <div id="emptyState" class="hidden text-center py-12">
                <i class="fa-solid fa-box-open text-5xl text-slate-600 mb-3"></i>
                <p class="text-slate-400 font-medium">لا توجد حركات مخزنية مطابقة للبحث</p>
            </div>
        </div>
    </main>

    <!-- Modal Form (Add / Edit) -->
    <div id="movementModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center hidden p-4 no-print">
        <div class="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden transform transition-all">
            <div class="bg-slate-900 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                <h3 id="modalTitle" class="text-lg font-bold text-white">تسجيل حركة مخزنية جديدة</h3>
                <button onclick="closeModal()" class="text-slate-400 hover:text-white transition">
                    <i class="fa-solid fa-xmark text-xl"></i>
                </button>
            </div>

            <form id="movementForm" onsubmit="handleFormSubmit(event)" class="p-6 space-y-4">
                <input type="hidden" id="editIndex">

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-semibold text-slate-300 mb-1">نوع الحركة <span class="text-rose-500">*</span></label>
                        <select id="type" required class="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                            <option value="IN">وارد (إدخال مخزني)</option>
                            <option value="OUT">صادر (صرف للإنتاج)</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-xs font-semibold text-slate-300 mb-1">التاريخ <span class="text-rose-500">*</span></label>
                        <input type="date" id="date" required class="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-slate-300 mb-1">اسم المادة / المنتج <span class="text-rose-500">*</span></label>
                    <input type="text" id="itemName" required placeholder="مثال: ألومنيوم 9.5 ملم / حبيبات PVC" class="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-semibold text-slate-300 mb-1">الكمية <span class="text-rose-500">*</span></label>
                        <input type="number" step="0.01" id="quantity" required placeholder="0.00" class="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    </div>

                    <div>
                        <label class="block text-xs font-semibold text-slate-300 mb-1">وحدة القياس <span class="text-rose-500">*</span></label>
                        <select id="unit" required class="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                            <option value="كجم">كجم (Kilogram)</option>
                            <option value="متر">متر (Meter)</option>
                            <option value="طن">طن (Ton)</option>
                            <option value="بكرة">بكرة (Reel)</option>
                            <option value="قطعة">قطعة (Piece)</option>
                        </select>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-semibold text-slate-300 mb-1">رقم المستند / الإذن</label>
                        <input type="text" id="docNumber" placeholder="REC-2026-001" class="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    </div>

                    <div>
                        <label class="block text-xs font-semibold text-slate-300 mb-1">حالة الفحص (QC)</label>
                        <select id="qcStatus" class="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                            <option value="مقبول (مطابق)">مقبول (مطابق)</option>
                            <option value="قيد الفحص">قيد الفحص</option>
                            <option value="مرفوض">مرفوض</option>
                            <option value="غير مطلوب">غير مطلوب</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-slate-300 mb-1">ملاحظات إضافية</label>
                    <textarea id="notes" rows="2" placeholder="أدخل تفاصيل إضافية إن وجدت..." class="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"></textarea>
                </div>

                <div class="pt-2 flex justify-end gap-3">
                    <button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold rounded-xl transition">إلغاء</button>
                    <button type="submit" class="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-600/30 transition">حفظ الحركة</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Script Logic -->
    <script>
        // Default Data if empty
        const initialData = [
            { id: 101, date: '2026-08-01', type: 'IN', itemName: 'سبيكة ألومنيوم 9.5 ملم', quantity: 2500, unit: 'كجم', docNumber: 'PO-9941', qcStatus: 'مقبول (مطابق)', notes: 'توريد دفعة جديدة من المورد' },
            { id: 102, date: '2026-08-03', type: 'OUT', itemName: 'حبيبات PVC عزل', quantity: 450, unit: 'كجم', docNumber: 'ISS-1020', qcStatus: 'غير مطلوب', notes: 'صرف لخط الإنتاج رقم 2' },
            { id: 103, date: '2026-08-05', type: 'IN', itemName: 'ستيل واير 35 ملم', quantity: 1200, unit: 'كجم', docNumber: 'PO-9950', qcStatus: 'قيد الفحص', notes: 'انتظار شهادة الفحص المختبري' }
        ];

        let movements = JSON.parse(localStorage.getItem('inventory_movements')) || initialData;
        let activeFilter = 'ALL';

        function init() {
            document.getElementById('date').valueAsDate = new Date();
            document.getElementById('printDate').innerText = new Date().toLocaleDateString('ar-IQ');
            renderTable();
        }

        function saveData() {
            localStorage.setItem('inventory_movements', JSON.stringify(movements));
            renderTable();
        }

        function calculateStats() {
            let totalIn = 0;
            let totalOut = 0;

            movements.forEach(m => {
                if(m.type === 'IN') totalIn += parseFloat(m.quantity);
                if(m.type === 'OUT') totalOut += parseFloat(m.quantity);
            });

            document.getElementById('stat-in').innerText = totalIn.toLocaleString('ar-IQ') + ' وحدة';
            document.getElementById('stat-out').innerText = totalOut.toLocaleString('ar-IQ') + ' وحدة';
            document.getElementById('stat-net').innerText = (totalIn - totalOut).toLocaleString('ar-IQ') + ' وحدة';
            document.getElementById('stat-count').innerText = movements.length;
        }

        function renderTable() {
            calculateStats();
            const tbody = document.getElementById('movementsTable');
            const search = document.getElementById('searchInput').value.toLowerCase();
            tbody.innerHTML = '';

            const filtered = movements.filter(m => {
                const matchesFilter = activeFilter === 'ALL' || m.type === activeFilter;
                const matchesSearch = m.itemName.toLowerCase().includes(search) || 
                                      m.docNumber.toLowerCase().includes(search) || 
                                      (m.notes && m.notes.toLowerCase().includes(search));
                return matchesFilter && matchesSearch;
            });

            if (filtered.length === 0) {
                document.getElementById('emptyState').classList.remove('hidden');
            } else {
                document.getElementById('emptyState').classList.add('hidden');
            }

            filtered.forEach((m, index) => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-700/30 transition border-b border-slate-700/50";

                const isIN = m.type === 'IN';
                const typeBadge = isIN 
                    ? `<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold px-2.5 py-1 rounded-lg inline-flex items-center gap-1"><i class="fa-solid fa-arrow-down"></i> وارد</span>`
                    : `<span class="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold px-2.5 py-1 rounded-lg inline-flex items-center gap-1"><i class="fa-solid fa-arrow-up"></i> صادر</span>`;

                let qcBadgeClass = 'bg-slate-700 text-slate-300';
                if(m.qcStatus === 'مقبول (مطابق)') qcBadgeClass = 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50';
                if(m.qcStatus === 'قيد الفحص') qcBadgeClass = 'bg-amber-900/40 text-amber-300 border border-amber-700/50';
                if(m.qcStatus === 'مرفوض') qcBadgeClass = 'bg-rose-900/40 text-rose-300 border border-rose-700/50';

                tr.innerHTML = `
                    <td class="py-3 px-4 text-center text-slate-400 font-mono text-xs">#${m.id}</td>
                    <td class="py-3 px-4 text-slate-300 font-medium">${m.date}</td>
                    <td class="py-3 px-4">${typeBadge}</td>
                    <td class="py-3 px-4 font-semibold text-white">${m.itemName}</td>
                    <td class="py-3 px-4 text-center font-bold text-slate-100">${Number(m.quantity).toLocaleString()} <span class="text-xs font-normal text-slate-400">${m.unit}</span></td>
                    <td class="py-3 px-4 text-slate-300 font-mono text-xs">${m.docNumber || '-'}</td>
                    <td class="py-3 px-4"><span class="text-xs px-2.5 py-1 rounded-md font-semibold ${qcBadgeClass}">${m.qcStatus}</span></td>
                    <td class="py-3 px-4 text-slate-400 text-xs max-w-xs truncate">${m.notes || '-'}</td>
                    <td class="py-3 px-4 text-center no-print">
                        <div class="flex items-center justify-center gap-2">
                            <button onclick="editMovement(${m.id})" title="تعديل" class="p-1.5 bg-slate-700 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg transition">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button onclick="deleteMovement(${m.id})" title="حذف" class="p-1.5 bg-slate-700 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg transition">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        function setFilter(type) {
            activeFilter = type;
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.className = 'filter-btn px-4 py-2 rounded-xl text-xs font-semibold transition bg-slate-700 text-slate-300 hover:bg-slate-600';
            });
            document.getElementById(`filter-${type}`).className = 'filter-btn px-4 py-2 rounded-xl text-xs font-semibold transition bg-blue-600 text-white';
            renderTable();
        }

        function openModal(isEdit = false) {
            document.getElementById('movementModal').classList.remove('hidden');
            if(!isEdit) {
                document.getElementById('movementForm').reset();
                document.getElementById('editIndex').value = '';
                document.getElementById('modalTitle').innerText = 'تسجيل حركة مخزنية جديدة';
                document.getElementById('date').valueAsDate = new Date();
            }
        }

        function closeModal() {
            document.getElementById('movementModal').classList.add('hidden');
        }

        function handleFormSubmit(e) {
            e.preventDefault();
            const editId = document.getElementById('editIndex').value;

            const movementData = {
                id: editId ? parseInt(editId) : Date.now(),
                type: document.getElementById('type').value,
                date: document.getElementById('date').value,
                itemName: document.getElementById('itemName').value,
                quantity: parseFloat(document.getElementById('quantity').value),
                unit: document.getElementById('unit').value,
                docNumber: document.getElementById('docNumber').value,
                qcStatus: document.getElementById('qcStatus').value,
                notes: document.getElementById('notes').value
            };

            if (editId) {
                const idx = movements.findIndex(m => m.id == editId);
                if (idx !== -1) movements[idx] = movementData;
            } else {
                movements.unshift(movementData);
            }

            saveData();
            closeModal();
        }

        function editMovement(id) {
            const item = movements.find(m => m.id === id);
            if (!item) return;

            document.getElementById('editIndex').value = item.id;
            document.getElementById('type').value = item.type;
            document.getElementById('date').value = item.date;
            document.getElementById('itemName').value = item.itemName;
            document.getElementById('quantity').value = item.quantity;
            document.getElementById('unit').value = item.unit;
            document.getElementById('docNumber').value = item.docNumber;
            document.getElementById('qcStatus').value = item.qcStatus;
            document.getElementById('notes').value = item.notes;

            document.getElementById('modalTitle').innerText = 'تعديل الحركة المخزنية';
            openModal(true);
        }

        function deleteMovement(id) {
            if (confirm('هل أنت تأكد من إزالة هذه الحركة من السجل؟')) {
                movements = movements.filter(m => m.id !== id);
                saveData();
            }
        }

        // Export functionality to Excel / CSV with UTF-8 BOM
        function exportToCSV() {
            if(movements.length === 0) {
                alert('لا توجد بيانات لتصديرها');
                return;
            }

            let csvContent = "\uFEFF"; // BOM for UTF-8 Excel support
            csvContent += "المعرف,التاريخ,نوع الحركة,اسم المادة,الكمية,الوحدة,رقم المستند,حالة الفحص,الملاحظات\n";

            movements.forEach(m => {
                const typeText = m.type === 'IN' ? 'وارد' : 'صادر';
                const row = [
                    m.id,
                    m.date,
                    typeText,
                    `"${m.itemName}"`,
                    m.quantity,
                    m.unit,
                    `"${m.docNumber || ''}"`,
                    `"${m.qcStatus}"`,
                    `"${m.notes || ''}"`
                ].join(",");
                csvContent += row + "\n";
            });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `حركة_المخزن_${new Date().toISOString().slice(0,10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        // Run on Page Load
        init();
    </script>
</body>
</html>