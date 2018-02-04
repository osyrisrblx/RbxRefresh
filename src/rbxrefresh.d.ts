interface RbxRefreshConfig {
	placeId?: number | number[];
}

interface RbxObject {
	Children: RbxObject[];
	Name: string;
	Source: string;
	Type: string;
}

interface RbxInfo {
	RbxName: string;
	RbxType: string;
	RbxPath: string[];
}