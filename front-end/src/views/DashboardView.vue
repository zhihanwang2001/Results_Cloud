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

const initialBoard = computeSuiteMetrics(agents)
const baselineGlobal = { ...initialBoard.global }
const globalState = ref({ ...initialBoard.global })
const suiteState = ref(initialBoard.suites.map((suite) => ({ ...suite })))

const orbSnapshot = computed(() => globalState.value)
const suiteMatrix = computed(() => suiteState.value)

function recalcSuiteShares() {
  const suites = suiteState.value
  const totalHeadcount = suites.reduce((sum, suite) => sum + (suite.agents || 0), 0)
  const totalBill = suites.reduce((sum, suite) => sum + (suite.bill || 0), 0)

  suites.forEach((suite) => {
    suite.headcountShare = totalHeadcount
      ? Number(((suite.agents / totalHeadcount) * 100).toFixed(1))
      : 0
    suite.billShare = totalBill ? Number(((suite.bill / totalBill) * 100).toFixed(1)) : 0
  })
}

function recalcGlobalFromSuites() {
  const suites = suiteState.value
  if (!suites.length) return

  const totals = suites.reduce(
    (acc, suite) => {
      const headcount = suite.agents || 0
      acc.headcount += headcount
      acc.bill += suite.bill || 0
      acc.outcome += (suite.outcome || 0) * headcount
      acc.autopilot += (suite.autopilot || 0) * headcount
      acc.cpr += (suite.cpr || 0) * headcount
      return acc
    },
    { headcount: 0, bill: 0, outcome: 0, autopilot: 0, cpr: 0 },
  )

  const divisor = totals.headcount || 1

  globalState.value = {
    ...globalState.value,
    outcomeIndex: Math.round(totals.outcome / divisor),
    bill: totals.bill,
    cpr: (totals.cpr / divisor).toFixed(2),
    autopilot: Math.round(totals.autopilot / divisor),
    agentCount: totals.headcount,
    evidence: baselineGlobal.evidence,
    touchpoints: baselineGlobal.touchpoints,
  }
}

const currencyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  maximumFractionDigits: 0,
})

function formatCurrency(value) {
  return currencyFormatter.format(Math.round(value || 0))
}

function formatCurrencyDelta(value) {
  if (!value) return formatCurrency(0)
  const formatted = currencyFormatter.format(Math.round(Math.abs(value)))
  return value > 0 ? `+${formatted}` : `-${formatted}`
}

