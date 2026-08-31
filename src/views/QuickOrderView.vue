<!-- src/views/QuickOrderView.vue -->
<script setup lang="ts">
import type { QuickOrderDraftItem } from '@/types/database';

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuickOrder } from '@/composables/use-quick-order';
import { useNotificationStore } from '@/stores/notification';

// ─────────────────────────────────────────────
// Composables & Stores
// ─────────────────────────────────────────────

const router = useRouter();
const notificationStore = useNotificationStore();

const {
  draftItems,
  allSuppliers,
  loading,
  submitting,
  fetchError,
  submitError,
  selectedCount,
  hasInvalidItems,
  fetchCatalog,
  submitOrders,
} = useQuickOrder();

// ─────────────────────────────────────────────
// Local UI State
// ─────────────────────────────────────────────

const searchQuery = ref<string>('');
const supplierFilter = ref<string>('');

// ─────────────────────────────────────────────
// Computed — Filtering
// ─────────────────────────────────────────────

/** Items that match the current search and supplier filter */
const filteredItems = computed<QuickOrderDraftItem[]>(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const supplier = supplierFilter.value.trim().toLowerCase();

  return draftItems.value.filter((item) => {
    const drugText
      = `${item.drug.name} ${item.drug.form ?? ''} ${item.drug.strength ?? ''}`.toLowerCase();
    const matchesName = !query || drugText.includes(query);
    const matchesSupplier = !supplier || item.supplierName.toLowerCase().includes(supplier);
    return matchesName && matchesSupplier;
  });
});

/** Whether all currently visible (filtered) items are selected */
const isAllFilteredSelected = computed<boolean>(() => {
  const visible = filteredItems.value;
  return visible.length > 0 && visible.every(item => item.isSelected);
});

/** Number of currently visible (filtered) items that are selected */
const filteredSelectedCount = computed<number>(
  () => filteredItems.value.filter(i => i.isSelected).length,
);

/** Unique supplier names derived from allSuppliers list */
const supplierNames = computed<string[]>(() => allSuppliers.value.map(s => s.name));

// ─────────────────────────────────────────────
// Selection Helpers
// ─────────────────────────────────────────────

function toggleItem(item: QuickOrderDraftItem): void {
  item.isSelected = !item.isSelected;
}

function toggleAllFiltered(event: Event): void {
  const checked = (event.target as HTMLInputElement).checked;
  filteredItems.value.forEach((item) => {
    item.isSelected = checked;
  });
}

function clearAllSelections(): void {
  draftItems.value.forEach(item => (item.isSelected = false));
}

// ─────────────────────────────────────────────
// Submit Handler
// ─────────────────────────────────────────────

async function handleSubmit(): Promise<void> {
  try {
    const count = await submitOrders();
    notificationStore.showNotification({
      message: `สร้างรายการสั่งซื้อสำเร็จ ${count} รายการ! เลือกรายการที่ต้องการแล้วส่งผ่าน Telegram ได้เลย`,
      type: 'success',
    });
    await router.push({ name: 'Order' });
  }
  catch {
    // submitError is already set inside the composable; the UI will display it.
  }
}

// ─────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────

onMounted(fetchCatalog);
</script>

