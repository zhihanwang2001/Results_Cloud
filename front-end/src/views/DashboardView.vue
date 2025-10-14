<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import * as echarts from 'echarts/core'
import { LineChart, PieChart, BarChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { agents } from '../data/agents'
import { computeSuiteMetrics } from '../data/suiteMetrics'

echarts.use([LineChart, PieChart, BarChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer])

const router = useRouter()
const route = useRoute()

const boardData = computed(() => computeSuiteMetrics(agents))
const orbSnapshot = computed(() => boardData.value.global)
const suiteMatrix = computed(() => boardData.value.suites)

const quickSuites = computed(() =>
  suiteMatrix.value.slice(0, 4).map((suite) => ({
    anchor: suite.anchor,
    label: suite.alias || suite.suite,
    autopilot: suite.autopilot,
    outcome: suite.outcome,
  })),
)

function navigateToSuite(anchor) {
  if (!anchor) return
  router.push(`/agents#${anchor}`)
}

const autopilotSeries = computed(() => ({
  categories: suiteMatrix.value.map((suite) => suite.alias || suite.suite),
  values: suiteMatrix.value.map((suite) => suite.autopilot),
}))

const billShareSeries = computed(() =>
  suiteMatrix.value.map((suite) => ({
    value: suite.bill,
    name: suite.alias || suite.suite,
  })),
)

const outcomeTimeline = computed(() => {
  const baseOutcome = orbSnapshot.value.outcomeIndex || 80
  const months = Array.from({ length: 6 }, (_, idx) => {
    const date = new Date()
    date.setMonth(date.getMonth() - (5 - idx))
    return `${date.getMonth() + 1}月`
  })
  const outcomeSeries = months.map((_, idx) => Math.max(60, Math.round(baseOutcome + (idx - 3) * 2 + (idx % 2 === 0 ? 3 : -2))))
  const conversionSeries = months.map((_, idx) => parseFloat(((idx - 2) * 1.8).toFixed(1)))
  return { months, outcomeSeries, conversionSeries }
})

const riskAlerts = computed(() => {
  const alerts = []
  suiteMatrix.value.forEach((suite) => {
    if (suite.autopilot < 75) {
      alerts.push({
        severity: 'high',
        title: `${suite.alias || suite.suite} Autopilot 覆盖偏低`,
        detail: `覆盖率 ${suite.autopilot}% · 与目标差 ${suite.autopilotGap}%`,
        link: `/agents#${suite.anchor}`,
      })
    }
    if (suite.cpr < 0.7) {
      alerts.push({
        severity: 'warning',
        title: `${suite.alias || suite.suite} CpR 告警`,
        detail: `当前 CpR ${suite.cpr.toFixed(2)} · 建议复盘证据。`,
        link: `/agents#${suite.anchor}`,
      })
    }
  })
  return alerts.slice(0, 5)
})

const strategyConsole = computed(() =>
  suiteMatrix.value
    .map((suite) => ({
      suite: suite.suite,
      alias: suite.alias || suite.suite,
      anchor: suite.anchor,
      autopilot: suite.autopilot,
      outcome: suite.outcome,
      cpr: suite.cpr,
    }))
    .sort((a, b) => b.outcome - a.outcome),
)

const onboardedAgentId = computed(() => route.query.onboarded)
const suiteImpactRows = computed(() =>
  suiteMatrix.value.map((suite) => ({
    suite: suite.suite,
    alias: suite.alias || suite.suite,
    anchor: suite.anchor,
    headcount: suite.agents,
    autopilot: suite.autopilot,
    outcome: suite.outcome,
    conversionLift: suite.conversionLift,
    cpr: suite.cpr,
    bill: suite.bill,
  })),
)

const onboardedAgent = computed(() =>
  onboardedAgentId.value ? agents.find((item) => item.id === onboardedAgentId.value) : null,
)
const onboardedSuite = computed(() =>
  onboardedAgent.value
    ? suiteMatrix.value.find((suite) => suite.suite === onboardedAgent.value.suite)
    : null,
)
const showOnboardToast = ref(false)

watch(
  onboardedAgent,
  (agent) => {
    if (agent) {
      showOnboardToast.value = true
    }
  },
  { immediate: true },
)

function closeOnboardToast() {
  showOnboardToast.value = false
  if (onboardedAgentId.value) {
    const nextQuery = { ...route.query }
    delete nextQuery.onboarded
    router.replace({ path: route.path, query: nextQuery })
  }
}

const autopilotChart = ref(null)
const billPieChart = ref(null)
const outcomeChart = ref(null)
let autopilotInstance = null
let billInstance = null
let outcomeInstance = null

function renderAutopilotChart() {
  if (!autopilotChart.value) return
  if (!autopilotInstance) {
    autopilotInstance = echarts.init(autopilotChart.value)
  }
  autopilotInstance.setOption({
    grid: { left: 40, right: 20, top: 30, bottom: 40 },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: autopilotSeries.value.categories, axisLabel: { color: '#475569' } },
    yAxis: { type: 'value', max: 100, axisLabel: { color: '#475569' } },
    series: [
      {
        type: 'line',
        data: autopilotSeries.value.values,
        smooth: true,
        areaStyle: {},
        lineStyle: { color: '#2563eb' },
        itemStyle: { color: '#2563eb' },
      },
    ],
  })
}

