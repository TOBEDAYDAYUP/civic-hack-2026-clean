import type { MapEntry } from './map-regions.mjs';
export type Viewport={north:number;south:number;east:number;west:number;zoom:number};
export declare function withinViewport(entry:MapEntry,viewport:Viewport|null):boolean;
export declare function uniqueNoticesInViewport(entries:MapEntry[],viewport:Viewport|null):MapEntry[];
