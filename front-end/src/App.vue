<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const navItems = [
  { name: 'Agent Store', path: '/agents' },
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Evidence', path: '/evidence' },
]

const activePath = computed(() => route.path)
</script>

<template>
  <div class="app-shell">
    <header class="top-bar">
      <div class="brand">
        <span class="brand-mark">RC</span>
        <div class="brand-meta">
          <p class="brand-title">RC Demo · ORB 闭环</p>
          <p class="brand-subtitle">Outcome · Role · Bill</p>
        </div>
      </div>
      <nav class="nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-link"
          :class="{ active: activePath.startsWith(item.path) }"
        >
          {{ item.name }}
        </RouterLink>
      </nav>
      <div class="orb-indicator">
        <span class="orb-dot" aria-hidden="true" />
        <div>
          <p class="orb-label">ORB 实时监控</p>
          <p class="orb-value">Outcome · Role · Bill</p>
        </div>
      </div>
    </header>
    <main class="view-shell">
      <RouterView />
    </main>
  </div>
</template>
