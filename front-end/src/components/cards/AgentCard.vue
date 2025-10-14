<script setup>
import { computed } from 'vue'

const props = defineProps({
  agent: {
    type: Object,
    required: true,
  },
})

const agent = computed(() => props.agent)
const autopilotPercent = computed(() => Math.round(agent.value.autopilotCoverage * 100))
</script>

<template>
  <RouterLink :to="`/agents/${agent.id}`" class="agent-card">
    <header class="agent-card__header" :style="{ background: agent.avatar }">
      <div class="agent-card__identity">
        <p class="agent-card__suite">{{ agent.suite }}</p>
        <h3 class="agent-card__name">{{ agent.name }}</h3>
        <p class="agent-card__title">{{ agent.title }}</p>
      </div>
      <span class="agent-card__cta">查看模型</span>
    </header>
    <section class="agent-card__body">
      <p class="agent-card__headline">{{ agent.headline }}</p>
      <ul class="agent-card__tags">
        <li v-for="tag in agent.tags" :key="tag">{{ tag }}</li>
      </ul>
      <dl class="agent-card__stack">
        <div>
          <dt>BR-LLM</dt>
          <dd>{{ agent.modelStack.llm }}</dd>
        </div>
        <div>
          <dt>Speech</dt>
          <dd>{{ agent.modelStack.speech }}</dd>
        </div>
        <div>
          <dt>Decision</dt>
          <dd>{{ agent.modelStack.decision }}</dd>
        </div>
      </dl>
    </section>
    <footer class="agent-card__footer">
      <div class="agent-card__autopilot">
        <span class="agent-card__metric-label">Autopilot 覆盖率</span>
        <div class="agent-card__progress">
          <div class="agent-card__progress-bar" :style="{ width: autopilotPercent + '%' }" />
        </div>
        <span class="agent-card__metric-value">{{ autopilotPercent }}%</span>
      </div>
      <div class="agent-card__sla">
        <span class="agent-card__metric-label">SLA</span>
        <span class="agent-card__metric-value">{{ agent.sla }}</span>
      </div>
    </footer>
  </RouterLink>
</template>
