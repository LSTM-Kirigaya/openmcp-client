export interface SaveTabItem {
	name: string;
	icon: string;
	type: string;
	componentIndex: number;
	storage: Record<string, any>;
}

export interface SaveTab {
	tabs: SaveTabItem[]
	currentIndex: number
}