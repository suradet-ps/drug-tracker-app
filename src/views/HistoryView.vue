<!-- src/views/HistoryView.vue -->
<script setup lang="ts">
import type { HistoryViewOrder, PurchaseOrderStatus } from '@/types/database';

import { computed, onMounted, ref } from 'vue';
import { supabase } from '@/supabase/client';
import { formatDate } from '@/utils/date';

// ─────────────────────────────────────────────
// Reactive state
// ─────────────────────────────────────────────

const allOrders = ref<HistoryViewOrder[]>([]);
const searchQuery = ref<string>('');
const supplierFilter = ref<string>('');
const loading = ref<boolean>(true);
const error = ref<string | null>(null);

// ─────────────────────────────────────────────
// Computed
// ─────────────────────────────────────────────

/**
 * Filters orders by drug name and supplier name (both case-insensitive).
 * Returns all orders when both filters are empty.
 */
const filteredOrders = computed<HistoryViewOrder[]>(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const supplier = supplierFilter.value.trim().toLowerCase();

  if (!query && !supplier) {
    return allOrders.value;
  }

  return allOrders.value.filter((order) => {
    const drugText = `${order.drugs.name} ${order.drugs.form ?? ''} ${order.drugs.strength ?? ''}`.toLowerCase();
    const matchesName = !query || drugText.includes(query);
    const matchesSupplier = !supplier || order.suppliers.name.toLowerCase().includes(supplier);
    return matchesName && matchesSupplier;
  });
});

/** Whether any filter is currently active */
const hasActiveFilter = computed<boolean>(
  () => searchQuery.value.trim() !== '' || supplierFilter.value.trim() !== '',
);

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function clearFilters(): void {
  searchQuery.value = '';
  supplierFilter.value = '';
}

/**
 * Maps a purchase order status to a CSS class for the status badge.
 */
function getStatusClass(status: PurchaseOrderStatus): string {
  switch (status) {
    case 'รับของแล้ว':
      return 'status-received';
    case 'สั่งแล้ว':
      return 'status-ordered';
    case 'ต้องสั่งซื้อ':
    default:
      return 'status-pending';
  }
}

// ─────────────────────────────────────────────
// Data fetching
// ─────────────────────────────────────────────

async function fetchHistory(): Promise<void> {
  try {
    const { data, error: dbError } = await supabase
      .from('purchase_orders')
      .select('id, status, order_date, received_date, packaging, drugs (*), suppliers (*)')
      .order('created_at', { ascending: false });

    if (dbError)
      throw dbError;

    allOrders.value = (data ?? []) as unknown as HistoryViewOrder[];
  }
  catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
    error.value = `เกิดข้อผิดพลาดในการดึงข้อมูล: ${message}`;
  }
  finally {
    loading.value = false;
  }
}

// ─────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────

onMounted(fetchHistory);
</script>

<template>
  <div class="page-container">
    <header class="page-header">
      <h1>ประวัติการสั่งซื้อทั้งหมด</h1>
      <p class="subtitle">
        ดูและค้นหารายการสั่งซื้อที่ผ่านมาทั้งหมดในระบบ
      </p>
    </header>

    <!-- Filter Bar -->
    <div class="filter-bar card">
      <div class="filter-group">
        <label for="history-search" class="filter-label">ค้นหายา</label>
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
            id="history-search"
            v-model="searchQuery"
            type="search"
            class="form-input"
            placeholder="ชื่อยา, รูปแบบ, ความแรง..."
            autocomplete="off"
          >
        </div>
      </div>

      <div class="filter-group">
        <label for="history-supplier" class="filter-label">กรองตามบริษัท</label>
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
            id="history-supplier"
            v-model="supplierFilter"
            type="search"
            class="form-input"
            placeholder="ชื่อบริษัท..."
            autocomplete="off"
          >
        </div>
      </div>

      <div class="filter-meta">
        <span v-if="!loading && !error" class="result-count">
          แสดง <strong>{{ filteredOrders.length }}</strong> / {{ allOrders.length }} รายการ
        </span>
        <button
          v-if="hasActiveFilter"
          class="btn btn-ghost btn-sm"
          type="button"
          @click="clearFilters"
        >
          ล้างตัวกรอง
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="status-state loading-state">
      <div class="spinner" />
      <p>กำลังโหลดข้อมูล...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="status-state error-state">
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
      <p>{{ error }}</p>
      <button class="btn btn-secondary" type="button" @click="fetchHistory">
        ลองใหม่อีกครั้ง
      </button>
    </div>

    <!-- Empty DB State -->
    <div v-else-if="allOrders.length === 0" class="status-state empty-state">
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
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
      <p>ยังไม่มีประวัติการสั่งซื้อในระบบ</p>
    </div>

    <!-- No Search Results -->
    <div v-else-if="filteredOrders.length === 0" class="status-state empty-state">
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
      <button class="btn btn-secondary btn-sm" type="button" @click="clearFilters">
        ล้างตัวกรอง
      </button>
    </div>

    <!-- History Table -->
    <div v-else class="table-container">
      <table>
        <thead>
          <tr>
            <th>ชื่อยา</th>
            <th>บริษัท</th>
            <th>สถานะ</th>
            <th>วันที่สั่งซื้อ</th>
            <th>วันที่รับของ</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in filteredOrders" :key="order.id">
            <td>
              <div class="drug-name">
                {{ order.drugs.name }}
              </div>
              <div class="drug-detail">
                {{ order.drugs.form }} {{ order.drugs.strength }}
                <span v-if="order.packaging">({{ order.packaging }})</span>
              </div>
            </td>
            <td>{{ order.suppliers.name }}</td>
            <td>
              <span class="status-badge" :class="getStatusClass(order.status)">
                {{ order.status }}
              </span>
            </td>
            <td>{{ formatDate(order.order_date) }}</td>
            <td>{{ formatDate(order.received_date) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
/* ─── Filter Bar ─── */

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

/* ─── Status States ─── */

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

/* ─── Table ─── */

.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  min-width: 700px;
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

tbody tr {
  transition: background-color 0.15s ease;
}

tbody tr:hover {
  background-color: color-mix(in srgb, var(--primary-color) 5%, transparent);
}

tbody td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
  vertical-align: middle;
}

/* ─── Status Badge ─── */

.status-badge {
  padding: 0.3rem 0.8rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 500;
  color: #fff;
  white-space: nowrap;
}

.status-pending {
  background-color: var(--status-pending-bg);
}

.status-ordered {
  background-color: var(--status-ordered-bg);
  color: var(--text-color);
}

.status-received {
  background-color: var(--status-received-bg);
}

/* ─── Ghost & Small Buttons ─── */

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
  background-color: var(--border-color);
  color: var(--text-color);
}

.btn-sm {
  padding: 0.4rem 1rem;
  font-size: 0.85rem;
}
</style>
