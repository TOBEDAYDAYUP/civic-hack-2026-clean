import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOTICE_CATEGORIES, noticeCategory, filterAndSortNotices } from '../lib/notice-browser.mjs';
const rows = [
  {id:'1',title:'TTC service change',topics:['Public Notice'],noticeDate:'2026-11-12',addresses:[]},
  {id:'2',title:'Housing consultation',topics:['Planning'],noticeDate:'2026-10-02',addresses:[{label:'45 King Street'}]},
  {id:'3',title:'Budget report',topics:['Finance'],noticeDate:'2024-08-31',addresses:[]},
  {id:'4',title:'Watermain work',topics:['Infrastructure'],noticeDate:null,addresses:[]},
  {id:'5',title:'Public hearing',topics:['Council'],noticeDate:'2025-02-01',addresses:[]},
];
test('every official notice has one normalized category and unrecognized topics are Other', () => {
  assert.deepEqual(NOTICE_CATEGORIES.map(c=>c.value),['all','transportation','housing','budget','infrastructure','other']);
  assert.deepEqual(rows.map(noticeCategory),['transportation','housing','budget','infrastructure','other']);
});
test('filters search and category against full dataset before any page slice', () => {
  assert.deepEqual(filterAndSortNotices(rows,{category:'housing'}).map(x=>x.id),['2']);
  assert.deepEqual(filterAndSortNotices(rows,{query:'King Street',category:'housing'}).map(x=>x.id),['2']);
  assert.deepEqual(filterAndSortNotices(rows,{query:'TTC',category:'housing'}).map(x=>x.id),[]);
  assert.deepEqual(filterAndSortNotices(rows,{category:'other'}).map(x=>x.id),['5']);
});
test('sort uses real notice date and places missing dates last in either direction',()=>{
  assert.deepEqual(filterAndSortNotices(rows,{sort:'newest'}).map(x=>x.id),['1','2','5','3','4']);
  assert.deepEqual(filterAndSortNotices(rows,{sort:'oldest'}).map(x=>x.id),['3','5','2','1','4']);
});
test('saved IDs are source strings, not old curated numeric indexes',()=>{
  assert.deepEqual(filterAndSortNotices(rows,{savedIds:['3','1'],sort:'oldest'}).map(x=>x.id),['3','1']);
  assert.deepEqual(filterAndSortNotices(rows,{savedIds:[]}),[]);
});

test('category filter is applied before pagination, not just to first 12 returned records',()=>{
  const generated=Array.from({length:25},(_,i)=>({id:String(i+100),title:i<15?'Council information notice':'Public transit schedule',topics:['Public notice'],noticeDate:`2026-11-${String(i+1).padStart(2,'0')}`}));
  const matched=filterAndSortNotices(generated,{category:'transportation'});
  assert.equal(matched.length,10);
  assert.equal(matched.slice(0,12).length,10);
  assert.equal(matched[0].id,'124');
});
