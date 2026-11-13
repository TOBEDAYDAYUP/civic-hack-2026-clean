import test from 'node:test';
import assert from 'node:assert/strict';
import {explicitRegionFromText, estimatedRegionFromCoordinates, normalizeMapEntries} from '../lib/map-regions.mjs';

const notice = (id, overrides={}) => ({id,title:'Notice about the city',addresses:[],...overrides});

test('recognizes explicit broad areas only',()=>{
  assert.equal(explicitRegionFromText('Scarborough').id,'scarborough');
  assert.equal(explicitRegionFromText('North York').id,'north-york');
  assert.equal(explicitRegionFromText('A proposal in Weston').id,'york');
  assert.equal(explicitRegionFromText('Toronto'),null);
  assert.equal(explicitRegionFromText('Scarborough and Etobicoke'),null);
});

test('source coordinates produce exact pins while region category is approximate',()=>{
  const {entries}=normalizeMapEntries([notice('123',{addresses:[{label:'123 Queen Street West',latitude:43.65,longitude:-79.389}]})]);
  assert.equal(entries.length,1);
  assert.equal(entries[0].approximate,false);
  assert.equal(entries[0].region,'central');
});

test('unknown or ambiguous places never create false pins',()=>{
  const {entries,unknown}=normalizeMapEntries([
    notice('1',{addresses:[{label:'123 Random Street',latitude:null,longitude:null}]}),
    notice('2',{title:'City-wide Toronto public notice'}),
    notice('3',{addresses:[{label:'North York and Scarborough',latitude:null,longitude:null}]})
  ]);
  assert.equal(entries.length,0);
  assert.equal(unknown.length,3);
});

test('region-only source addresses use clearly approximate representative locations',()=>{
  const {entries}=normalizeMapEntries([notice('region',{addresses:[{label:'Scarborough',latitude:null,longitude:null}]})]);
  assert.equal(entries.length,1);
  assert.equal(entries[0].region,'scarborough');
  assert.equal(entries[0].approximate,true);
  assert.ok(entries[0].locationSource.includes('source address'));
});

test('AI where text is not used as location proof',()=>{
  const {entries,unknown}=normalizeMapEntries([notice('ai',{simple:{where:'North York'}})]);
  assert.equal(entries.length,0);
  assert.equal(unknown.length,1);
});

test('multiple source coordinates produce distinct pins; only Toronto coordinates accepted',()=>{
  const {entries}=normalizeMapEntries([notice('a',{addresses:[
    {label:'a',latitude:43.651,longitude:-79.39},
    {label:'a',latitude:43.651,longitude:-79.39},
    {label:'b',latitude:43.7,longitude:-79.53},
    {label:'out of town',latitude:45,longitude:-75}
  ]})]);
  assert.equal(entries.length,2);
});

test('coordinates boundary outside Toronto bounds not mapped',()=>{
  assert.equal(estimatedRegionFromCoordinates(44,-79.3),null);
  assert.equal(estimatedRegionFromCoordinates(43.65,-79.389).id,'central');
});
