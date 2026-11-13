import {syncSource} from '../lib/sync/source-sync.mjs';
try {
 const result=await syncSource({url:process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY});
 console.log(JSON.stringify(result));
}catch(error){console.error(error.message);process.exitCode=1;}
