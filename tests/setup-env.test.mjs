import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {setupEnv} from '../scripts/setup-env.mjs';
const template='NEXT_PUBLIC_SUPABASE_URL=https://team.example\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=public-test-value\n';
async function fixture(fn){const dir=await mkdtemp(path.join(tmpdir(),'civic-env-'));try{await writeFile(path.join(dir,'.env.local.example'),template);await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}}
test('new teammate gets only public settings and repeated setup is idempotent',()=>fixture(async dir=>{
 assert.equal((await setupEnv(dir)).length,2);const text=await readFile(path.join(dir,'.env.local'),'utf8');assert.equal(text,template);assert.deepEqual(await setupEnv(dir),[]);
}));
test('legacy/placeholder configuration is repaired without altering administrator values',()=>fixture(async dir=>{
 await writeFile(path.join(dir,'.env.local'),'SUPABASE_SECRET_KEY=private-test-marker\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY\n');
 await setupEnv(dir);const text=await readFile(path.join(dir,'.env.local'),'utf8');assert.ok(text.includes('SUPABASE_SECRET_KEY=private-test-marker'));assert.ok(text.includes('public-test-value'));assert.ok(!text.includes('YOUR_KEY'));
}));
test('custom valid public settings and unrelated configuration are preserved byte-for-byte',()=>fixture(async dir=>{
 const text='NEXT_PUBLIC_SUPABASE_URL=https://custom.example\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=custom-public\nGEOAPIFY_API_KEY=private-marker\n';await writeFile(path.join(dir,'.env.local'),text);assert.deepEqual(await setupEnv(dir),[]);assert.equal(await readFile(path.join(dir,'.env.local'),'utf8'),text);
}));
