<template>
    <div class="message-meta" @mouseenter="showTime = true" @mouseleave="showTime = false">
        <span v-if="usageStatistic" class="message-usage">
            <span>
                {{ t('input-token') }} {{ usageStatistic.input }}
            </span>

            <span>
                {{ t('output-token') }} {{ usageStatistic.output }}
            </span> 

            <span>
                {{ t('total') }} {{ usageStatistic.total }}
            </span>

            <span>
                {{ t('cache-hit-ratio') }} {{ usageStatistic.cacheHitRatio }}%
            </span>
        </span>

        <span v-else class="message-usage">
            <span>{{ t('server-not-support-statistic') }}</span>
        </span>

        <span v-show="showTime" class="message-time">
            {{ props.message.extraInfo.serverName }} {{ t('answer-at') }}
            {{ new Date(message.extraInfo.created).toLocaleString() }}
        </span>
    </div>
</template>

<script setup lang="ts">
import { defineComponent, defineProps, ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { makeUsageStatistic } from './usage';

defineComponent({ name: 'message-meta' });

const { t } = useI18n();

const props = defineProps({
    message: {
        type: Object,
        required: true
    }
});

const usageStatistic = computed(() => {
    return makeUsageStatistic(props.message.extraInfo);
});

console.log(props.message);
console.log(usageStatistic);

const showTime = ref(false);
</script>

<style scoped>

.message-meta {
    margin-top: 8px;
    font-size: 0.8em;
    color: var(--el-text-color-secondary);
    display: flex;
}

.message-time {
    opacity: 0.7;
    padding: 2px 6px 2px 0;
    transition: opacity 0.3s ease;
}

.message-usage {
    display: flex;
    align-items: center;
}

.message-usage > span {
    background-color: var(--el-fill-color-light);
    padding: 2px 6px;
    border-radius: 4px;
    margin-right: 3px;
}

</style>