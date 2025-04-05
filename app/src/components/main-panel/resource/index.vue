<template>
    <div class="resource-module">
        <div class="left">
            <h2>
                <span class="iconfont icon-file"></span>
                {{ t("resources") + t("module") }}
            </h2>
            <h3><code>resources/templates/list</code></h3>
            
            <ResourceTemplates
                :tab-id="props.tabId"
            ></ResourceTemplates>

        </div>
        <div class="right">
            <ResourceReader
                :tab-id="props.tabId"
            ></ResourceReader>

            <ResourceLogger
                :tab-id="props.tabId"
            ></ResourceLogger>
        </div>
</div>
</template>

<script setup lang="ts">
import { defineProps } from 'vue';
import { useI18n } from 'vue-i18n';
import ResourceTemplates from './resource-templates.vue';
import ResourceReader from './resouce-reader.vue';
import ResourceLogger from './resource-logger.vue';

const { t } = useI18n(); 

const props = defineProps({
    tabId: {
        type: Number,
        required: true
    }
});



</script>

<style scoped>
.resource-module {
    padding: 20px;
    height: 100%;
    display: flex;
    justify-content: space-around;
}

.resource-module .left {
    width: 45%;
    max-width: 410px;
}

.resource-module .right {
    width: 45%;
}


</style>