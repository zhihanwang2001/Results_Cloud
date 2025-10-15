import { agents, toSuiteAnchor } from './agents'

export const suiteMeta = {
  '生态 Agent': {
    alias: '生态',
    focus: '跨行业生态联接',
    baselineOutcome: 88,
    autopilotTarget: 80,
  },
  '百融 Agent · 金融套系': {
    alias: '百金™',
    focus: '金融风控与授信',
    baselineOutcome: 93,
    autopilotTarget: 85,
  },
  '百融 Agent · 保险套系': {
    alias: '百保™',
    focus: '保险核保理赔',
    baselineOutcome: 90,
    autopilotTarget: 82,
  },
  '百融 Agent · 运营与合规套系': {
    alias: '百率™',
    focus: '运营合规指挥',
    baselineOutcome: 87,
    autopilotTarget: 78,
  },
  '百融 Agent · 增长套系': {
    alias: '百盈™',
    focus: '客户增长经营',
    baselineOutcome: 91,
    autopilotTarget: 83,
  },
  '百融 Agent · 人力套系': {
    alias: '百才™',
    focus: '人才获取与体验',
    baselineOutcome: 89,
    autopilotTarget: 80,
  },
  '百融 Agent · 法务套系': {
    alias: '百案™',
    focus: '法务审计质检',
    baselineOutcome: 92,
    autopilotTarget: 82,
  },
  '百融 Agent · 个人助手': {
    alias: 'To C',
    focus: '个人决策与效率',
    baselineOutcome: 85,
    autopilotTarget: 72,
  },
}

export function computeGlobalMetrics(agentList = agents) {
  const totals = agentList.reduce(
    (acc, agent) => {
      acc.outcome += agent.metrics.outcome
      acc.bill += agent.metrics.bill
      acc.cpr += agent.metrics.cpr
      acc.autopilot += agent.autopilotCoverage
      acc.evidence += agent.metrics.evidenceReplies
      acc.touchpoints += agent.metrics.cps
      return acc
    },
    { outcome: 0, bill: 0, cpr: 0, autopilot: 0, evidence: 0, touchpoints: 0 },
  )

  const count = agentList.length || 1

  return {
    outcomeIndex: Math.round(totals.outcome / count),
    bill: totals.bill,
    cpr: (totals.cpr / count).toFixed(2),
    autopilot: Math.round((totals.autopilot / count) * 100),
    evidence: totals.evidence,
    touchpoints: totals.touchpoints,
    agentCount: agentList.length,
  }
}

export function computeSuiteMetrics(agentList = agents) {
  const global = computeGlobalMetrics(agentList)
  const suiteMap = new Map()

  agentList.forEach((agent) => {
    if (!suiteMap.has(agent.suite)) {
      suiteMap.set(agent.suite, {
        suite: agent.suite,
        description: agent.suiteDescription,
        agents: 0,
        outcomeSum: 0,
        bill: 0,
        cprSum: 0,
        autopilotSum: 0,
        connectors: new Set(),
      })
    }
    const bucket = suiteMap.get(agent.suite)
    bucket.agents += 1
    bucket.outcomeSum += agent.metrics.outcome
    bucket.bill += agent.metrics.bill
    bucket.cprSum += agent.metrics.cpr
    bucket.autopilotSum += agent.autopilotCoverage
    agent.connectors.forEach((connector) => bucket.connectors.add(connector))
  })

  const suiteList = Array.from(suiteMap.values()).map((entry) => {
    const meta = suiteMeta[entry.suite] || {}
    const agentsCount = entry.agents || 1
    const avgOutcome = Math.round(entry.outcomeSum / agentsCount)
    const avgAutopilot = Math.round((entry.autopilotSum / agentsCount) * 100)
    const avgCpr = entry.cprSum / agentsCount
    const headcountShare = Number(((entry.agents / global.agentCount) * 100).toFixed(1))
    const billShare = Number((global.bill ? (entry.bill / global.bill) * 100 : 0).toFixed(1))
    const autopilotTarget = meta.autopilotTarget ?? 0

    return {
      suite: entry.suite,
      description: entry.description,
      alias: meta.alias,
      focus: meta.focus,
      anchor: toSuiteAnchor(entry.suite),
      agents: entry.agents,
      headcountShare,
      outcome: avgOutcome,
      conversionLift: Number(((avgOutcome / (meta.baselineOutcome || global.outcomeIndex || 1) - 1) * 100).toFixed(1)),
      autopilot: avgAutopilot,
      autopilotGap: Number((avgAutopilot - autopilotTarget).toFixed(1)),
      autopilotTarget,
      bill: entry.bill,
      billShare,
      cpr: Number(avgCpr.toFixed(2)),
      connectors: entry.connectors.size,
      avgBill: Math.round(entry.bill / agentsCount),
    }
  })

  suiteList.sort((a, b) => b.bill - a.bill)

  return {
    global,
    suites: suiteList,
  }
}
