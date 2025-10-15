<script setup>
import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { evidenceArchive } from '../data/evidence'
import { agents } from '../data/agents'
import { computeSuiteMetrics } from '../data/suiteMetrics'

const router = useRouter()
const route = useRoute()

const suiteMetrics = computed(() => computeSuiteMetrics(agents).suites)
const suiteAliasMap = computed(() => {
  const map = new Map()
  suiteMetrics.value.forEach((suite) => {
    map.set(suite.suite, suite.alias || suite.suite)
  })
  return map
})

const suiteOptions = computed(() =>
  suiteMetrics.value.map((suite) => ({ label: suite.alias || suite.suite, value: suite.suite })),
)
const agentOptions = computed(() =>
  agents.map((agent) => ({ label: agent.name, value: agent.id, suite: agent.suite })),
)

const filters = ref({
  suite: route.query.suite || '',
  agent: route.query.agent || '',
  type: route.query.type || '',
})

const flaggedEvidence = ref(new Set())

const highlightCards = computed(() =>
  evidenceArchive.slice(0, 4).map((item) => ({
    ...item,
    suiteAlias: suiteAliasMap.value.get(item.suite) || item.suite,
  })),
)

const filteredEvidence = computed(() => {
  const { suite, agent, type } = filters.value
  return evidenceArchive
    .filter((item) => (!suite || item.suite === suite) && (!agent || item.agentId === agent) && (!type || item.type === type))
    .map((item) => ({
      ...item,
      suiteAlias: suiteAliasMap.value.get(item.suite) || item.suite,
      agentName: agents.find((agentMeta) => agentMeta.id === item.agentId)?.name || item.agentId,
    }))
})

const groupedEvidence = computed(() => {
  const groups = []
  const map = new Map()
  filteredEvidence.value.forEach((item) => {
    if (!map.has(item.suite)) {
      const group = {
        suite: item.suite,
        alias: item.suiteAlias,
        items: [],
      }
      map.set(item.suite, group)
      groups.push(group)
    }
    map.get(item.suite).items.push(item)
  })
  return groups
})

const totalVisible = computed(() => filteredEvidence.value.length)
const visibleFlagged = computed(() =>
  filteredEvidence.value.filter((item) => flaggedEvidence.value.has(item.id)).length,
)

function updateFilters(partial) {
  filters.value = { ...filters.value, ...partial }
  router.replace({
    path: route.path,
    query: {
      suite: filters.value.suite || undefined,
      agent: filters.value.agent || undefined,
      type: filters.value.type || undefined,
    },
  })
}

function resetFilters() {
  updateFilters({ suite: '', agent: '', type: '' })
}

