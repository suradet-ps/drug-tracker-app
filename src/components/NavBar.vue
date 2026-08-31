<!-- src/components/NavBar.vue -->
<script setup lang="ts">
import type { User } from '@supabase/supabase-js';

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useTheme } from '@/composables/use-theme';
import { supabase } from '@/supabase/client';

const user = ref<User | null>(null);
const router = useRouter();
const isMenuOpen = ref<boolean>(false);
const { isDark, toggleTheme } = useTheme();

onMounted(async (): Promise<void> => {
  const { data } = await supabase.auth.getUser();
  user.value = data.user;
});

async function handleLogout(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error)
      throw error;
    router.push({ name: 'Auth' });
  }
  catch (err: unknown) {
    console.error('Logout failed:', err);
  }
}

function toggleMenu(): void {
  isMenuOpen.value = !isMenuOpen.value;
}

function closeMenu(): void {
  isMenuOpen.value = false;
}
</script>

<template>
  <header class="navbar">
    <div class="navbar-container">
      <div class="navbar-brand">
        Tracker
      </div>

      <!-- Mobile Menu Toggle Button -->
      <button class="mobile-nav-toggle" aria-label="Toggle navigation" @click="toggleMenu">
        <span class="hamburger-icon" />
      </button>

      <!-- Navigation Links -->
      <nav class="nav-links" :class="{ 'is-open': isMenuOpen }">
        <router-link to="/quick-order" @click="closeMenu">
          สร้างใบสั่งซื้อด่วน
        </router-link>
        <router-link to="/" @click="closeMenu">
          รายการต้องสั่งซื้อ
        </router-link>
        <router-link to="/to-receive" @click="closeMenu">
          รายการรอรับของ
        </router-link>
        <router-link to="/history" @click="closeMenu">
          ประวัติ
        </router-link>
      </nav>

      <!-- User Info and Actions -->
      <div class="user-actions">
        <span v-if="user" class="user-email">{{ user.email }}</span>
        <button
          class="theme-toggle"
          :aria-label="`Switch to ${isDark ? 'light' : 'dark'} mode`"
          @click="toggleTheme"
        >
          <!-- Moon icon (shown in dark mode) -->
          <svg
            v-if="isDark"
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
          <!-- Sun icon (shown in light mode) -->
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        </button>
        <button class="logout-button" @click="handleLogout">
          ออกจากระบบ
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.navbar {
  background-color: var(--card-bg-color);
  box-shadow: 0 2px 8px var(--shadow-color);
  height: 64px;
  padding: 0 1.5rem;
  position: sticky;
  top: 0;
  z-index: 1000;
  transition: background-color 0.3s ease;
}

.navbar-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.navbar-brand {
  font-size: 1.7rem;
  font-weight: 700;
  color: var(--primary-color);
}

.nav-links {
  display: flex;
  gap: 2rem;
}

.nav-links a {
  text-decoration: none;
  color: var(--text-color);
  font-weight: 500;
  padding: 0.5rem 0;
  position: relative;
  transition: color 0.2s;
}

.nav-links a::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background-color: var(--primary-color);
  transform: scaleX(0);
  transform-origin: bottom right;
  transition: transform 0.25s ease-out;
}

.nav-links a:hover,
.nav-links a.router-link-active {
  color: var(--primary-color);
}

.nav-links a:hover::after,
.nav-links a.router-link-active::after {
  transform: scaleX(1);
  transform-origin: bottom left;
}

.user-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-email {
  color: var(--subtle-text-color);
  font-size: 0.9rem;
  display: none;
}

@media (min-width: 1024px) {
  .user-email {
    display: inline;
  }
}

.theme-toggle,
.logout-button {
  background: none;
  border: 1px solid var(--border-color);
  color: var(--subtle-text-color);
  border-radius: 8px;
  cursor: pointer;
  height: 38px;
  padding: 0 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background-color 0.2s,
    color 0.2s,
    border-color 0.2s;
}

.theme-toggle:hover,
.logout-button:hover {
  background-color: var(--bg-color);
  color: var(--primary-color);
  border-color: var(--primary-color);
}

.logout-button {
  border-color: var(--status-pending-bg);
  color: var(--status-pending-bg);
}

.logout-button:hover {
  background-color: var(--status-pending-bg);
  color: var(--card-bg-color);
}

/* Mobile Navigation Styles */
.mobile-nav-toggle {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  z-index: 1001;
}

.hamburger-icon {
  display: block;
  width: 24px;
  height: 2px;
  background-color: var(--text-color);
  position: relative;
  transition: background-color 0s 0.2s;
}

.hamburger-icon::before,
.hamburger-icon::after {
  content: '';
  position: absolute;
  left: 0;
  width: 100%;
  height: 2px;
  background-color: var(--text-color);
  transition:
    transform 0.2s,
    top 0.2s 0.2s;
}

.hamburger-icon::before {
  top: -8px;
}

.hamburger-icon::after {
  top: 8px;
}

@media (max-width: 768px) {
  .nav-links {
    position: fixed;
    top: 64px;
    left: 0;
    width: 100%;
    height: calc(100vh - 64px);
    background-color: var(--card-bg-color);
    flex-direction: column;
    align-items: center;
    padding-top: 2rem;
    gap: 1.5rem;
    transform: translateX(100%);
    transition: transform 0.3s ease-in-out;
  }

  .nav-links.is-open {
    transform: translateX(0);
  }

  .nav-links a {
    font-size: 1.2rem;
  }

  .mobile-nav-toggle {
    display: block;
  }

  .is-open + .user-actions .mobile-nav-toggle .hamburger-icon,
  .mobile-nav-toggle.is-open .hamburger-icon {
    background-color: transparent;
  }

  .is-open + .user-actions .mobile-nav-toggle .hamburger-icon::before,
  .mobile-nav-toggle.is-open .hamburger-icon::before {
    top: 0;
    transform: rotate(45deg);
    transition:
      top 0.2s,
      transform 0.2s 0.2s;
  }

  .is-open + .user-actions .mobile-nav-toggle .hamburger-icon::after,
  .mobile-nav-toggle.is-open .hamburger-icon::after {
    top: 0;
    transform: rotate(-45deg);
    transition:
      top 0.2s,
      transform 0.2s 0.2s;
  }

  .user-email {
    display: none;
  }
}
</style>
