import type {PublicNotice} from './public-notices';
export type StreetGeocode = {latitude:number;longitude:number;address:string;provider:string;approximate:false;precision:'geocoded'};
export declare function extractStreetAddress(value:unknown):string|null;
export declare function streetAddressCandidates(notice:PublicNotice):string[];
export declare function validateGeocodeResult(address:string,result:unknown):StreetGeocode|null;

export function prioritizeStreetNotices(notices:PublicNotice[],region:string):PublicNotice[];
