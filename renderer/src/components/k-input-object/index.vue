<template>
    <div class="k-input-object">
        <textarea ref="textareaRef" v-model="inputValue" class="k-input-object__textarea"
            :class="{ 'is-invalid': isInvalid }" @input="handleInput" @blur="handleBlur"
            @keydown="handleKeydown"
            :placeholder="props.placeholder"
        ></textarea>
    </div>
    <div v-if="errorMessage" class="k-input-object__error">
        {{ errorMessage }}
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch, nextTick } from 'vue';
import { debounce } from 'lodash';

export default defineComponent({
    name: 'KInputObject',
    props: {
        modelValue: {
            type: Object,
            default: () => ({})
        },
        placeholder: {
            type: String,
            default: '请输入 JSON 对象'
        },
        debounceTime: {
            type: Number,
            default: 500
        }
    },
    emits: ['update:modelValue', 'parse-error'],
    setup(props, { emit }) {
        const textareaRef = ref<HTMLTextAreaElement | null>(null)
        const inputValue = ref<string>(JSON.stringify(props.modelValue, null, 2))
        const isInvalid = ref<boolean>(false)
        const errorMessage = ref<string>('')

        // 防抖处理输入
        const debouncedParse = debounce((value: string) => {
            if (value.trim() === '') {
                errorMessage.value = '';
                isInvalid.value = false;
                emit('update:modelValue', undefined);
                return;
            }
            try {
                const parsed = JSON.parse(value);
                isInvalid.value = false;
                errorMessage.value = '';
                emit('update:modelValue', parsed);
            } catch (error) {
                isInvalid.value = true;
                errorMessage.value = 'JSON 解析错误: ' + (error as Error).message;
                emit('parse-error', error);
            }
        }, props.debounceTime)

        const handleInput = () => {
            debouncedParse(inputValue.value)
        }

        const handleBlur = () => {
            // 立即执行最后一次防抖
            debouncedParse.flush()
        }

        // 当外部 modelValue 变化时更新输入框内容
        watch(
            () => props.modelValue,
            (newVal) => {
                const currentParsed = tryParse(inputValue.value)
                if (!isDeepEqual(currentParsed, newVal)) {
                    inputValue.value = JSON.stringify(newVal, null, 2)
                }
            },
            { deep: true }
        )

        // 辅助函数：尝试解析 JSON
        const tryParse = (value: string): any => {
            try {
                return JSON.parse(value)
            } catch {
                return undefined
            }
        }

        // 辅助函数：深度比较对象
        const isDeepEqual = (obj1: any, obj2: any): boolean => {
            return JSON.stringify(obj1) === JSON.stringify(obj2)
        }

        const handleKeydown = (event: KeyboardEvent) => {
            if (event.key === '{') {
                event.preventDefault();
                const start = textareaRef.value!.selectionStart;
                const end = textareaRef.value!.selectionEnd;
                const value = inputValue.value;
                const newValue = value.substring(0, start) + '{\n  \n}' + value.substring(end);
                inputValue.value = newValue;
                nextTick(() => {
                    textareaRef.value!.setSelectionRange(start + 2, start + 2);
                });
            } else if (event.key === '"') {
                event.preventDefault();
                const start = textareaRef.value!.selectionStart;
                const end = textareaRef.value!.selectionEnd;
                const value = inputValue.value;
                const newValue = value.substring(0, start) + '""' + value.substring(end);
                inputValue.value = newValue;
                nextTick(() => {
                    textareaRef.value!.setSelectionRange(start + 1, start + 1);
                });
            } else if (event.key === 'Tab') {
                event.preventDefault();
                const start = textareaRef.value!.selectionStart;
                const end = textareaRef.value!.selectionEnd;
                const value = inputValue.value;
                const newValue = value.substring(0, start) + '    ' + value.substring(end);
                inputValue.value = newValue;
                nextTick(() => {
                    textareaRef.value!.setSelectionRange(start + 1, start + 1);
                });
            } else if (event.key === 'Enter' && inputValue.value.trim() === '') {
                event.preventDefault();
                inputValue.value = '{}';
            }
        };

        return {
            textareaRef,
            inputValue,
            isInvalid,
            errorMessage,
            handleInput,
            handleBlur,
            handleKeydown,
            props
        }
    }
})
</script>

<style scoped>
.k-input-object {
    width: 100%;
    background-color: var(--background);
    border-radius: .5em;
    margin-bottom: 15px;
    display: flex;
}

.k-input-object__textarea {
    width: 100%;
    padding: 8px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 4px;
    font-family: monospace;
    resize: vertical;
    transition: border-color 0.2s;
    background-color: var(--el-bg-color-overlay);
    color: var(--el-text-color-primary);
}

.k-input-object__textarea:focus {
    outline: none;
    border-color: var(--main-color);
}

.k-input-object__textarea.is-invalid {
    border-color: var(--el-color-error);
}

.k-input-object__error {
    color: var(--el-color-error);
    font-size: 12px;
    margin-top: 4px;
}
</style>