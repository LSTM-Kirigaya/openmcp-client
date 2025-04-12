import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";

const routes: Array<RouteRecordRaw> = [
	{
		name : "default",
		path : "/",
		redirect : "/debug"
	},
	{
		path: "/debug",
		name: "debug",
		component: () => import( /* webpackMode: "eager" */ "@/views/debug/index.vue"),
		meta: { title: "Debug" }
	},
	{
		path: "/connect",
		name: "connect",
		component: () => import( /* webpackMode: "eager" */ "@/views/connect/index.vue"),
		meta: { title: "Connect" }
	},
	{
		path: "/setting",
		name: "setting",
		component: () => import( /* webpackMode: "eager" */ "@/views/setting/index.vue"),
		meta: { title: "Setting" }
	},
	{
		path: "/about",
		name: "about",
		component: () => import( /* webpackMode: "eager" */ "@/views/about/index.vue"),
		meta: { title: "Tools" }
	}
];

const router = createRouter({
	history: createWebHistory(process.env.BASE_URL),
	routes,
});


router.beforeEach((to, from, next) => {
	if (to.meta.title) {
		document.title = `OpenMCP | ${to.meta.title}`;
	}
	next();
});

export default router;