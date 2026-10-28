import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/lib/local-reports.ts'],bundle:true,format:'cjs',write:false});
function harness(){const requests=[],module={exports:{}},window={dispatchEvent(){}};vm.runInNewContext(bundle.outputFiles[0].text,{module,exports:module.exports,window,crypto:{randomUUID},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},fetch:async(path,options)=>{const body=JSON.parse(options.body);requests.push({path,body});return{ok:true,json:async()=>({id:'FMC-050',status:'submitted',assessment:{},safePhotos:[]})};}});return{...module.exports,requests,window};}
const facts={facts:{},originalText:'Synthetic test',location:{}};
test('repeated submit is idempotent, while editing after submission creates a new draft',async()=>{const h=harness();await h.saveIncident(facts);await h.submitIncident();await h.submitIncident();const submissions=h.requests.filter(r=>r.path.endsWith('/submit'));assert.equal(submissions[0].body.draftId,submissions[1].body.draftId);await h.saveIncident(facts);assert.notEqual(h.requests.at(-1).body.draftId,submissions[0].body.draftId);});
test('starting a different draft during a pending save cannot submit the wrong report',async()=>{const h=harness();let done;h.window.FMCLocalDraft.saving=new Promise(r=>done=r);const result=h.submitIncident();h.newIncident();done();await assert.rejects(result,/report changed/);assert.equal(h.requests.length,0);});
