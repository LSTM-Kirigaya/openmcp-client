<template>
    <el-scrollbar height="100%">
        <div class="tool-module">
            <div class="left">
                <h2>
                    <span class="iconfont icon-tool"></span>
                    工具模块
                </h2>
                <h3><code>tools/list</code></h3>

                <ToolList :tab-id="props.tabId"></ToolList>

            </div>
            <div class="right">
                <ToolExecutor :tab-id="props.tabId"></ToolExecutor>

                <ToolLogger :tab-id="props.tabId"></ToolLogger>
            </div>
        </div>
    </el-scrollbar>

</template>

<script setup lang="ts">
import { defineProps } from 'vue';
import ToolList from './tool-list.vue';
import ToolExecutor from './tool-executor.vue';
import ToolLogger from './tool-logger.vue';

const props = defineProps({
    tabId: {
        type: Number,
        required: true
    }
});
</script>

<style scoped>
.tool-module {
    padding: 20px;
    height: 100%;
    display: flex;
    justify-content: space-around;
}

.tool-module .left {
    width: 45%;
    max-width: 410px;
}

.tool-module .right {
    width: 45%;
}
</style>