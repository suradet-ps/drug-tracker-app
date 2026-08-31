<!-- src/views/ReceiveView.vue -->
<script setup lang="ts">
import type { ReceivableOrder, ReceiveViewOrder } from '@/types/database';

import { computed, onMounted, ref } from 'vue';
import { useNotificationStore } from '@/stores/notification';
import { supabase } from '@/supabase/client';
import { formatDate } from '@/utils/date';

// ─────────────────────────────────────────────
// Stores
// ─────────────────────────────────────────────

const notificationStore = useNotificationStore();

// ─────────────────────────────────────────────
// Reactive state
// ─────────────────────────────────────────────

const orders = ref<ReceivableOrder[]>([]);
const searchQuery = ref<string>('');
const supplierFilter = ref<string>('');
const loading = ref<boolean>(true);
const error = ref<string | null>(null);

// ─────────────────────────────────────────────
// Computed
// ─────────────────────────────────────────────

/**
 * Filters receivable orders by drug name and supplier name (both case-insensitive).
 * Returns all orders when both filters are empty.
 */
const filteredOrders = computed<ReceivableOrder[]>(() => {
  const query = searchQuery.value.trim().toLowerCase();
  const supplier = supplierFilter.value.trim().toLowerCase();

  if (!query && !supplier) {
    return orders.value;
  }

  return orders.value.filter((order) => {
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
 * Converts a raw `ReceiveViewOrder` row into a `ReceivableOrder`
 * by augmenting it with local UI state fields.
 */
function toReceivableOrder(row: ReceiveViewOrder): ReceivableOrder {
  return {
    ...row,
    received_date_input: '',
    isSaving: false,
  };
}

// ─────────────────────────────────────────────
// Data fetching
// ─────────────────────────────────────────────

async function fetchOrdersToReceive(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    const { data, error: dbError } = await supabase
      .from('purchase_orders')
      .select('id, order_date, packaging, drugs (*), suppliers (*)')
      .eq('status', 'สั่งแล้ว')
      .order('order_date', { ascending: true });

    if (dbError)
      throw dbError;

    orders.value = ((data ?? []) as unknown as ReceiveViewOrder[]).map(toReceivableOrder);
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
// Actions
// ─────────────────────────────────────────────

/**
 * Marks a single order as received by updating its status and
 * received date in the database, then removes it from the local list.
 */
async function markAsReceived(order: ReceivableOrder): Promise<void> {
  if (!order.received_date_input) {
    notificationStore.showNotification({
      message: 'กรุณาเลือกวันที่รับของ',
      type: 'error',
    });
    return;
  }

  order.isSaving = true;

  try {
    const { error: updateError } = await supabase
      .from('purchase_orders')
      .update({
        received_date: order.received_date_input,
        status: 'รับของแล้ว',
      })
      .eq('id', order.id);

    if (updateError) {
      throw updateError;
    }

    // Remove the order from the local list after successful update
    orders.value = orders.value.filter(o => o.id !== order.id);
    notificationStore.showNotification({
      message: 'บันทึกการรับของเรียบร้อย!',
      type: 'success',
    });
  }
  catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
    notificationStore.showNotification({
      message: `เกิดข้อผิดพลาด: ${message}`,
      type: 'error',
    });
  }
  finally {
    order.isSaving = false;
  }
}

// ─────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────

onMounted(fetchOrdersToReceive);
</script>

<template>
  <div class="page-container">
    <header class="page-header">
      <h1>รายการรอรับของ</h1>
      <p class="subtitle">
        รายการยาที่สั่งซื้อไปแล้วและกำลังรอการจัดส่ง บันทึกวันที่รับของเพื่อย้ายไปยังประวัติ
      </p>
    </header>

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
      <button class="btn btn-secondary" type="button" @click="fetchOrdersToReceive">
        ลองใหม่อีกครั้ง
      </button>
    </div>

    <!-- Empty DB State -->
    <div v-else-if="orders.length === 0" class="status-state empty-state">
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
        <rect x="1" y="3" width="15" height="13" />
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
      <p>ไม่มีรายการที่รอรับของในขณะนี้</p>
    </div>

    <template v-else>
      <!-- Filter Bar — shown only when there is data -->
      <div class="filter-bar card">
        <div class="filter-group">
          <label for="receive-search" class="filter-label">ค้นหายา</label>
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
              id="receive-search"
              v-model="searchQuery"
              type="search"
              class="form-input"
              placeholder="ชื่อยา, รูปแบบ, ความแรง..."
              autocomplete="off"
            >
          </div>
        </div>

        <div class="filter-group">
          <label for="receive-supplier" class="filter-label">กรองตามบริษัท</label>
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
              id="receive-supplier"
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
            แสดง <strong>{{ filteredOrders.length }}</strong> / {{ orders.length }} รายการ
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

      <!-- No Search Results -->
      <div v-if="filteredOrders.length === 0" class="status-state empty-state">
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

      <!-- Receive Table -->
      <div v-else class="table-container">
        <table>
          <thead>
            <tr>
              <th>ชื่อยา</th>
              <th>บริษัท</th>
              <th>วันที่สั่งซื้อ</th>
              <th class="action-column">
                วันที่รับของ
              </th>
              <th class="action-column" />
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
              <td>{{ formatDate(order.order_date) }}</td>
              <td>
                <input v-model="order.received_date_input" type="date" class="form-input date-input">
              </td>
              <td>
                <button
                  class="btn btn-primary btn-full"
                  :disabled="!order.received_date_input || order.isSaving"
                  @click="markAsReceived(order)"
                >
                  {{ order.isSaving ? 'กำลังบันทึก...' : 'บันทึก' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
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

.action-column {
  width: 200px;
}

.date-input {
  padding: 0.6rem;
  width: 100%;
  box-sizing: border-box;
}

.btn-full {
  width: 100%;
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
