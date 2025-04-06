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
		component: () => import("@/views/debug/index.vue"),
		meta: { title: "Debug" }
	},
	{
		path: "/connect",
		name: "connect",
		component: () => import("@/views/connect/index.vue"),
		meta: { title: "Connect" }
	},
	{
		path: "/setting",
		name: "setting",
		component: () => import("@/views/setting/index.vue"),
		meta: { title: "Setting" }
	},
	{
		path: "/about",
		name: "about",
		component: () => import("@/views/about/index.vue"),
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