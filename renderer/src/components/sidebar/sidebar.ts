import { reactive } from 'vue';

export type SidebarNavItem = {
	icon: string;
	ident: string;
	labelKey?: string;
};

export const sidebarItems = reactive<SidebarNavItem[]>([
	{
		icon: 'icon-debug',
		ident: 'debug'
	},
	{
		icon: 'icon-workspace',
		ident: 'workspace',
		labelKey: 'sidebar-workspace'
	},
	{
		icon: 'icon-connect',
		ident: 'connect',
		labelKey: 'sidebar-mcp-hub'
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
