<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { agentsById } from '../data/agents'
import { getKnowHowByAgent } from '../data/knowHow'
import { evidenceArchive } from '../data/evidence'

const route = useRoute()
const router = useRouter()

const agent = computed(() => agentsById[route.params.id])
const autopilotPercent = computed(() =>
  agent.value ? Math.round(agent.value.autopilotCoverage * 100) : 0,
)
const connectorCount = computed(() => (agent.value ? agent.value.connectors.length : 0))
const knowHow = computed(() => getKnowHowByAgent(route.params.id))
const agentEvidence = computed(() =>
  evidenceArchive.filter((item) => item.agentId === route.params.id),
)

const tabs = computed(() => {
  const base = [
    { label: '能力画像', value: 'overview' },
    { label: '典型流程', value: 'experience' },
    { label: 'ORB 指标', value: 'orb' },
  ]
  if (agentEvidence.value.length) {
    base.push({ label: '证据回放', value: 'evidence' })
  }
  return base
})

const activeTab = ref('overview')

function goBack() {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/agents')
  }
}

function onboardAgent() {
  if (!agent.value) return
  router.push({
    path: '/dashboard',
    query: { onboarded: agent.value.id },
  })
}

function setTab(value) {
  activeTab.value = value
}

function goEvidenceBoard() {
  if (!agent.value) return
  router.push({
    path: '/evidence',
    query: { suite: agent.value.suite, agent: agent.value.id },
  })
}
</script>

<template>
  <section class="page page--detail">
    <button class="detail__back" type="button" @click="goBack">返回 Agent Store</button>

    <div v-if="agent" class="detail__hero">
      <div class="detail__identity">
        <p class="detail__suite">{{ agent.suite }}</p>
        <h1 class="detail__name">{{ agent.name }}</h1>
        <p class="detail__title">{{ agent.title }}</p>
        <p class="detail__headline">{{ agent.headline }}</p>
        <p class="detail__summary">{{ agent.summary }}</p>
        <ul class="detail__tags">
          <li v-for="tag in agent.tags" :key="tag">{{ tag }}</li>
        </ul>
        <p class="detail__hint">{{ agent.workloadHint }}</p>
        <div class="detail__actions">
          <button class="btn btn--primary" type="button" @click="onboardAgent">一键上岗</button>
          <button class="btn btn--ghost" type="button" @click="router.push('/dashboard')">
            查看 ORB 流程
          </button>
        </div>
      </div>
      <aside class="detail__snapshot">
        <div class="snapshot-card">
          <span>Autopilot 覆盖率</span>
          <strong>{{ autopilotPercent }}%</strong>
          <div class="snapshot-progress">
            <div class="snapshot-progress__bar" :style="{ width: autopilotPercent + '%' }" />
          </div>
        </div>
        <div class="snapshot-card">
          <span>SLA</span>
          <strong>{{ agent.sla }}</strong>
        </div>
        <div class="snapshot-card">
          <span>连接器</span>
          <strong>{{ connectorCount }}</strong>
        </div>
        <div class="snapshot-card">
          <span>Outcome 指数</span>
          <strong>{{ agent.metrics.outcome }}</strong>
        </div>
      </aside>
    </div>

    <nav v-if="agent" class="detail__tabs">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        class="detail__tab"
        :class="{ active: activeTab === tab.value }"
        @click="setTab(tab.value)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <section v-if="agent && activeTab === 'overview'" class="detail__overview">
      <article class="detail__panel">
        <h3>模型能力栈</h3>
        <ul>
          <li><span>BR-LLM</span><span>{{ agent.modelStack.llm }}</span></li>
          <li><span>Speech</span><span>{{ agent.modelStack.speech }}</span></li>
          <li><span>Decision</span><span>{{ agent.modelStack.decision }}</span></li>
        </ul>
      </article>
      <article class="detail__panel">
        <h3>连接器</h3>
        <ul>
          <li v-for="connector in agent.connectors" :key="connector">{{ connector }}</li>
        </ul>
      </article>
      <article v-if="knowHow.length" class="detail__panel detail__panel--knowhow">
        <h3>行业 Know-how</h3>
        <ul>
          <li v-for="item in knowHow" :key="item">{{ item }}</li>
        </ul>
      </article>
    </section>

    <section v-if="agent && activeTab === 'experience'" class="detail__experience">
      <h2>典型流程节点</h2>
      <div class="detail__timeline">
        <article v-for="item in agent.experience" :key="item.title" class="timeline-item">
          <h3>{{ item.title }}</h3>
          <p>{{ item.detail }}</p>
        </article>
      </div>
    </section>

    <section v-if="agent && activeTab === 'orb'" class="detail__orb">
      <h2>ORB 跟踪指标</h2>
      <div class="orb-grid">
        <div class="orb-card">
          <p class="orb-card__label">Outcome 指数</p>
          <p class="orb-card__value">{{ agent.metrics.outcome }}</p>
        </div>
        <div class="orb-card">
          <p class="orb-card__label">CpR</p>
          <p class="orb-card__value">{{ agent.metrics.cpr }}</p>
        </div>
        <div class="orb-card">
          <p class="orb-card__label">当月 Bill (¥)</p>
          <p class="orb-card__value">{{ agent.metrics.bill.toLocaleString() }}</p>
        </div>
        <div class="orb-card">
          <p class="orb-card__label">自动化触点</p>
          <p class="orb-card__value">{{ agent.metrics.cps }}</p>
        </div>
        <div class="orb-card">
          <p class="orb-card__label">证据回放</p>
          <p class="orb-card__value">{{ agent.metrics.evidenceReplies }}</p>
        </div>
      </div>
    </section>

    <section v-if="agent && activeTab === 'evidence'" class="detail__evidence">
      <header>
        <h2>最新证据回放</h2>
        <button class="btn btn--ghost" type="button" @click="goEvidenceBoard">跳转 Evidence Board</button>
      </header>
      <ul class="detail__evidence-list">
        <li v-for="item in agentEvidence" :key="item.id">
          <div>
            <p class="detail__evidence-title">{{ item.title }}</p>
            <p class="detail__evidence-summary">{{ item.summary }}</p>
          </div>
          <span class="detail__evidence-meta">{{ item.type }} · {{ item.metric }} · {{ item.timestamp }}</span>
        </li>
      </ul>
      <p v-if="!agentEvidence.length" class="detail__evidence-empty">暂无证据记录，进入 Evidence Board 查看更多。</p>
    </section>

    <section v-else-if="!agent" class="detail__empty">
      <h1>未找到该硅基员工</h1>
      <p>请返回 Agent Store 选择其他角色。</p>
      <button class="btn btn--primary" type="button" @click="router.push('/agents')">
        返回列表
      </button>
    </section>
  </section>
</template>
