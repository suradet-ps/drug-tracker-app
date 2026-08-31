import type { RouteRecordRaw } from 'vue-router';

import { createRouter, createWebHistory } from 'vue-router';
import { supabase } from '@/supabase/client';
import AuthView from '@/views/AuthView.vue';
import HistoryView from '@/views/HistoryView.vue';
import OrderView from '@/views/OrderView.vue';
import QuickOrderView from '@/views/QuickOrderView.vue';
import ReceiveView from '@/views/ReceiveView.vue';
// src/router/index.ts

// Augment route meta typing
declare module 'vue-router' {
  // eslint-disable-next-line ts/consistent-type-definitions
  interface RouteMeta {
    requiresAuth?: boolean;
  }
}

const routes: readonly RouteRecordRaw[] = [
  {
    path: '/auth',
    name: 'Auth',
    component: AuthView,
  },
  {
    path: '/quick-order',
    name: 'QuickOrder',
    component: QuickOrderView,
    meta: { requiresAuth: true },
  },
  {
    path: '/',
    name: 'Order',
    component: OrderView,
    meta: { requiresAuth: true },
  },
  {
    path: '/to-receive',
    name: 'Receive',
    component: ReceiveView,
    meta: { requiresAuth: true },
  },
  {
    path: '/history',
    name: 'History',
    component: HistoryView,
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes: [...routes],
});

// Navigation guard — redirects unauthenticated users to Auth,
// and authenticated users away from the Auth page.
router.beforeEach(async (to, _from, next) => {
  let session = null;

  try {
    const { data } = await supabase.auth.getSession();
    session = data.session;
  }
  catch (err) {
    console.error('Failed to retrieve auth session:', err);
  }

  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);

  if (requiresAuth && !session) {
    next({ name: 'Auth' });
  }
  else if (to.name === 'Auth' && session) {
    next({ name: 'Order' });
  }
  else {
    next();
  }
});

export default router;
