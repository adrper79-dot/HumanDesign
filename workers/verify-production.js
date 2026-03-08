#!/usr/bin/env node
/*
  Simple verification script for production endpoints.
  Uses global fetch available in Node 18+ or newer runtime.
  Usage: node workers/verify-production.js
*/
const BASE = process.env.PROD_API || 'https://prime-self-api.adrper79.workers.dev';
async function check(path, opts={}){
  const url = BASE + path;
  try{
    const res = await fetch(url, opts);
    const text = await res.text();
    console.log(`${path} -> ${res.status}`);
    if(res.headers.get('content-type')?.includes('application/json')){
      try{ console.log(JSON.parse(text)); }catch(e){ console.log(text); }
    } else {
      console.log(text.slice(0, 200));
    }
  }catch(err){
    console.error(`${path} -> ERROR`, err.message);
  }
}

async function main(){
  console.log('Verifying production endpoints against', BASE);
  await check('/api/health');
  // public endpoints
  await check('/api/geocode?q=Tampa');
  // auth endpoints: expected method not allowed or 400 without body
  await check('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  // transits forecast should return 400 if params missing (handler active)
  await check('/api/transits/forecast');
  console.log('Verification complete');
}

main();
