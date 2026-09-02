import { env } from 'cloudflare:workers';
import { resultsProjectIndex, resultsSchema } from '@/db/schema';

type AdminRow={submission_id:string;champion_id:string;runner_up_id:string;semifinalist_ids:string;display_name:string|null;named_consent:number;bracket:string|null;created_at:string;updated_at:string};
const allowedOrigin='https://vulpexy.github.io';
const responseHeaders={'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Cache-Control':'no-store'};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:responseHeaders});
const bindings=()=>env as unknown as {DB:D1Database;ADMIN_TOKEN?:string};

async function database(){const db=bindings().DB;await db.batch([db.prepare(resultsSchema),db.prepare(resultsProjectIndex)]);return db}
function authorized(request:Request){const token=bindings().ADMIN_TOKEN;return Boolean(token&&request.headers.get('Authorization')===`Bearer ${token}`)}

export async function OPTIONS(){return new Response(null,{status:204,headers:responseHeaders})}
export async function GET(request:Request){
  if(!authorized(request))return json({error:'unauthorized'},401);
  try{
    const url=new URL(request.url);const namedOnly=url.searchParams.get('named')==='1';const query=(url.searchParams.get('q')||'').trim().slice(0,30);const db=await database();
    let sql="SELECT submission_id,champion_id,runner_up_id,semifinalist_ids,display_name,named_consent,bracket,created_at,updated_at FROM tournament_results WHERE project='composer'";const values:string[]=[];
    if(namedOnly)sql+=' AND named_consent=1';if(query){sql+=' AND display_name LIKE ?';values.push(`%${query}%`)}sql+=' ORDER BY created_at DESC LIMIT 500';
    const rows=(await db.prepare(sql).bind(...values).all<AdminRow>()).results.map((row)=>({...row,semifinalistIds:JSON.parse(row.semifinalist_ids),bracket:row.bracket?JSON.parse(row.bracket):null,semifinalist_ids:undefined}));
    const counts=await db.prepare("SELECT COUNT(*) total,SUM(CASE WHEN named_consent=1 THEN 1 ELSE 0 END) named FROM tournament_results WHERE project='composer'").first<{total:number;named:number}>();
    return json({total:Number(counts?.total||0),named:Number(counts?.named||0),shown:rows.length,rows});
  }catch{return json({error:'database unavailable'},503)}
}