function renderBillChart() {
  if (!billPieChart.value) return
  if (!billInstance) {
    billInstance = echarts.init(billPieChart.value)
  }
  billInstance.setOption({
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { color: '#475569' } },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        data: billShareSeries.value,
      },
    ],
  })
}

function renderOutcomeChart() {
  if (!outcomeChart.value) return
  if (!outcomeInstance) {
    outcomeInstance = echarts.init(outcomeChart.value)
  }
  outcomeInstance.setOption({
    grid: { left: 50, right: 40, top: 40, bottom: 60 },
    tooltip: { trigger: 'axis' },
    legend: { top: 0, textStyle: { color: '#475569' } },
    xAxis: { type: 'category', data: outcomeTimeline.value.months, axisLabel: { color: '#475569' } },
    yAxis: [
      { type: 'value', name: 'Outcome', axisLabel: { color: '#475569' } },
      { type: 'value', name: '转化提升 %', axisLabel: { color: '#475569' } },
    ],
    series: [
      {
        name: 'Outcome',
        type: 'bar',
        data: outcomeTimeline.value.outcomeSeries,
        itemStyle: { color: '#7c3aed' },
        barWidth: 24,
      },
      {
        name: '转化提升',
        type: 'line',
        data: outcomeTimeline.value.conversionSeries,
        yAxisIndex: 1,
        lineStyle: { color: '#22c55e' },
        itemStyle: { color: '#22c55e' },
        smooth: true,
      },
    ],
  })
}

function initCharts() {
  renderAutopilotChart()
  renderBillChart()
  renderOutcomeChart()
}

function resizeCharts() {
  autopilotInstance?.resize()
  billInstance?.resize()
  outcomeInstance?.resize()
}

onMounted(() => {
  initCharts()
  window.addEventListener('resize', resizeCharts)
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeCharts)
})

watch([autopilotSeries, billShareSeries, outcomeTimeline], initCharts)
</script>