function toggleFlag(id) {
  const next = new Set(flaggedEvidence.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  flaggedEvidence.value = next
}

function isFlagged(id) {
  return flaggedEvidence.value.has(id)
}

function exportReport() {
  const payload = filteredEvidence.value.map((item) => ({
    suite: item.suiteAlias,
    agent: item.agentName,
    metric: item.metric,
    type: item.type,
    timestamp: item.timestamp,
  }))
  console.table(payload)
  alert(`已将 ${payload.length} 条证据导出到控制台（示例占位）`)
}

const availableTypes = [
  '对话转写',
  '多通道通知',
  '策略轨迹',
  '语音摘要',
  '流程回放',
  '文档比对',
  '旅程数据',
  '对话纪要',
  '审批报告',
  '个人执行',
]
</script>

<template>
  <section class="page page--evidence">
    <header class="page__hero page__hero--compact evidence__hero">
      <div class="page__hero-text">
        <p class="page__eyebrow">Evidence Board</p>
        <h1 class="page__title">证据回放 · 执行复盘</h1>
        <p class="page__subtitle">汇总硅基员工执行证据，支持套系 / Agent / 类型筛选，输出运营与合规复盘报告。</p>
      </div>
      <div class="evidence__highlights">
        <h2>实时亮点</h2>
        <div class="evidence__highlight-grid">
          <article v-for="item in highlightCards" :key="item.id" class="highlight-card">
            <div class="highlight-card__header">
              <span class="highlight-card__suite">{{ item.suiteAlias }}</span>
              <span class="highlight-card__metric">{{ item.metric }}</span>
            </div>
            <p class="highlight-card__title">{{ item.title }}</p>
            <span class="highlight-card__meta">{{ item.type }} · {{ item.timestamp }}</span>
          </article>
        </div>
      </div>
    </header>

    <section class="evidence__filters">
      <div class="evidence__filters-controls">
        <label>
          <span>套系</span>
          <select v-model="filters.suite" @change="updateFilters({ suite: filters.suite })">
            <option value="">全部</option>
            <option v-for="option in suiteOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <label>
          <span>硅基员工</span>
          <select v-model="filters.agent" @change="updateFilters({ agent: filters.agent })">
            <option value="">全部</option>
            <option
              v-for="option in agentOptions"
              :key="option.value"
              :value="option.value"
              v-if="!filters.suite || option.suite === filters.suite"
            >
              {{ option.label }}
            </option>
          </select>
        </label>
        <label>
          <span>证据类型</span>
          <select v-model="filters.type" @change="updateFilters({ type: filters.type })">
            <option value="">全部</option>
            <option v-for="type in availableTypes" :key="type" :value="type">{{ type }}</option>
          </select>
        </label>
      </div>
      <div class="evidence__filters-actions">
        <button class="btn btn--ghost" type="button" @click="resetFilters">重置</button>
        <button class="btn btn--primary" type="button" @click="exportReport">导出报告</button>
      </div>
    </section>

    <div class="evidence__summary">
      <span class="summary-chip">当前展示 {{ totalVisible }} 条记录</span>
      <span class="summary-chip">已标记 {{ visibleFlagged }} 条</span>
    </div>

    <section class="evidence__timeline">
      <header>
        <h2>证据时间线</h2>
        <p>按套系统合展示最新证据，便于快速筛查亮点与异常。</p>
      </header>
      <div class="timeline-groups">
        <div v-for="group in groupedEvidence" :key="group.suite" class="timeline-group">
          <div class="timeline-group__header">
            <h3>{{ group.alias }}</h3>
            <span>{{ group.items.length }} 条记录</span>
          </div>
          <ul class="timeline">
            <li v-for="item in group.items" :key="item.id" class="timeline__item">
              <div class="timeline__time">{{ item.timestamp }}</div>
              <article class="timeline__card">
                <header>
                  <p class="timeline__suite">{{ item.agentName }}</p>
                  <span class="timeline__type">{{ item.type }}</span>
                </header>
                <h3>{{ item.title }}</h3>
                <p>{{ item.summary }}</p>
                <footer>
                  <div class="timeline__meta">
                    <span><strong>{{ item.metric }}</strong></span>
                    <span>{{ item.type }}</span>
                    <span>{{ item.timestamp }}</span>
                  </div>
                  <div class="timeline__actions">
                    <RouterLink :to="`/agents/${item.agentId}`">查看员工</RouterLink>
                    <RouterLink :to="`/agents#${group.suite}`">查看套系</RouterLink>
                    <button
                      type="button"
                      class="timeline__tag"
                      :class="{ active: isFlagged(item.id) }"
                      @click="toggleFlag(item.id)"
                    >
                      {{ isFlagged(item.id) ? '已标记' : '标记' }}
                    </button>
                    <button type="button" class="timeline__pin">加入亮点</button>
                  </div>
                </footer>
              </article>
            </li>
          </ul>
        </div>
      </div>
      <p v-if="!groupedEvidence.length" class="evidence__empty">暂无符合筛选条件的证据。（可尝试更换筛选条件）</p>
    </section>
  </section>
</template>
