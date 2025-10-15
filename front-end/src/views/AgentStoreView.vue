<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AgentCard from '../components/cards/AgentCard.vue'
import { agents, groupAgentsBySuite, toSuiteAnchor } from '../data/agents'
import { computeSuiteMetrics } from '../data/suiteMetrics'

const keyword = ref('')
const selectedSuite = ref('')
const route = useRoute()
const router = useRouter()

const suiteSnapshot = computed(() => computeSuiteMetrics(agents))
const globalSnapshot = computed(() => suiteSnapshot.value.global)
const suiteOverview = computed(() => suiteSnapshot.value.suites)

const groupedSuites = computed(() =>
  Object.values(groupAgentsBySuite()).map((group) => ({
    ...group,
    anchor: toSuiteAnchor(group.suite),
  })),
)

const filteredGroups = computed(() => {
  const term = keyword.value.trim().toLowerCase()
  let groups = groupedSuites.value
  if (selectedSuite.value) {
    groups = groups.filter((group) => group.suite === selectedSuite.value)
  }
  if (!term) {
    return groups
  }
  return groups
    .map((group) => ({
      ...group,
      agents: group.agents.filter((agent) =>
        [agent.name, agent.title, agent.tags.join(','), agent.headline]
          .join(' ')
          .toLowerCase()
          .includes(term),
      ),
    }))
    .filter((group) => group.agents.length > 0)
})

const totalAgents = agents.length
const visibleAgents = computed(() =>
  filteredGroups.value.reduce((sum, group) => sum + group.agents.length, 0),
)

const quickSuites = computed(() =>
  suiteOverview.value.map((suite) => ({
    label: suite.alias || suite.suite,
    suite: suite.suite,
    autopilot: suite.autopilot,
    outcome: suite.outcome,
    count: suite.agents,
    anchor: toSuiteAnchor(suite.suite),
  })),
)

function setSuite(value) {
  const nextValue = selectedSuite.value === value ? '' : value
  selectedSuite.value = nextValue
  const nextQuery = { ...route.query }
  if (nextValue) {
    nextQuery.suite = nextValue
  } else {
    delete nextQuery.suite
    delete nextQuery.action
  }
  router.replace({ query: nextQuery })
}

const staffingBanner = computed(() => {
  const suiteKey = route.query.suite
  const action = route.query.action
  if (!suiteKey || !action) return ''
  const targetSuite = suiteOverview.value.find((item) => item.suite === suiteKey)
  const label = targetSuite?.alias || suiteKey
  if (action === 'increase') {
    return `${label} 建议调度加人，查看套系内硅基员工补位。`
  }
  if (action === 'decrease') {
    return `${label} 建议精简人力，确认 Autopilot 稳定后调配班次。`
  }
  return ''
})

watch(
  () => route.query.suite,
  (suite) => {
    selectedSuite.value = (suite ?? '')
    if (suite) {
      nextTick(() => {
        const anchor = toSuiteAnchor(suite)
        const target = document.getElementById(anchor)
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      })
    }
  },
  { immediate: true },
)
</script>

<template>
  <section class="page page--store">
    <header class="page__hero page__hero--compact">
      <div class="page__hero-text">
        <p class="page__eyebrow">Agent Store</p>
        <h1 class="page__title">硅基员工阵列，即刻一键上岗</h1>
        <p class="page__subtitle">快速浏览 BR 套系硅基员工，了解模型能力、SLA 指标与 Autopilot 覆盖率，匹配业务所需角色。</p>
      </div>
      <div class="page__hero-stats">
        <article class="hero-stat">
          <span>Autopilot 平均</span>
          <strong>{{ globalSnapshot.autopilot }}%</strong>
        </article>
        <article class="hero-stat">
          <span>Outcome 平均</span>
          <strong>{{ globalSnapshot.outcomeIndex }}</strong>
        </article>
        <article class="hero-stat">
          <span>可上岗角色</span>
          <strong>{{ totalAgents }}</strong>
        </article>
      </div>
    </header>

    <div class="store__toolbar">
      <label class="store__search">
        <span class="store__search-label">快速检索</span>
        <input
          v-model.trim="keyword"
          type="search"
          placeholder="输入关键词（角色、能力、套系）"
        />
      </label>
      <p class="store__hint">已接入 ORB 指挥舱 · Outcome · Role · Bill 实时联动</p>
    </div>

    <p v-if="staffingBanner" class="store__hint store__hint--action">{{ staffingBanner }}</p>

    <nav class="store__nav">
      <button
        v-for="suite in quickSuites"
        :key="suite.suite"
        type="button"
        class="store__nav-chip"
        :class="{ active: selectedSuite === suite.suite }"
        @click="setSuite(suite.suite)"
      >
        <span class="store__nav-label">{{ suite.label }}</span>
        <span class="store__nav-meta">{{ suite.count }} · Autopilot {{ suite.autopilot }}%</span>
      </button>
      <button type="button" class="store__nav-reset" @click="setSuite('')">全部套系</button>
    </nav>

    <p class="store__result-hint">当前展示 {{ visibleAgents }} / {{ totalAgents }} 位硅基员工</p>

    <div class="store__groups">
      <div v-for="group in filteredGroups" :id="group.anchor" :key="group.suite" class="store__group">
        <header class="store__group-header">
          <h2>{{ group.suite }}</h2>
          <p>{{ group.description }}</p>
        </header>
        <div class="store__cards">
          <AgentCard v-for="agent in group.agents" :key="agent.id" :agent="agent" />
        </div>
      </div>
      <p v-if="filteredGroups.length === 0" class="store__empty">暂未找到匹配的硅基员工。</p>
    </div>
  </section>
</template>
