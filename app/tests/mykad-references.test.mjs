import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {MYKAD_REFERENCES,MYKAD_REFERENCE_VERSION} from '../deploy/mykad-reference-data.js';
import {mykadReferenceContent,MYKAD_LAYOUT_INSTRUCTIONS,cardFailureFeedback} from '../deploy/mykad-references.js';

test('private reference bank matches reviewed source hashes and all three layout families',async()=>{
  const catalog=JSON.parse(await readFile(new URL('../research/mykad-references/catalog.json',import.meta.url),'utf8'));
  assert.equal(MYKAD_REFERENCE_VERSION,catalog.version);
  assert.deepEqual(MYKAD_REFERENCES.map(r=>r.id),['legacy-blue','2012-security-portrait','2026-new-generation']);
  for(const [index,reference] of MYKAD_REFERENCES.entries()){
    const source=catalog.references[index];
    const file=await readFile(new URL('../research/mykad-references/'+source.file,import.meta.url));
    assert.equal(reference.sha256,source.sha256);
    assert.equal(createHash('sha256').update(file).digest('hex'),source.sha256);
    assert.equal(reference.imageUrl,'data:image/jpeg;base64,'+file.toString('base64'));
    assert.ok(Object.isFrozen(reference));
  }
  const precache=await readFile(new URL('../precache-manifest.js',import.meta.url),'utf8');
  assert.doesNotMatch(precache,/mykad-reference|jpn-2026|paj-front-back|johor-front-back/);
});

test('every reference image has an explicit label and cannot satisfy a camera evidence check',()=>{
  const a=mykadReferenceContent(),b=mykadReferenceContent();assert.deepEqual(a,b);
  const images=a.filter(c=>c.type==='input_image');assert.equal(images.length,3);
  for(let i=0;i<a.length;i++)if(a[i].type==='input_image')assert.match(a[i-1].text,/^LAYOUT_REFERENCE_ONLY/);
  assert.match(a.at(-1).text,/END_LAYOUT_REFERENCES/);
  assert.match(MYKAD_LAYOUT_INSTRUCTIONS,/Never use them to satisfy a user-evidence check/);
  assert.match(MYKAD_LAYOUT_INSTRUCTIONS,/Reject a specimen, redacted copy, drawing, screenshot or replay submitted as USER_CAMERA_EVIDENCE/);
  assert.match(MYKAD_LAYOUT_INSTRUCTIONS,/ONE coherent applicable MyKad generation/);
  a[0].text='changed';assert.notEqual(mykadReferenceContent()[0].text,'changed');
});

const feedbackCases=[
  [{quality_usable:false},'ic_front','capture_unclear'],
  [{document_type:'other'},'ic_front','mykad_required'],
  [{front_side_visible:false},'ic_front','front_required'],
  [{text_readable:false,card_edges_visible:false},'ic_front','text_unclear'],
  [{live_capture_consistent:false},'ic_front','continuity_unclear'],
  [{same_card_all_frames:false},'ic_front','continuity_unclear'],
  [{back_side_visible:false},'ic','back_required'],
  [{portrait_usable:false},'ic_front','portrait_unclear'],
  [{risk_flags:['screen_replay']},'ic_front','screen_or_screenshot'],
  [{front_back_consistent:false},'ic','sides_unconfirmed'],
  [{risk_flags:['multiple_documents']},'ic','multiple_cards'],
  [{confidence:.98,card_edges_visible:true},'ic_front','check_inconclusive'],
];
for(const [value,kind,expected] of feedbackCases)test(`card retry guidance: ${expected}`,()=>{
  const result=cardFailureFeedback({...value,explanation:'PRIVATE MODEL TEXT',identity_number:'PRIVATE IDENTIFIER'},kind);
  assert.equal(result.failureCode,expected);
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE|confidence|0\.98/);
  assert.doesNotMatch(result.message,/four edges/);
});

test('malformed assessments use fixed inconclusive guidance without reflecting model output',()=>{
  for(const value of [null,[],{},'UNTRUSTED TEXT',{risk_flags:'UNTRUSTED TEXT'}]){
    const result=cardFailureFeedback(value,'ic_front');assert.equal(result.failureCode,'check_inconclusive');
    assert.doesNotMatch(JSON.stringify(result),/UNTRUSTED/);
  }
});

for(const [name,assessment] of [
  ['first supplied screenshot',{decision:'retry',document_type:'mykad',confidence:.995,risk_flags:['screenshot','screen_replay','multiple_documents'],quality_usable:false,front_side_visible:true,card_edges_visible:true,portrait_usable:true,photo_of_original_card:false}],
  ['second supplied screenshot',{decision:'review',document_type:'mykad',confidence:.99,risk_flags:['screen_replay','screenshot'],quality_usable:false,front_side_visible:true,card_edges_visible:true,portrait_usable:true,photo_of_original_card:false}],
])test(`${name}: recorded result gives screen-capture guidance instead of blur guidance`,()=>{
  const feedback=cardFailureFeedback(assessment,'ic_front');
  assert.equal(feedback.failureCode,'screen_or_screenshot');
  assert.match(feedback.message,/screenshot/);assert.match(feedback.message,/physical MyKad/);
  assert.doesNotMatch(feedback.message,/not clear enough|four edges/);
});

test('explicit paper or drawing findings also take precedence over image quality',()=>{
  for(const risk of ['drawing','paper_copy','synthetic_or_edited']){
    const feedback=cardFailureFeedback({quality_usable:false,risk_flags:[risk]},'ic_front');
    assert.equal(feedback.failureCode,'original_unconfirmed');
    assert.match(feedback.message,/physical MyKad/);
  }
});