<template>
  <section class="screen screen--charts">
    <transition name="toast">
      <div v-if="showOnboardToast && onboardedAgent" class="onboard-toast">
        <div class="onboard-toast__content">
          <p class="onboard-toast__title">{{ onboardedAgent.name }} 已一键上岗</p>
          <p class="onboard-toast__meta">已接入 ORB 指挥舱 · Autopilot 覆盖 {{ Math.round(onboardedAgent.autopilotCoverage * 100) }}%</p>
        </div>
        <div class="onboard-toast__actions">
          <RouterLink :to="`/agents/${onboardedAgent.id}`" class="onboard-toast__link" @click="closeOnboardToast">查看简历</RouterLink>
          <RouterLink
            v-if="onboardedSuite?.anchor"
            :to="`/agents#${onboardedSuite.anchor}`"
            class="onboard-toast__link"
            @click="closeOnboardToast"
          >查看套系</RouterLink>
          <button type="button" class="onboard-toast__close" @click="closeOnboardToast">×</button>
        </div>
      </div>
    </transition>

    <header class="page__hero page__hero--compact screen__hero">
      <div class="page__hero-text">
        <p class="page__eyebrow">RC-B 指挥舱</p>
        <h1 class="page__title">ORB 数据中枢</h1>
        <p class="page__subtitle">实时掌握 Outcome · Role · Bill 指标与执行态势。</p>
      </div>
      <div class="screen__hero-cards">
        <article>
          <span>ORB 指数</span>
          <strong>{{ orbSnapshot.outcomeIndex }}</strong>
        </article>
        <article>
          <span>本月 Bill</span>
          <strong>¥ {{ orbSnapshot.bill.toLocaleString() }}</strong>
        </article>
        <article>
          <span>Autopilot 覆盖</span>
          <strong>{{ orbSnapshot.autopilot }}%</strong>
        </article>
        <article>
          <span>平均 CpR</span>
          <strong>{{ orbSnapshot.cpr }}</strong>
        </article>
      </div>
    </header>

    <nav v-if="quickSuites.length" class="screen__quick-nav">
      <RouterLink
        v-for="item in quickSuites"
        :key="item.anchor"
        :to="`/agents#${item.anchor}`"
        class="quick-nav__item"
      >
        <span class="quick-nav__label">{{ item.label }}</span>
        <span class="quick-nav__meta">Outcome {{ item.outcome }} · Autopilot {{ item.autopilot }}%</span>
      </RouterLink>
      <RouterLink to="/agents" class="quick-nav__item quick-nav__item--store">
        <span class="quick-nav__label">Agent Store</span>
        <span class="quick-nav__meta">前往调度</span>
      </RouterLink>
      <RouterLink to="/evidence" class="quick-nav__item quick-nav__item--evidence">
        <span class="quick-nav__label">Evidence Board</span>
        <span class="quick-nav__meta">证据复盘</span>
      </RouterLink>
    </nav>

    <section class="screen__charts-grid">
      <article class="chart-card">
        <header>
          <h2>Autopilot 覆盖率</h2>
          <p>各套系自动化水平</p>
        </header>
        <div ref="autopilotChart" class="chart-card__canvas"></div>
      </article>
      <article class="chart-card">
        <header>
          <h2>Bill 占比</h2>
          <p>套系费用贡献</p>
        </header>
        <div ref="billPieChart" class="chart-card__canvas"></div>
      </article>
      <article class="chart-card chart-card--wide">
        <header>
          <h2>Outcome 趋势</h2>
          <p>Outcome 表现与转化提升（Mock 数据）</p>
        </header>
        <div ref="outcomeChart" class="chart-card__canvas"></div>
      </article>
    </section>

    <section class="screen__risks">
      <header>
        <h2>风险督办</h2>
        <p>Autopilot / CpR 异常套系</p>
      </header>
      <ul class="risk-list">
        <li v-for="alert in riskAlerts" :key="alert.title" :class="['risk-item', `risk-item--${alert.severity}`]">
          <div>
            <p class="risk-item__title">{{ alert.title }}</p>
            <p class="risk-item__desc">{{ alert.detail }}</p>
          </div>
          <RouterLink :to="alert.link" class="risk-item__link">调度</RouterLink>
        </li>
      </ul>
      <p v-if="!riskAlerts.length" class="risk-list__empty">暂无风险提醒，Autopilot 运行稳定。</p>
    </section>

    <section class="screen__impact">
      <header>
        <h2>套系影响力总览</h2>
        <p>查看在岗人数、转化提升与关键指标，快速调度或调整班次。</p>
      </header>
      <table class="impact-table">
        <thead>
          <tr>
            <th>套系</th>
            <th>在岗人数</th>
            <th>Outcome</th>
            <th>转化提升</th>
            <th>Autopilot</th>
            <th>CpR</th>
            <th>Bill</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in suiteImpactRows" :key="row.suite">
            <td>{{ row.alias }}</td>
            <td>{{ row.headcount }}</td>
            <td>{{ row.outcome }}</td>
            <td><span :class="['impact-lift', { positive: row.conversionLift >= 0 }]">{{ row.conversionLift >= 0 ? '+' : '' }}{{ row.conversionLift }}%</span></td>
            <td class="impact-progress-cell">
              <div class="impact-progress">
                <div class="impact-progress__bar" :style="{ width: row.autopilot + '%' }"></div>
              </div>
              <span class="impact-progress__value">{{ row.autopilot }}%</span>
            </td>
            <td>{{ row.cpr.toFixed(2) }}</td>
            <td>¥ {{ row.bill.toLocaleString() }}</td>
            <td class="impact-actions">
              <RouterLink :to="`/agents#${row.anchor}`" class="impact-link">调度加人</RouterLink>
              <button type="button" class="impact-link impact-link--danger">精简人力</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="screen__strategy">
      <header>
        <h2>策略看板</h2>
        <p>Outcome / Autopilot / CpR 综合表现</p>
      </header>
      <div class="strategy-grid">
        <article v-for="item in strategyConsole" :key="item.suite" class="strategy-card">
          <header class="strategy-card__header">
            <div>
              <p class="strategy-card__title">{{ item.alias }}</p>
              <p class="strategy-card__meta">Outcome {{ item.outcome }} · Autopilot {{ item.autopilot }}% · CpR {{ item.cpr.toFixed(2) }}</p>
            </div>
            <RouterLink :to="`/agents#${item.anchor}`" class="strategy-card__cta">调度</RouterLink>
          </header>
        </article>
      </div>
    </section>
  </section>
</template>
