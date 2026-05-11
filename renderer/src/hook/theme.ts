import { ref, watch } from 'vue';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'openmcp-theme';

function getSavedTheme(): ThemeMode {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
	} catch {}
	return 'dark';
}

function getSystemPrefersDark(): boolean {
	return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export const themeMode = ref<ThemeMode>(getSavedTheme());

function applyThemeClass(isLight: boolean) {
	document.documentElement.classList.toggle('light-theme', isLight);
}

function effectiveIsLight(mode: ThemeMode): boolean {
	if (mode === 'light') return true;
	if (mode === 'dark') return false;
	return !getSystemPrefersDark();
}

function applyTheme(mode: ThemeMode) {
	themeMode.value = mode;
	try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
	applyThemeClass(effectiveIsLight(mode));
}

export function setTheme(mode: ThemeMode) {
	applyTheme(mode);
}

export function getEffectiveTheme(): 'light' | 'dark' {
	return effectiveIsLight(themeMode.value) ? 'light' : 'dark';
}

// Listen for system color scheme changes
const systemMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
systemMediaQuery.addEventListener('change', () => {
	if (themeMode.value === 'system') {
		applyThemeClass(!getSystemPrefersDark());
	}
});

// Initialize on load
applyTheme(getSavedTheme());
