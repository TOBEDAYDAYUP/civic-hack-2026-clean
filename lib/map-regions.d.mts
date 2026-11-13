import type { PublicNotice } from './public-notices';
export type MapRegion = {id:string;name:string;center:[number,number];zoom:number};
export type MapEntry = {id:string;notice:PublicNotice;region:string;regionName:string;latitude:number;longitude:number;approximate:boolean;precision:'source'|'geocoded'|'district';location:string;locationSource:string};
export declare const MAP_REGIONS:MapRegion[];
export declare function explicitRegionFromText(value:unknown):MapRegion|null;
export declare function estimatedRegionFromCoordinates(lat:number,lon:number):MapRegion|null;
export declare function normalizeMapEntries(notices:PublicNotice[],geocodedById?:Record<string,import('./map-geocode.mjs').StreetGeocode[]>):{entries:MapEntry[];unknown:PublicNotice[]};
