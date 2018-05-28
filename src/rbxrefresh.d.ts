interface RbxRefreshConfig {
	placeId?: number | string | number[] | string[];
	serverAliases?: string[];
	clientAliases?: string[];
	moduleAliases?: string[];
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
