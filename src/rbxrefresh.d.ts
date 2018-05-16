interface RbxRefreshConfig {
	placeId?: number | string | number[] | string[];
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