<template>
  <div class="page-container">
    <!-- Page Header -->
    <header class="page-header">
      <h1>สร้างใบสั่งซื้อด่วน</h1>
      <p class="subtitle">
        เลือกยาและระบุจำนวนที่ต้องการ ระบบจะดึงข้อมูลบริษัท ราคา
        และหน่วยนับจากประวัติล่าสุดให้อัตโนมัติ
      </p>
    </header>

    <!-- Filter Bar -->
    <div class="filter-bar card">
      <div class="filter-group">
        <label for="search-input" class="filter-label">ค้นหายา</label>
        <div class="input-icon-wrapper">
          <svg
            class="input-icon"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="search-input"
            v-model="searchQuery"
            type="search"
            class="form-input"
            placeholder="ชื่อยา, รูปแบบ, ความแรง..."
            autocomplete="off"
          >
        </div>
      </div>

      <div class="filter-group">
        <label for="supplier-filter" class="filter-label">กรองตามบริษัท</label>
        <div class="input-icon-wrapper">
          <svg
            class="input-icon"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <input
            id="supplier-filter"
            v-model="supplierFilter"
            type="search"
            class="form-input"
            placeholder="ชื่อบริษัท..."
            autocomplete="off"
          >
        </div>
      </div>

      <div class="filter-meta">
        <span class="result-count">
          แสดง <strong>{{ filteredItems.length }}</strong> / {{ draftItems.length }} รายการ
        </span>
        <button
          v-if="selectedCount > 0"
          class="btn btn-ghost btn-sm"
          type="button"
          @click="clearAllSelections"
        >
          ล้างการเลือกทั้งหมด
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="status-state loading-state">
      <div class="spinner" />
      <p>กำลังโหลดรายการยา...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="fetchError" class="status-state error-state">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p>{{ fetchError }}</p>
      <button class="btn btn-secondary" type="button" @click="fetchCatalog">
        ลองใหม่อีกครั้ง
      </button>
    </div>

    <!-- Empty DB State -->
    <div v-else-if="draftItems.length === 0" class="status-state empty-state">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
        />
      </svg>
      <p>ยังไม่มีรายการยาในระบบ</p>
      <p class="subtle">
        กรุณานำเข้าข้อมูลยาก่อนใช้งาน
      </p>
    </div>

    <!-- No Search Results -->
    <div v-else-if="filteredItems.length === 0" class="status-state empty-state">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <p>ไม่พบรายการที่ตรงกับการค้นหา</p>
      <button
        class="btn btn-secondary btn-sm"
        type="button"
        @click="
          searchQuery = '';
          supplierFilter = '';
        "
      >
        ล้างตัวกรอง
      </button>
    </div>

    <!-- Drug Catalog Table -->
    <div v-else class="table-container">
      <!-- Datalist for supplier autocomplete -->
      <datalist id="supplier-list">
        <option v-for="name in supplierNames" :key="name" :value="name" />
      </datalist>

      <table>
        <thead>
          <tr>
            <th class="col-checkbox">
              <input
                type="checkbox"
                :checked="isAllFilteredSelected"
                :indeterminate="filteredSelectedCount > 0 && !isAllFilteredSelected"
                title="เลือก/ยกเลิกทั้งหมดที่แสดงอยู่"
                @change="toggleAllFiltered"
              >
            </th>
            <th class="col-drug">
              ชื่อยา
            </th>
            <th class="col-supplier">
              บริษัท <span class="required-badge">*</span>
            </th>
            <th class="col-quantity">
              จำนวน
            </th>
            <th class="col-unit">
              หน่วยนับ
            </th>
            <th class="col-price">
              ราคา/หน่วย (บาท)
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in filteredItems"
            :key="item.drug.id"
            class="catalog-row"
            :class="{
              'row-selected': item.isSelected,
              'row-invalid':
                item.isSelected
                && (!item.supplierName.trim()
                  || !(Number.isFinite(item.quantity) && item.quantity >= 1)
                  || !(Number.isFinite(item.pricePerUnit) && item.pricePerUnit >= 0)),
            }"
            @click.self="toggleItem(item)"
          >
            <!-- Checkbox -->
            <td class="col-checkbox" @click.stop>
              <input type="checkbox" :checked="item.isSelected" @change="toggleItem(item)">
            </td>

            <!-- Drug Info -->
            <td class="col-drug" @click="toggleItem(item)">
              <span class="drug-name">{{ item.drug.name }}</span>
              <span class="drug-meta">
                <template v-if="item.drug.form">{{ item.drug.form }}</template>
                <template v-if="item.drug.form && item.drug.strength"> · </template>
                <template v-if="item.drug.strength">{{ item.drug.strength }}</template>
              </span>
            </td>

            <!-- Supplier Input -->
            <td class="col-supplier" @click.stop>
              <input
                v-model="item.supplierName"
                type="text"
                class="inline-input"
                :class="{ 'input-error': item.isSelected && !item.supplierName.trim() }"
                list="supplier-list"
                placeholder="ระบุบริษัท..."
                autocomplete="off"
                @focus="item.isSelected = true"
              >
              <span v-if="item.isSelected && !item.supplierName.trim()" class="field-error-hint">กรุณาระบุบริษัท</span>
            </td>

            <!-- Quantity Input -->
            <td class="col-quantity" @click.stop>
              <input
                v-model.number="item.quantity"
                type="number"
                class="inline-input quantity-input"
                min="1"
                step="1"
                @focus="item.isSelected = true"
              >
            </td>

            <!-- Unit Count Input -->
            <td class="col-unit" @click.stop>
              <input
                v-model="item.unitCount"
                type="text"
                class="inline-input"
                placeholder="เช่น กล่อง, แผง"
                @focus="item.isSelected = true"
              >
            </td>

            <!-- Price Input -->
            <td class="col-price" @click.stop>
              <input
                v-model.number="item.pricePerUnit"
                type="number"
                class="inline-input price-input"
                min="0"
                step="0.01"
                @focus="item.isSelected = true"
              >
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Submit Error Banner -->
    <div v-if="submitError" class="submit-error-banner">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{{ submitError }}</span>
    </div>

    <!-- Floating Action Bar -->
    <div class="floating-bar" :class="{ visible: selectedCount > 0 }">
      <div class="floating-bar-info">
        <span class="selected-label">เลือกแล้ว</span>
        <span class="selected-count">{{ selectedCount }}</span>
        <span class="selected-label">รายการ</span>
      </div>

      <div v-if="hasInvalidItems" class="floating-bar-warning">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
          />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        มีรายการที่ข้อมูลไม่ครบถ้วน (บริษัท, จำนวน หรือราคา)
      </div>

      <button
        class="btn btn-primary"
        type="button"
        :disabled="submitting || hasInvalidItems || selectedCount === 0"
        @click="handleSubmit"
      >
        <span v-if="submitting" class="btn-spinner" />
        {{ submitting ? "กำลังสร้างรายการ..." : `สร้างรายการสั่งซื้อ (${selectedCount})` }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Filter Bar */

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1rem 1.5rem;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.5rem;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex: 1 1 200px;
}

