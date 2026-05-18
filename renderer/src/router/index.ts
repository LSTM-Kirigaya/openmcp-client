import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

const baseURL = import.meta.env.BASE_URL;

const DEFAULT_ROUTE_STORAGE_KEY = 'openmcp-default-route';

export function getSavedDefaultRoute(): string | null {
	try {
		return localStorage.getItem(DEFAULT_ROUTE_STORAGE_KEY);
	} catch {
		return null;
	}
}

export function saveDefaultRoute(route: string): void {
	try {
		localStorage.setItem(DEFAULT_ROUTE_STORAGE_KEY, route);
	} catch {
		// ignore storage errors
	}
}

const routes: Array<RouteRecordRaw> = [
	{
		name : "default",
		path : "/",
		redirect : () => {
			const saved = getSavedDefaultRoute();
			if (saved) {
				return saved;
			}
			return baseURL + 'debug';
		}
	},
	{
		path: baseURL + "debug",
		name: "debug",
		component: () => import( /* webpackMode: "eager" */ "@/views/debug/index.vue"),
		meta: { title: "Debug" }
	},
	{
		path: baseURL + "connect",
		name: "connect",
		component: () => import( /* webpackMode: "eager" */ "@/views/connect/index.vue"),
		meta: { title: "Connect" }
	},
	{
		path: baseURL + "setting",
		name: "setting",
		component: () => import( /* webpackMode: "eager" */ "@/views/setting/index.vue"),
		meta: { title: "Setting" }
	},
	{
		path: baseURL + "about",
		name: "about",
		component: () => import( /* webpackMode: "eager" */ "@/views/about/index.vue"),
		meta: { title: "Tools" }
	}
];

const router = createRouter({
	history: createWebHistory('/'),
	routes,
});


router.beforeEach((to, from, next) => {
	if (to.meta.title && document) {
		document.title = `OpenMCP | ${to.meta.title}`;
	}

	// 记录用户访问的有效路由（排除根路径）
	const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
	const isRootPath = to.path === '/' || to.path === base || to.path === base + '/';
	if (!isRootPath && to.name && typeof to.name === 'string') {
		saveDefaultRoute(to.path);
	}

	next();
});

export default router;