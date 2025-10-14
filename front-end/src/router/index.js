import { createRouter, createWebHistory } from 'vue-router'

const AgentStoreView = () => import('../views/AgentStoreView.vue')
const AgentDetailView = () => import('../views/AgentDetailView.vue')
const DashboardView = () => import('../views/DashboardView.vue')
const EvidenceView = () => import('../views/EvidenceView.vue')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/agents',
    },
    {
      path: '/agents',
      name: 'agent-store',
      component: AgentStoreView,
      meta: {
        title: 'Agent Store',
      },
    },
    {
      path: '/agents/:id',
      name: 'agent-detail',
      component: AgentDetailView,
      meta: {
        title: 'Agent Detail',
      },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardView,
      meta: {
        title: 'RC-B Dashboard',
      },
    },
    {
      path: '/evidence',
      name: 'evidence',
      component: EvidenceView,
      meta: {
        title: '证据回放',
      },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/agents',
    },
  ],
})

router.afterEach((to) => {
  if (to.meta?.title) {
    document.title = `${to.meta.title} · RC Demo`
  }
})

export default router
