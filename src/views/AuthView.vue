<!-- src/views/AuthView.vue -->
<script setup lang="ts">
import { supabase } from '@/supabase/client';
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const email = ref<string>('');
const password = ref<string>('');
const message = ref<string>('');
const isLoading = ref<boolean>(false);
const router = useRouter();

async function handleLogin(): Promise<void> {
  isLoading.value = true;
  message.value = '';
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    });
    if (error)
      throw error;
    router.push('/');
  }
  catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
    message.value = `เกิดข้อผิดพลาด: ${errorMessage}`;
  }
  finally {
    isLoading.value = false;
  }
}

async function handleRegister(): Promise<void> {
  isLoading.value = true;
  message.value = '';
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
    });
    if (error)
      throw error;

    // Only navigate if a session/user is present (email confirmation may be required)
    if (data?.session || data?.user) {
      router.push('/');
    }
    else {
      message.value = 'ลงทะเบียนสำเร็จ! กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชีของคุณก่อนเข้าสู่ระบบ';
    }
  }
  catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
    message.value = `เกิดข้อผิดพลาด: ${errorMessage}`;
  }
  finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="auth-container">
    <div class="auth-card card">
      <h1 class="title">
        Tracker
      </h1>
      <p class="subtitle">
        กรุณาเข้าสู่ระบบเพื่อใช้งาน
      </p>

      <div v-if="message" class="message">
        {{ message }}
      </div>

      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="email">อีเมล</label>
          <input id="email" v-model="email" type="email" placeholder="you@example.com" class="form-input">
        </div>

        <div class="form-group">
          <label for="password">รหัสผ่าน</label>
          <input id="password" v-model="password" type="password" placeholder="••••••••" class="form-input">
        </div>

        <div class="button-group">
          <button type="submit" class="btn btn-primary" :disabled="isLoading">
            {{ isLoading ? 'กำลังโหลด...' : 'เข้าสู่ระบบ' }}
          </button>
          <button type="button" class="btn btn-secondary" :disabled="isLoading" @click="handleRegister">
            ลงทะเบียน
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 1rem;
  background-color: var(--bg-color);
}

.auth-card {
  width: 100%;
  max-width: 420px;
}

.title {
  font-size: 1.8rem;
  font-weight: 600;
  text-align: center;
  margin-bottom: 0.5rem;
  color: var(--text-color);
}

.subtitle {
  text-align: center;
  color: var(--subtle-text-color);
  margin-bottom: 2rem;
}

.message {
  padding: 1rem;
  margin-bottom: 1rem;
  border-radius: 8px;
  background-color: color-mix(in srgb, var(--accent-color) 30%, transparent);
  color: var(--secondary-text-color);
  border: 1px solid var(--accent-color);
  word-break: break-all;
  font-size: 0.9rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.button-group {
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
