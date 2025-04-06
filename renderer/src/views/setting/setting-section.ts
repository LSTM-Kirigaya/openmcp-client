import { reactive, computed } from 'vue';

import I18n from '@/i18n/index';

const { t } = I18n.global;

export const settingSections = reactive({
	current: 'api',
	data: [
		{
			value: 'api',
			label: 'API'
		},
		{
			value: 'general',
			label: computed(() => t('general-setting'))
		},
		{
			value: 'appearance',
			label: computed(() => t('appearance-setting'))
		}
	]
});
