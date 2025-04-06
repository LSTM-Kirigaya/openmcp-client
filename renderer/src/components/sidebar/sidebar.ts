import { reactive } from 'vue';

export const sidebarItems = reactive([
	{
		icon: 'icon-debug',
		ident: 'debug'
	},
	{
		icon: 'icon-plugin',
		ident: 'connect'
	},
	{
		icon: 'icon-setting',
		ident: 'setting'
	},
	{
		icon: 'icon-about',
		ident: 'about'
	}
]);

export const Connection = reactive({
	showPanel: false
});