.filter-label {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--subtle-text-color);
}

.input-icon-wrapper {
  position: relative;
}

.input-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--subtle-text-color);
  pointer-events: none;
}

.input-icon-wrapper .form-input {
  padding-left: 2.25rem;
}

.filter-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-left: auto;
  flex-shrink: 0;
}

.result-count {
  font-size: 0.9rem;
  color: var(--subtle-text-color);
  white-space: nowrap;
}

/* Status States */

.status-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 5rem 1rem;
  color: var(--subtle-text-color);
  text-align: center;
}

.status-state svg {
  opacity: 0.4;
}

.status-state p {
  font-size: 1.1rem;
  margin: 0;
}

.status-state .subtle {
  font-size: 0.9rem;
  opacity: 0.7;
}

.spinner {
  border: 3px solid var(--border-color);
  border-top: 3px solid var(--primary-color);
  border-radius: 50%;
  width: 36px;
  height: 36px;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Catalog Table */

.table-container {
  overflow-x: auto;
  margin-bottom: 6rem;
}

table {
  width: 100%;
  min-width: 800px;
}

thead th {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--subtle-text-color);
  white-space: nowrap;
  padding: 0.75rem 1rem;
}

.col-checkbox {
  width: 52px;
  text-align: center;
  padding-left: 1rem;
}

.col-checkbox input[type='checkbox'] {
  width: 17px;
  height: 17px;
  cursor: pointer;
  accent-color: var(--primary-color);
}

.col-drug {
  min-width: 220px;
}

.col-supplier {
  min-width: 180px;
}

.col-quantity {
  width: 100px;
}

.col-unit {
  min-width: 120px;
}

.col-price {
  min-width: 130px;
}

