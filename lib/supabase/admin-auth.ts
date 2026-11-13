import {timingSafeEqual} from 'node:crypto';
export function authorized(request:Request){
 const expected=process.env.SYNC_ADMIN_TOKEN;
 if(!expected)return false;
 const supplied=request.headers.get('authorization')||'';
 const a=Buffer.from(supplied),b=Buffer.from(`Bearer ${expected}`);
 return a.length===b.length&&timingSafeEqual(a,b);
}
