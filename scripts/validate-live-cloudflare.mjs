import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute=promisify(execFile);
if (process.env.SPEEDQX_LIVE !== '1') throw new Error('Set SPEEDQX_LIVE=1 to run up to six 500 MB tests against Cloudflare. M-Lab remains declined.');
const cli = process.env.SPEEDQX_CLI ?? path.resolve('../qube-network-diagnostics/target/release/' + (process.platform === 'win32' ? 'speedqx.exe' : 'speedqx'));
const report={capturedAt:new Date().toISOString(),kind:'Three sequential real-path Cloudflare pairs; uncontrolled network and host conditions',rows:[]};
await writeFile('evidence/v5/live-cloudflare-new.json', JSON.stringify(report,null,2), {flag:'wx'});
for(let repetition=0;repetition<3;repetition++)for(const surface of (repetition%2?['Windows Chrome','Windows CLI']:['Windows CLI','Windows Chrome'])){
 const beganAt=new Date().toISOString();let row;
 if(surface==='Windows CLI'){
  const {stdout}=await execute(cli,['--json','--max-bytes','500000000'],{timeout:105000,maxBuffer:8000000});
  const r=JSON.parse(stdout);row={surface,repetition,beganAt,method:r.methodology_version,measurement:r.measurement,ping:r.ping_ms,warnings:r.warnings};
 }else{
  const b=await chromium.launch({channel:'chrome'});
  try{const p=await b.newPage();await p.goto('http://127.0.0.1:5175');
   const output=await p.evaluate(async()=>{const {V5Provider}=await import('/src/services/engine-v5.ts');const result=await new V5Provider({profile:'fast',consent:false,maxBytes:500000000}).start(()=>{});return {result,protocols:[...new Set(performance.getEntriesByType('resource').filter(e=>e.name.startsWith('https://speed.cloudflare.com/')).map(e=>e.nextHopProtocol))]};});
   const r=output.result;row={surface,repetition,beganAt,method:r.methodologyVersion,measurement:r.measurement,ping:r.ping,warnings:r.warnings,protocols:output.protocols};
  }finally{await b.close();}
 }
 report.rows.push(row);await writeFile('evidence/v5/live-cloudflare-new.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({surface,repetition,download:row.measurement.download.sustainedMbps,upload:row.measurement.upload.sustainedMbps,stop:row.measurement.stopReason,bytes:row.measurement.bytesTransferred,protocols:row.protocols}));
}