function formatSignedNumber(value, digits = 1, unit = '') {
  if (!value) return `0${unit}`
  const abs = Math.abs(value)
  const formatted = digits > 0 ? abs.toFixed(digits) : Math.round(abs).toString()
  return `${value > 0 ? '+' : '-'}${formatted}${unit}`
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
function resolveStaffingDecision(suite) {
  const autopilotGap = suite.autopilotGap ?? 0
  const autopilotTarget = suite.autopilotTarget ?? 0
  const conversionLift = suite.conversionLift ?? 0
  const cpr = suite.cpr ?? 0
  const autopilot = suite.autopilot ?? 0

  if (autopilotGap <= -5 || (conversionLift < 0 && autopilot < autopilotTarget)) {
    return {
      primary: 'increase',
      disableIncrease: false,
      disableDecrease: true,
      rationale: `Autopilot 低于目标 ${Math.abs(autopilotGap).toFixed(1)}%${conversionLift < 0 ? ' · 转化承压' : ''}`,
    }
  }

  if (autopilotGap >= 6 && cpr <= 0.75) {
    return {
      primary: 'decrease',
      disableIncrease: true,
      disableDecrease: false,
      rationale: `自动化超出目标 ${autopilotGap.toFixed(1)}% · CpR ${cpr.toFixed(2)}`,
    }
  }

  return {
    primary: 'steady',
    disableIncrease: false,
    disableDecrease: false,
    rationale: '建议保持现有人力，持续关注 Outcome 与证据走势。',
  }
}

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
    staffing: resolveStaffingDecision(suite),
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

const staffingModal = ref({
  visible: false,
  mode: 'increase',
  suiteKey: '',
  advisory: null,
})
const proposedHeadcount = ref(0)

watch(proposedHeadcount, (value) => {
  if (!Number.isFinite(value) || value < 0) {
    proposedHeadcount.value = 0
    return
  }
  if (!Number.isInteger(value)) {
    proposedHeadcount.value = Math.round(value)
  }
})

const activeSuite = computed(() =>
  suiteMatrix.value.find((suite) => suite.suite === staffingModal.value.suiteKey) || null,
)

const activeAdvisory = computed(() => staffingModal.value.advisory)

const baseHeadcount = computed(() => activeSuite.value?.agents ?? 0)
const headcountDelta = computed(() => proposedHeadcount.value - baseHeadcount.value)
const deltaLabel = computed(() => {
  if (headcountDelta.value > 0) {
    return `增加 ${headcountDelta.value} 人`
  }
  if (headcountDelta.value < 0) {
    return `精简 ${Math.abs(headcountDelta.value)} 人`
  }
  return '保持现有人力'
})

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function projectSuiteMetrics(suite, headcount) {
  const safeHeadcount = Math.max(0, headcount)
  const delta = safeHeadcount - suite.agents
  const perAgentCost = suite.agents ? suite.bill / suite.agents : suite.avgBill || 0
  const bill = Math.max(0, Math.round(suite.bill + perAgentCost * delta))
  const outcome = clamp(suite.outcome + delta * 3, 50, 120)
  const autopilot = clamp(suite.autopilot + delta * -2, 20, 100)
  const conversionLift = Number((suite.conversionLift + delta * 1.2).toFixed(1))
  const cpr = Number((suite.cpr + delta * 0.02).toFixed(2))
  const avgBill = safeHeadcount ? Math.round(bill / safeHeadcount) : suite.avgBill

  return {
    headcount: safeHeadcount,
    delta,
    perAgentCost: Math.round(perAgentCost),
    bill,
    billDelta: bill - suite.bill,
    outcome,
    outcomeDelta: outcome - suite.outcome,
    autopilot,
    autopilotDelta: Number((autopilot - suite.autopilot).toFixed(1)),
    conversionLift,
    conversionDelta: Number((conversionLift - suite.conversionLift).toFixed(1)),
    cpr,
    cprDelta: Number((cpr - suite.cpr).toFixed(2)),
    autopilotGap: Number((autopilot - (suite.autopilotTarget ?? 0)).toFixed(1)),
    avgBill,
  }
}

const projectedSuite = computed(() => {
  const suite = activeSuite.value
  if (!suite) return null
  return projectSuiteMetrics(suite, proposedHeadcount.value)
})

const costProjection = computed(() => {
  const suite = activeSuite.value
  const projection = projectedSuite.value
  if (!suite || !projection) {
    return { base: 0, projected: 0, delta: 0, perAgent: 0 }
  }
  return {
    base: suite.bill,
    projected: projection.bill,
    delta: projection.billDelta,
    perAgent: projection.perAgentCost,
  }
})

const efficiencyProjection = computed(() => {
  const suite = activeSuite.value
  const projection = projectedSuite.value
  if (!suite || !projection) {
    return { base: 0, projected: 0, delta: 0 }
  }
  return {
    base: suite.outcome,
    projected: projection.outcome,
    delta: projection.outcomeDelta,
  }
})

const autopilotProjection = computed(() => {
  const suite = activeSuite.value
  const projection = projectedSuite.value
  if (!suite || !projection) {
    return { base: 0, projected: 0, delta: 0, gap: 0 }
  }
  return {
    base: suite.autopilot,
    projected: projection.autopilot,
    delta: projection.autopilotDelta,
    gap: projection.autopilotGap,
    target: suite.autopilotTarget ?? 0,
  }
})

function openStaffingModal(row, action) {
  const suite = suiteMatrix.value.find((item) => item.suite === row.suite)
  if (!suite) return
  staffingModal.value = {
    visible: true,
    mode: action,
    suiteKey: suite.suite,
    advisory: row.staffing,
  }
  const defaultHeadcount = suite.agents + (action === 'increase' ? 1 : action === 'decrease' ? -1 : 0)
  proposedHeadcount.value = Math.max(0, defaultHeadcount)
}

function closeStaffingModal() {
  staffingModal.value = {
    visible: false,
    mode: 'increase',
    suiteKey: '',
    advisory: null,
  }
  proposedHeadcount.value = 0
}

function incrementHeadcount() {
  proposedHeadcount.value += 1
}

function decrementHeadcount() {
  proposedHeadcount.value = Math.max(0, proposedHeadcount.value - 1)
}

function confirmStaffingChange() {
  const suite = activeSuite.value
  const projection = projectedSuite.value
  if (!suite || !projection || projection.delta === 0) {
    closeStaffingModal()
    return
  }

  applyProjectionToSuite(suite, projection)
  closeStaffingModal()
}

function goToEvidenceSuite(suiteKey) {
  router.push({ path: '/evidence', query: { suite: suiteKey } })
}

function applyProjectionToSuite(suite, projection) {
  const index = suiteState.value.findIndex((item) => item.suite === suite.suite)
  if (index === -1) return
  const current = suiteState.value[index]
  const updated = {
    ...current,
    agents: projection.headcount,
    bill: projection.bill,
    avgBill: projection.avgBill,
    autopilot: projection.autopilot,
    autopilotGap: projection.autopilotGap,
    outcome: projection.outcome,
    conversionLift: projection.conversionLift,
    cpr: projection.cpr,
  }
  suiteState.value.splice(index, 1, updated)

  recalcSuiteShares()
  recalcGlobalFromSuites()
}

function handleStaffingAction(row, action) {
  if (!row?.suite) return
  openStaffingModal(row, action)
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

    <header class="page__hero page__hero--compact">
      <div class="page__hero-text">
        <p class="page__eyebrow">RC-B 指挥舱</p>
        <h1 class="page__title">ORB 数据中枢</h1>
        <p class="page__subtitle">实时掌握 Outcome · Role · Bill 指标与执行态势。</p>
      </div>
      <div class="page__hero-stats">
        <article class="hero-stat">
          <span>ORB 指数</span>
          <strong>{{ orbSnapshot.outcomeIndex }}</strong>
        </article>
        <article class="hero-stat">
          <span>本月 Bill</span>
          <strong>¥ {{ orbSnapshot.bill.toLocaleString() }}</strong>
        </article>
        <article class="hero-stat">
          <span>Autopilot 覆盖</span>
          <strong>{{ orbSnapshot.autopilot }}%</strong>
        </article>
        <article class="hero-stat">
          <span>平均 CpR</span>
          <strong>{{ orbSnapshot.cpr }}</strong>
        </article>
      </div>
    </header>

    <section class="screen__charts-grid screen__charts-grid--top">
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
    </section>

    <section class="screen__charts-grid screen__charts-grid--single">
      <article class="chart-card chart-card--wide">
        <header>
          <h2>Outcome 趋势</h2>
          <p>Outcome 表现与转化提升（Mock 数据）</p>
        </header>
        <div ref="outcomeChart" class="chart-card__canvas chart-card__canvas--tall"></div>
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
            <td class="impact-actions-cell">
              <div class="impact-actions">
                <button
                  type="button"
                  class="impact-action impact-action--increase"
                  :class="{
                    'is-primary': row.staffing.primary === 'increase',
                    'is-ghost': row.staffing.primary === 'steady',
                    'is-muted': row.staffing.disableIncrease,
                  }"
                  :title="row.staffing.rationale"
                  @click="handleStaffingAction(row, 'increase')"
                >
                  调度加人
                </button>
                <button
                  type="button"
                  class="impact-action impact-action--decrease"
                  :class="{
                    'is-primary': row.staffing.primary === 'decrease',
                    'is-ghost': row.staffing.primary === 'steady',
                    'is-muted': row.staffing.disableDecrease,
                  }"
                  :title="row.staffing.rationale"
                  @click="handleStaffingAction(row, 'decrease')"
                >
                  精简人力
                </button>
              </div>
              <p class="impact-actions__hint">
                <span>{{ row.staffing.rationale }} · 点击按钮即时调整 1 人。</span>
                <button type="button" class="impact-actions__advanced" @click="openStaffingModal(row, row.staffing.primary)">
                  高级调度
                </button>
              </p>
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

    <transition name="modal-fade">
      <div v-if="staffingModal.visible && activeSuite" class="staffing-modal">
        <div class="staffing-modal__overlay" @click="closeStaffingModal"></div>
        <article class="staffing-modal__card" role="dialog" aria-modal="true">
          <header class="staffing-modal__header">
            <div>
              <p class="staffing-modal__eyebrow">员工管理</p>
              <h2 class="staffing-modal__title">{{ activeSuite.alias || activeSuite.suite }}</h2>
              <p class="staffing-modal__subtitle">{{ activeSuite.focus || '调度人力，平衡成本与效率' }}</p>
            </div>
            <button type="button" class="staffing-modal__close" @click="closeStaffingModal">×</button>
          </header>

          <section class="staffing-modal__body">
            <div class="staffing-modal__snapshot">
              <article>
                <span>当前在岗</span>
                <strong>{{ baseHeadcount }} 人</strong>
              </article>
              <article>
                <span>预计在岗</span>
                <strong>{{ projectedSuite?.headcount ?? baseHeadcount }} 人</strong>
              </article>
              <span class="staffing-modal__badge">{{ deltaLabel }}</span>
            </div>

            <p v-if="activeAdvisory" class="staffing-modal__advisory">
              当前策略建议：{{ activeAdvisory.rationale }}
            </p>

            <div class="staffing-modal__control">
              <label>目标在岗人数</label>
              <div class="staffing-modal__stepper">
                <button type="button" @click="decrementHeadcount" :disabled="proposedHeadcount <= 0">-</button>
                <input v-model.number="proposedHeadcount" type="number" min="0" />
                <button type="button" @click="incrementHeadcount">+</button>
              </div>
            </div>

            <div class="staffing-modal__metrics">
              <article>
                <header>费用影响</header>
                <p class="staffing-modal__figure">{{ formatCurrency(costProjection.projected) }}</p>
                <span
                  class="staffing-modal__chip"
                  :class="{
                    'is-positive': costProjection.delta > 0,
                    'is-negative': costProjection.delta < 0,
                  }"
                >
                  {{ formatCurrencyDelta(costProjection.delta) }}
                </span>
                <p class="staffing-modal__hint">人均 {{ formatCurrency(costProjection.perAgent) }}</p>
              </article>
              <article>
                <header>效率指数</header>
                <p class="staffing-modal__figure">{{ efficiencyProjection.projected }}</p>
                <span
                  class="staffing-modal__chip"
                  :class="{
                    'is-positive': efficiencyProjection.delta > 0,
                    'is-negative': efficiencyProjection.delta < 0,
                  }"
                >
                  {{ formatSignedNumber(efficiencyProjection.delta, 0, ' pt') }}
                </span>
                <p class="staffing-modal__hint">基于 Outcome 的效率估算</p>
              </article>
              <article>
                <header>Autopilot 覆盖</header>
                <p class="staffing-modal__figure">{{ autopilotProjection.projected }}%</p>
                <span
                  class="staffing-modal__chip"
                  :class="{
                    'is-positive': autopilotProjection.delta >= 0,
                    'is-negative': autopilotProjection.delta < 0,
                  }"
                >
                  {{ formatSignedNumber(autopilotProjection.delta, 1, '%') }}
                </span>
                <p class="staffing-modal__hint">距目标 {{ formatSignedNumber(autopilotProjection.gap, 1, '%') }}</p>
              </article>
            </div>
          </section>

          <footer class="staffing-modal__footer">
            <button type="button" class="btn btn--ghost" @click="closeStaffingModal">取消</button>
            <button type="button" class="btn btn--primary" :disabled="headcountDelta === 0" @click="confirmStaffingChange">
              确认调度
            </button>
          </footer>
        </article>
      </div>
    </transition>
  </section>
</template>
