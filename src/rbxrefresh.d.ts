interface RbxRefreshConfig {
	placeId?: number | number[];
}

interface RbxObject {
	children: RbxObject[];
	name: string;
	source: string;
	type: string;
}

interface RbxInfo {
	name: string;
	type: string;
	path: string[];
}