.required-badge {
  color: var(--status-pending-bg, #e53e3e);
  margin-left: 2px;
}

/* Table Rows */

.catalog-row {
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.catalog-row:hover {
  background-color: color-mix(in srgb, var(--primary-color) 5%, transparent);
}

.catalog-row td {
  padding: 0.6rem 1rem;
  vertical-align: middle;
  border-bottom: 1px solid var(--border-color);
}

.row-selected {
  background-color: color-mix(in srgb, var(--primary-color) 8%, transparent) !important;
}

.row-invalid {
  background-color: color-mix(in srgb, var(--status-pending-bg, #e53e3e) 6%, transparent) !important;
}

/* Drug Info Cell */

.drug-name {
  display: block;
  font-weight: 600;
  color: var(--text-color);
}

.drug-meta {
  display: block;
  font-size: 0.8rem;
  color: var(--subtle-text-color);
  margin-top: 2px;
}

/* Inline Inputs */

.inline-input {
  width: 100%;
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background-color: var(--bg-color);
  color: var(--text-color);
  font-size: 0.9rem;
  transition:
    border-color 0.15s,
    box-shadow 0.15s,
    background-color 0.3s;
  box-sizing: border-box;
}

.inline-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 20%, transparent);
}

.inline-input.input-error {
  border-color: var(--status-pending-bg, #e53e3e);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--status-pending-bg, #e53e3e) 15%, transparent);
}

.quantity-input {
  text-align: center;
}

.price-input {
  text-align: right;
}

/* Field Error Hint */

.field-error-hint {
  display: block;
  font-size: 0.72rem;
  color: var(--status-pending-bg, #e53e3e);
  margin-top: 3px;
}

/* Submit Error Banner */

.submit-error-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background-color: color-mix(in srgb, var(--status-pending-bg, #e53e3e) 12%, transparent);
  color: var(--status-pending-bg, #e53e3e);
  border: 1px solid var(--status-pending-bg, #e53e3e);
  border-radius: 8px;
  padding: 0.9rem 1.25rem;
  margin-top: 1rem;
  font-size: 0.9rem;
}

/* Floating Action Bar */

.floating-bar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translate(-50%, 120%);
  background-color: var(--card-bg-color);
  padding: 1rem 1.5rem;
  border-radius: 14px 14px 0 0;
  box-shadow: 0 -4px 30px var(--shadow-color);
  display: flex;
  align-items: center;
  gap: 1.5rem;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 1500;
  min-width: 360px;
  border: 1px solid var(--border-color);
  border-bottom: none;
}

.floating-bar.visible {
  transform: translate(-50%, 0);
}

.floating-bar-info {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  flex: 1;
}

.selected-label {
  font-size: 0.9rem;
  color: var(--subtle-text-color);
}

.selected-count {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--primary-color);
  line-height: 1;
}

.floating-bar-warning {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: var(--status-pending-bg, #e53e3e);
  font-weight: 500;
  white-space: nowrap;
}

/* Button Spinner */

.btn-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin-right: 0.4rem;
  vertical-align: middle;
}

/* Ghost & Small Buttons */

.btn-ghost {
  background: none;
  border: 1px solid var(--border-color);
  color: var(--subtle-text-color);
  border-radius: 6px;
  padding: 0.35rem 0.85rem;
  font-size: 0.85rem;
  cursor: pointer;
  transition:
    background-color 0.15s,
    color 0.15s;
}

.btn-ghost:hover {
  background-color: var(--bg-color);
  color: var(--text-color);
}

.btn-sm {
  padding: 0.35rem 0.85rem;
  font-size: 0.85rem;
}

/* Responsive */

@media (max-width: 768px) {
  .filter-bar {
    flex-direction: column;
    gap: 0.75rem;
  }

  .filter-meta {
    margin-left: 0;
    width: 100%;
    justify-content: space-between;
  }

  .floating-bar {
    min-width: unset;
    width: calc(100% - 2rem);
    border-radius: 12px;
    bottom: 1rem;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .floating-bar .btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
