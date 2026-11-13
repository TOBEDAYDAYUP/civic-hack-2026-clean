export function syncSource(options:{url:string;key:string;fetcher?:typeof fetch}):Promise<{ok:boolean;skipped?:boolean;fetched?:number;changed?:number}>;
