import type { PublicNotice } from './public-notices';
export declare const NOTICE_CATEGORIES: readonly { value: string; label: string }[];
export declare function noticeCategory(item: Pick<PublicNotice, 'topics' | 'title'>): string;
export declare function categoryLabel(value: string): string;
export declare function filterAndSortNotices<T extends PublicNotice>(
  items: T[],
  options?: {query?:string;category?:string;sort?:'newest'|'oldest';savedIds?:string[]}
): T[];
