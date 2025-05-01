<template>
    <el-input
        type="textarea"
        v-model="model"
        :rows="inputHeightLines"
        :maxlength="2000"
        :placeholder="placeholder"
        :resize="resize"
        :class="customClass"
        class="k-cute-textarea"
        @keydown.enter="handleKeydown"
        @compositionstart="handleCompositionStart"
        @compositionend="handleCompositionEnd"
    />
</template>

<script setup lang="ts">
import { ref, computed, defineProps, defineEmits } from 'vue';

const props = defineProps({
    modelValue: {
        type: String,
        required: true
    },
    placeholder: {
        type: String,
        default: '输入消息...'
    },
    resize: {
        type: String,
        default: 'none'
    },
    customClass: {
        type: String,
        default: ''
    }
});

const emit = defineEmits(['update:modelValue', 'pressEnter']);

const model = computed({
    get() {        
        return props.modelValue;
    },
    set(value) {
        emit('update:modelValue', value);
    }
});

const inputHeightLines = computed(() => {
    const currentLines = props.modelValue.split('\n').length;
    return Math.min(12, Math.max(5, currentLines));
});

const isComposing = ref(false);

const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey && !isComposing.value) {
        event.preventDefault();
        emit('pressEnter', event);
    }
};

const handleCompositionStart = () => {
    isComposing.value = true;
};

const handleCompositionEnd = () => {
    isComposing.value = false;
};
</script>

<style>
.k-cute-textarea textarea {
    border-radius: .9em;
}


</style>