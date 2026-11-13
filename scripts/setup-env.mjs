import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const publicNames=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
const valueOf=(text,name)=>new RegExp(`^${name}=(.*)$`,'m').exec(text)?.[1]?.trim().replace(/^(['"])(.*)\1$/,'$2');
const placeholder=value=>!value||/YOUR_KEY|your-project|your-publishable-key|sb_publishable_\.\.\./i.test(value);
export async function setupEnv(directory=process.cwd()){
 const template=await readFile(path.join(directory,'.env.local.example'),'utf8');
 const filename=path.join(directory,'.env.local');
 let original;
 try{original=await readFile(filename,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;original='';}
 let result=original;const updated=[];
 for(const name of publicNames){
  if(!placeholder(valueOf(result,name)))continue;
  const value=valueOf(template,name);
  if(placeholder(value))throw Error(`Fill ${name} in .env.local.example or .env.local`);
  const line=`${name}=${value}`;const pattern=new RegExp(`^${name}=.*$`,'m');
  result=pattern.test(result)?result.replace(pattern,()=>line):result+(result.endsWith('\n')||!result?'':'\n')+line+'\n';
  updated.push(name);
 }
 if(result!==original)await writeFile(filename,result,{mode:0o600});
 return updated;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const updated=await setupEnv();if(updated.length)console.log('Shared read-only database configuration is ready in .env.local.');}
 catch(error){console.error('Database setup:',error.message);process.exitCode=1;}
}
