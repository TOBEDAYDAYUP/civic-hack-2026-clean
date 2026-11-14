import type {PublicNotice} from './public-notices';
import type {StreetGeocode} from './map-geocode.mjs';
export function readStreetCache(directory?:string):Promise<Record<string,unknown>>;
export function cachedStreetPoints(notice:PublicNotice,cache:Record<string,unknown>):StreetGeocode[];
export function saveStreetPoints(notice:PublicNotice,points:StreetGeocode[],directory?:string):Promise<void>;
