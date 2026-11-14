import test from 'node:test';
import assert from 'node:assert/strict';
import {extractStreetAddress, streetAddressCandidates, validateGeocodeResult} from '../lib/map-geocode.mjs';
import {normalizeMapEntries} from '../lib/map-regions.mjs';
import {uniqueNoticesInViewport} from '../lib/map-viewport.mjs';
const notice=(id,addresses)=>({id,title:'Street notice',addresses});
const result=(address='100 Queen Street West')=>({properties:{lat:43.652,lon:-79.384,country_code:'ca',city:'Toronto',housenumber:'100',street:'Queen Street West',formatted:address+', Toronto, Canada',rank:{confidence:.99}}});

test('accept source address only when a real house number and street suffix are present',()=>{
 assert.equal(extractStreetAddress('100 Queen Street West'), '100 Queen Street West');
 assert.equal(extractStreetAddress('North York'), null);
 assert.equal(extractStreetAddress('Queen Street West'), null);
 assert.equal(extractStreetAddress('100 Queen Street West; 200 Spadina Avenue'), '100 Queen Street West');
 assert.equal(extractStreetAddress('Toronto'), null);
});
test('geocoding is needed only if source has no usable coordinates',()=>{
 assert.deepEqual(streetAddressCandidates(notice('a',[{label:'100 Queen Street West',latitude:43.652,longitude:-79.384}])), []);
 assert.deepEqual(streetAddressCandidates(notice('a',[{label:'100 Queen Street West',latitude:null,longitude:null}])),['100 Queen Street West']);
});
test('geocoding rejects missing house number and district/city matches',()=>{
 assert.equal(validateGeocodeResult('100 Queen Street West',result())?.precision,'geocoded');
 assert.equal(validateGeocodeResult('100 Queen Street West',{properties:{...result().properties,housenumber:'101'}}),null);
 assert.equal(validateGeocodeResult('100 Queen Street West',{properties:{...result().properties,street:'King Street West'}}),null);
 assert.equal(validateGeocodeResult('100 Queen Street West',{properties:{...result().properties,lat:45}}),null);
 assert.equal(validateGeocodeResult('100 Queen Street West',{properties:{...result().properties,rank:{confidence:.6}}}),null);
});
test('verified geocode upgrades an approximate district pin to a street pin',()=>{
 const n=notice('a',[{label:'100 Queen Street West',latitude:null,longitude:null}]);
 const geocoded={a:[{latitude:43.652,longitude:-79.384,address:'100 Queen Street West',provider:'Geoapify',approximate:false,precision:'geocoded'}]};
 const mapped=normalizeMapEntries([n],geocoded);
 assert.equal(mapped.unknown.length,0);
 assert.equal(mapped.entries[0].precision,'geocoded');
 assert.equal(mapped.entries[0].approximate,false);
});
test('viewport list includes any one of a notice’s many source points only once',()=>{
 const a=notice('a',[{label:'a',latitude:43.65,longitude:-79.38},{label:'b',latitude:43.70,longitude:-79.41}]);
 const b=notice('b',[{label:'c',latitude:43.8,longitude:-79.23}]);
 const entries=normalizeMapEntries([a,b]).entries;
 assert.deepEqual(uniqueNoticesInViewport(entries,{north:43.72,south:43.6,west:-79.5,east:-79.3,zoom:12}).map(e=>e.id),['a']);
});
