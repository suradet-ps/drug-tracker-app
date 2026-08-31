<!-- src/components/AddOrderForm.vue -->
<script setup lang="ts">
import type { AddOrderFormData, DrugRow, ImportBatchRow, PurchaseOrderInsert, SupplierRow } from '@/types/database';

import { reactive, ref } from 'vue';
import { supabase } from '@/supabase/client';

const emit = defineEmits<{
  close: [];
  orderAdded: [];
}>();

const form = reactive<AddOrderFormData>({
  drugName: '',
  form: '',
  strength: '',
  supplierName: '',
  quantity: 1,
  unitCount: '',
  pricePerUnit: 0,
});

const isLoading = ref<boolean>(false);
const error = ref<string | null>(null);

const MANUAL_BATCH_NAME = 'Manual Add' as const;

async function handleSubmit(): Promise<void> {
  isLoading.value = true;
  error.value = null;

  // Validate minimum values for quantity and price
  if (form.quantity <= 0) {
    error.value = 'จำนวนต้องมากกว่า 0';
    isLoading.value = false;
    return;
  }

  if (form.pricePerUnit <= 0) {
    error.value = 'ราคาต่อหน่วยต้องมากกว่า 0';
    isLoading.value = false;
    return;
  }

  try {
    // 1. Upsert the manual import batch
    const { data: batchData, error: batchError } = await supabase
      .from('import_batches')
      .upsert({ file_name: MANUAL_BATCH_NAME }, { onConflict: 'file_name' })
      .select('*')
      .returns<ImportBatchRow[]>()
      .single();

    if (batchError)
      throw batchError;
    if (!batchData)
      throw new Error('ไม่สามารถสร้าง batch ได้');

    // 2. Upsert supplier
    const { data: supplierData, error: supplierError } = await supabase
      .from('suppliers')
      .upsert({ name: form.supplierName.trim() }, { onConflict: 'name' })
      .select('*')
      .returns<SupplierRow[]>()
      .single();

    if (supplierError)
      throw supplierError;
    if (!supplierData)
      throw new Error('ไม่สามารถสร้างข้อมูลบริษัทได้');

    // 3. Upsert drug
    const { data: drugData, error: drugError } = await supabase
      .from('drugs')
      .upsert(
        {
          name: form.drugName.trim(),
          form: form.form.trim() || null,
          strength: form.strength.trim() || null,
        },
        { onConflict: 'name,form,strength' },
      )
      .select('*')
      .returns<DrugRow[]>()
      .single();

    if (drugError)
      throw drugError;
    if (!drugData)
      throw new Error('ไม่สามารถสร้างข้อมูลยาได้');

    // 4. Insert purchase order
    const purchaseOrder: PurchaseOrderInsert = {
      import_batch_id: batchData.id,
      supplier_id: supplierData.id,
      drug_id: drugData.id,
      quantity: form.quantity,
      unit_count: form.unitCount.trim(),
      price_per_unit: form.pricePerUnit,
      total_price: form.quantity * form.pricePerUnit,
      status: 'ต้องสั่งซื้อ',
    };

    const { error: orderError } = await supabase
      .from('purchase_orders')
      .insert(purchaseOrder);

    if (orderError)
      throw orderError;

    // 5. Notify parent component
    emit('orderAdded');
    emit('close');
  }
  catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
    error.value = `เกิดข้อผิดพลาด: ${message}`;
  }
  finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="card add-form-card">
    <h3>เพิ่มรายการสั่งซื้อด้วยตนเอง</h3>
    <form @submit.prevent="handleSubmit">
      <div class="form-grid">
        <div class="form-group">
          <label for="drugName">ชื่อยา</label>
          <input id="drugName" v-model="form.drugName" type="text" class="form-input" required>
        </div>
        <div class="form-group">
          <label for="supplierName">บริษัท</label>
          <input id="supplierName" v-model="form.supplierName" type="text" class="form-input" required>
        </div>
        <div class="form-group">
          <label for="form">รูปแบบยา</label>
          <input id="form" v-model="form.form" type="text" class="form-input" placeholder="เช่น tab, inj">
        </div>
        <div class="form-group">
          <label for="strength">ความแรง</label>
          <input id="strength" v-model="form.strength" type="text" class="form-input" placeholder="เช่น 500 mg">
        </div>
        <div class="form-group">
          <label for="quantity">จำนวน</label>
          <input id="quantity" v-model.number="form.quantity" type="number" min="1" class="form-input" required>
        </div>
        <div class="form-group">
          <label for="unitCount">หน่วยนับ</label>
          <input
            id="unitCount" v-model="form.unitCount" type="text" class="form-input" required
            placeholder="เช่น 1, 100"
          >
        </div>
        <div class="form-group">
          <label for="pricePerUnit">ราคาต่อหน่วย</label>
          <input
            id="pricePerUnit" v-model.number="form.pricePerUnit" type="number" min="0.01" step="0.01"
            class="form-input" required
          >
        </div>
      </div>
      <div v-if="error" class="error-message">
        {{ error }}
      </div>
      <div class="button-container">
        <button type="button" class="btn btn-secondary" @click="emit('close')">
          ยกเลิก
        </button>
        <button type="submit" class="btn btn-primary" :disabled="isLoading">
          {{ isLoading ? 'กำลังบันทึก...' : 'เพิ่มรายการ' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.add-form-card {
  margin-bottom: 2rem;
  border: 1px solid var(--primary-color);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  font-size: 0.9rem;
}

.error-message {
  color: var(--status-pending-bg);
  margin-bottom: 1rem;
  text-align: center;
}

.button-container {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1rem;
}
</style>
