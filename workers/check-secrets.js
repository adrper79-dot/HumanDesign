#!/usr/bin/env node
/**
 * Check Worker secret presence via /api/health?full=1
 * Usage: node workers/check-secrets.js [url]
 */
const BASE = process.argv[2] || 'https://prime-self-api.adrper79.workers.dev';
(async function(){
  try{
    console.log('Checking', BASE + '/api/health?full=1');
    const res = await fetch(BASE + '/api/health?full=1');
    if(!res.ok){
      console.error('Health request failed:', res.status);
      process.exit(1);
    }
    const data = await res.json();
    console.log('Health:', data.status, 'version', data.version);
    if(data.secrets) {
      console.log('Secrets presence:');
      for(const [k,v] of Object.entries(data.secrets)){
        console.log(`  ${k}: ${v}`);
      }
    } else {
      console.log('No secrets metadata returned (old deployment).');
    }
  }catch(err){
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
