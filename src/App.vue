<!-- src/App.vue -->
<script setup lang="ts">
import type { Session } from '@supabase/supabase-js';

import { onMounted, onUnmounted, ref } from 'vue';
import NavBar from '@/components/NavBar.vue';
import Notification from '@/components/Notification.vue';
import { supabase } from '@/supabase/client';
import AuthView from '@/views/AuthView.vue';

const session = ref<Session | null>(null);
let authSubscription: { unsubscribe: () => void } | null = null;

onMounted(() => {
  supabase.auth.getSession()
    .then(({ data }) => {
      session.value = data.session;
    })
    .catch((err) => {
      console.error('Failed to retrieve auth session:', err);
    });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
    session.value = newSession;
  });

  authSubscription = subscription;
});

onUnmounted(() => {
  authSubscription?.unsubscribe();
});
</script>

<template>
  <div v-if="session" class="app-layout">
    <NavBar />
    <main class="content">
      <router-view />
    </main>
    <Notification />
  </div>
  <AuthView v-else />
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: var(--bg-color);
  transition: background-color 0.3s ease;
}

.content {
  flex-grow: 1;
  padding-top: 30px;
}
</style>
