// Copyright (c) 2026 QubeTX - ES Development LLC. All rights reserved.

import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { startReference } from './controlled-reference.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const reference=await startReference(),browser=await chromium.launch({channel:'chrome'}), evidence=[];
await mkdir('evidence/v5',{recursive:true});
try {
 for(const stage of ['latency','download','upload']) {
  const page=await browser.newPage({viewport:{width:393,height:852},reducedMotion:'no-preference'}),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.log('PAGEERROR', e.stack);});
  page.on('console',m=>{if(m.type()==='error') console.log('CONSOLE',m.text().slice(0,1800));});
  await page.addInitScript(({reference,stage})=>{
   const original=window.fetch.bind(window);
   window.fetch=(input,options)=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.toString():input.url,location.href);
    if(url.hostname==='speed.cloudflare.com' && ['/__down','/__up'].includes(url.pathname)) {
     const replacement=new URL(reference+'/test'+url.search);replacement.searchParams.set('scenario','steady');replacement.searchParams.set('run',stage);
     return original(replacement,options);
    }
    if(url.hostname==='locate.measurementlab.net') return Promise.reject(new Error('M-Lab disabled in local acceptance fixture'));
    return original(input,options);
   };
  },{reference:reference.url,stage});
  await page.goto('http://localhost:8082/');await page.getByTestId('cassette-action').click();
  await page.waitForTimeout(stage==='latency'?350:stage==='download'?8000:17000);
  const rotations=[], opacities=[];
  for(let i=0;i<3;i++){
   rotations.push(await page.getByTestId('cassette-mechanism').locator('div').evaluateAll(es=>es.map(e=>e.style.transform).filter(v=>v.includes('rotate'))));
   opacities.push(await page.getByTestId('cassette-probe-indicator').evaluate(e=>getComputedStyle(e).opacity));
   await page.waitForTimeout(175);
  }
  if(stage==='latency') assert.notEqual(opacities[0],opacities[2],'Initial probe activity must be visible');
  else assert.notDeepEqual(rotations[0],rotations[2],'Transfer reels must advance');
  await page.screenshot({path:`evidence/v5/app-${stage}-running.png`,fullPage:true});
  await page.getByTestId('cassette-action').click();
  await page.getByText('STOPPED',{exact:true}).waitFor({timeout:3000});
  assert.equal(await page.getByTestId('cassette-action').isEnabled(),true,'Cassette must remain usable after stop');
  assert.equal(await page.getByTestId('cassette-action').getAttribute('aria-label'),'new test speed test');
  await page.screenshot({path:`evidence/v5/app-${stage}-stopped.png`,fullPage:true});
  const resultText=await page.locator('body').innerText();
  await page.getByTestId('cassette-action').click();await page.getByRole('button',{name:'start speed test',exact:true}).waitFor();
  await page.getByTestId('cassette-action').click();await page.getByRole('button',{name:'stop speed test',exact:true}).waitFor();
  await page.waitForTimeout(500);assert.equal(await page.getByTestId('view-details').count(),0,'Old bridge messages must not overwrite a new run');
  await page.getByTestId('cassette-action').click();await page.getByText('STOPPED',{exact:true}).waitFor();
  assert.deepEqual(errors,[]);evidence.push({stage,rotations,probeOpacities:opacities,errors,resultText});
  console.log(`${stage}: motion/probe feedback, partial stop, cassette restart and stale-result guards passed`);await page.close();
 }
} finally {await browser.close();await reference.close();await writeFile('evidence/v5/app-live-lifecycle.json',JSON.stringify({kind:'Expo browser live engine with independently paced loopback HTTP',limitations:'Browser rendering exercises the real hook and DOM callback lifecycle. Physical iOS/Android and native animation runtime remain separate checks.',capturedAt:new Date().toISOString(),evidence},null,2));}
