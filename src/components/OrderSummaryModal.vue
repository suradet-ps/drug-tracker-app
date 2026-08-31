<!-- src/components/OrderSummaryModal.vue -->
<script setup lang="ts">
import type { GroupedOrders, OrderViewOrder } from '@/types/database';

import { ref } from 'vue';
import { supabase } from '@/supabase/client';

// ─────────────────────────────────────────────
// Props & Emits
// ─────────────────────────────────────────────

const props = defineProps<{
  groupedOrders: GroupedOrders;
}>();

const emit = defineEmits<{
  close: [];
  ordersSent: [];
}>();

// ─────────────────────────────────────────────
// Local state
// ─────────────────────────────────────────────

const isSending = ref<boolean>(false);
const error = ref<string | null>(null);

// ─────────────────────────────────────────────
// Telegram MarkdownV2 helpers
// ─────────────────────────────────────────────

const MARKDOWN_V2_SPECIAL_CHARS = /([_*[\]()~`>#+\-=|{}.!])/g;

/**
 * Escapes special characters for Telegram MarkdownV2 parse mode.
 * Safely handles `null`, `undefined`, and non-string values.
 */
function escapeMarkdownV2(text: string | number | null | undefined): string {
  return String(text ?? '').replace(MARKDOWN_V2_SPECIAL_CHARS, '\\$1');
}

/**
 * Formats a `Date` to a Thai locale date string, then escapes it for MarkdownV2.
 */
function formatThaiDate(date: Date): string {
  const formatted = date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return escapeMarkdownV2(formatted);
}

/**
 * Formats a `Date` to an ISO date string (YYYY-MM-DD) suitable for database storage.
 * Uses local date components to avoid UTC offset issues.
 */
function toIsoDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Builds a single Telegram MarkdownV2 message for a supplier's order group.
 */
function buildTelegramMessage(
  supplierName: string,
  orders: OrderViewOrder[],
  dateTelegram: string,
): string {
  const safeSupplierName = escapeMarkdownV2(supplierName);

  // ── Document title ───────────────────────────
  let message = `*ใบขอสั่งซื้อยา*\n\n`;

  // ── Addressing ──────────────────────────────
  message += `เรียน บริษัท ${safeSupplierName}\n`;
  message += `เรื่อง ขออนุมัติสั่งซื้อยา\n`;
  message += `ลงวันที่ ${dateTelegram}\n\n`;

  // ── Body ────────────────────────────────────
  message += `ด้วยงานเภสัชกรรม โรงพยาบาลสระโบสถ์\n`;
  message += `มีความประสงค์ขอสั่งซื้อยา ดังรายการต่อไปนี้\n\n`;
  message += `*รายละเอียดรายการยาที่ขอสั่งซื้อ*\n\n`;

  // ── Drug list ───────────────────────────────
  orders.forEach((order, index) => {
    const drugName = escapeMarkdownV2(order.drugs.name);
    const form = escapeMarkdownV2(order.drugs.form);
    const strength = escapeMarkdownV2(order.drugs.strength);
    const packaging = escapeMarkdownV2(order.packaging);
    const quantity = escapeMarkdownV2(order.quantity);
    const unit = escapeMarkdownV2(order.unit_count);

    message += `*${index + 1}\\.* *${drugName}*`;
    if (form)
      message += ` \\[${form}\\]`;
    if (strength)
      message += ` \\(${strength}\\)`;
    message += `\n`;

    if (packaging)
      message += `   หน่วยนับ: ${packaging}\n`;

    message += `   จำนวน: ${quantity} × ${unit}\n\n`;
  });

  // ── Footer ──────────────────────────────────
  message += `หมายเหตุ กรุณาออกบิลโดยไม่ลงวันที่\n\n`;
  message += `ขอแสดงความนับถือ\n`;
  message += `_งานเภสัชกรรม รพ\\.สระโบสถ์_`;

  return message;
}

// ─────────────────────────────────────────────
// Core action
// ─────────────────────────────────────────────

async function confirmAndSend(): Promise<void> {
  isSending.value = true;
  error.value = null;

  const successfulIds: number[] = [];

  try {
    const orderDate = new Date();
    const dateTelegram = formatThaiDate(orderDate);
    const dateForDatabase = toIsoDateString(orderDate);

    // Send a Telegram notification per supplier group
    for (const supplierName of Object.keys(props.groupedOrders)) {
      const group = props.groupedOrders[supplierName];
      if (!group)
        continue;

      const message = buildTelegramMessage(supplierName, group.orders, dateTelegram);

      // Collect IDs for this supplier group
      const groupOrderIds = group.orders.map(order => order.id);

      // Invoke Supabase Edge Function to send Telegram notification
      const { data: functionResponse, error: functionError } = await supabase.functions.invoke(
        'send-telegram-notify',
        { body: { message } },
      );

      if (functionError) {
        throw new Error(
          `Failed to send notification for ${supplierName}: ${functionError.message}`,
        );
      }

      // The edge function may return an error in the response body
      const responseBody = functionResponse as { error?: string } | null;
      if (responseBody?.error) {
        throw new Error(
          `Edge function returned an error for ${supplierName}: ${responseBody.error}`,
        );
      }

      // Notification succeeded — update DB for this supplier's orders immediately
      const { error: dbError } = await supabase
        .from('purchase_orders')
        .update({ status: 'สั่งแล้ว', order_date: dateForDatabase })
        .in('id', groupOrderIds);

      if (dbError) {
        console.error(`DB update failed for supplier "${supplierName}" after notification was sent.`, dbError);
        throw new Error(
          `Notification sent for ${supplierName}, but DB update failed: ${dbError.message}`,
        );
      }

      // Track successfully processed IDs
      successfulIds.push(...groupOrderIds);
    }

    emit('ordersSent');
  }
  catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';

    if (successfulIds.length > 0) {
      error.value = `${errorMsg} (${successfulIds.length} รายการถูกส่งและอัปเดตสำเร็จแล้ว)`;
    }
    else {
      error.value = errorMsg;
    }

    console.error('An error occurred in confirmAndSend:', err);
  }
  finally {
    isSending.value = false;
  }
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal-content card">
      <header class="modal-header">
        <h2>สรุปรายการสั่งซื้อ</h2>
        <button class="close-button" aria-label="ปิด" @click="emit('close')">
          &times;
        </button>
      </header>

      <div v-if="isSending" class="sending-state">
        <div class="spinner" />
        <p>กำลังส่งคำสั่งซื้อและแจ้งเตือนผ่าน Telegram...</p>
      </div>

      <div v-else class="order-summary-list">
        <div v-for="(group, supplierName) in groupedOrders" :key="supplierName" class="supplier-group">
          <h4>
            เรียน บริษัท <strong>{{ supplierName }}</strong>
          </h4>
          <p class="order-request-text">
            โรงพยาบาลสระโบสถ์ ขอความอนุเคราะห์ในการจัดซื้อยาตามรายการต่อไปนี้:
          </p>
          <ul>
            <li v-for="order in group.orders" :key="order.id">
              <span>
                {{ order.drugs.name }}
                <template v-if="order.drugs.form"> [{{ order.drugs.form }}]</template>
                <template v-if="order.drugs.strength"> ({{ order.drugs.strength }})</template>
                <template v-if="order.packaging"> / {{ order.packaging }}</template>
              </span>
              <span>จำนวน {{ order.quantity }} × {{ order.unit_count }}</span>
            </li>
          </ul>
        </div>
      </div>

      <div v-if="error" class="error-message">
        <strong>เกิดข้อผิดพลาด:</strong> {{ error }}
      </div>

      <footer class="modal-footer">
        <button class="btn btn-secondary" :disabled="isSending" @click="emit('close')">
          ยกเลิก
        </button>
        <button
          class="btn btn-primary"
          :disabled="isSending || Object.keys(groupedOrders).length === 0"
          @click="confirmAndSend"
        >
          {{ isSending ? 'กำลังส่ง...' : 'ยืนยันและส่งคำสั่งซื้อ' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
  padding: 1rem;
}

.modal-content {
  width: 100%;
  max-width: 700px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 1rem;
  margin-bottom: 1rem;
  flex-shrink: 0;
}

.close-button {
  background: none;
  border: none;
  font-size: 2rem;
  line-height: 1;
  cursor: pointer;
  color: var(--subtle-text-color);
}

.order-summary-list {
  overflow-y: auto;
  flex-grow: 1;
}

.supplier-group {
  margin-bottom: 2rem;
}

.supplier-group h4 {
  background-color: var(--bg-color);
  padding: 0.5rem 1rem;
  border-radius: 6px;
  margin: 0 0 0.5rem 0;
}

.order-request-text {
  color: var(--subtle-text-color);
  font-size: 0.9rem;
  margin: 0.5rem 0;
}

.supplier-group ul {
  list-style: none;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.supplier-group li {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
}

.supplier-group li:last-child {
  border-bottom: none;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.sending-state {
  text-align: center;
  padding: 3rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.spinner {
  border: 4px solid var(--border-color);
  border-top: 4px solid var(--primary-color);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.error-message {
  color: var(--status-pending-bg);
  background-color: color-mix(in srgb, var(--status-pending-bg) 20%, transparent);
  border: 1px solid var(--status-pending-bg);
  padding: 1rem;
  border-radius: 8px;
  margin-top: 1rem;
  word-break: break-word;
}
</style>
