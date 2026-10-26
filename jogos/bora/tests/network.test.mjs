import {test} from 'node:test';import assert from 'node:assert/strict';
import {PartyNetwork} from '../js/festa/network.js';
function session(){let now=1000;const calls=[];const s=new PartyNetwork({});s.uid='u';s.connected=true;s.b={now:()=>now,write:async(path,v)=>calls.push(v)};return {s,calls,clock:t=>now=t};}
test('inputs wait for acknowledged presence',async()=>{const {s,calls}=session();await s.sendInput();assert.equal(calls.length,0);s.presenceReady=true;await s.sendInput();assert.equal(calls.length,1);});
test('blur and interval share rate limiter and monotonic sequence',async()=>{const {s,calls,clock}=session();s.presenceReady=true;await s.sendInput();clock(1040);await s.sendInput();clock(1085);await s.sendInput();assert.deepEqual(calls.map(c=>c.seq),[1,2]);assert.ok(calls[1].t-calls[0].t>=65);});
test('only one input can be in flight',async()=>{const {s,calls,clock}=session();s.presenceReady=true;let done;s.b.write=()=>new Promise(resolve=>done=resolve);const first=s.sendInput();clock(1200);await s.sendInput();assert.equal(s.seq,0);done();await first;assert.equal(s.seq,1);});
