import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../press-feedback.js',import.meta.url),'utf8');
function setup({reduced=false,scale=1}={}){
 const handlers=new Map(),timers=new Map();let time=0,id=0,activations=0;
 class Element{
  constructor(button=false){this.button=button;this.isConnected=true;this.disabled=false;this.attributes=new Map();this.dataset={};this.children=[];this.style={setProperty(k,v){this[k]=v;}};this.offsetWidth=200;this.offsetHeight=50;this.classList={add(){}};}
  closest(s){return s==='[inert]'?null:this.button?this:null;}
  matches(s){if(s.includes(':disabled'))return this.disabled;return this.button;}
  getBoundingClientRect(){return{left:10,top:20,right:10+200*scale,bottom:20+50*scale,width:200*scale,height:50*scale};}
  setAttribute(k,v){this.attributes.set(k,v);}removeAttribute(k){this.attributes.delete(k);}appendChild(c){this.children.push(c);c.parent=this;}remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
  addEventListener(){}setPointerCapture(id){this.captured=id;}hasPointerCapture(id){return this.captured===id;}releasePointerCapture(){this.captured=null;}
  click(){const e=dispatch('click',{target:this,isTrusted:false,detail:0});if(!e.blocked)activations++;}
 }
 const button=new Element(true),root={body:{},hidden:false,createElement:()=>new Element(),addEventListener(n,fn){handlers.set(n,[...(handlers.get(n)||[]),fn]);}};
 function dispatch(name,props={}){const e={target:button,isPrimary:true,button:0,buttons:1,pointerId:1,pointerType:'touch',clientX:60,clientY:40,isTrusted:true,detail:1,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.blocked=true;},...props};for(const fn of handlers.get(name)||[]){fn(e);if(e.blocked)break;}return e;}
 const context={Element,document:root,window:{addEventListener:root.addEventListener},AbortController,MutationObserver:class{observe(){}disconnect(){}},matchMedia:()=>({matches:reduced,addEventListener(){}}),DOMMatrixReadOnly:class{a=.4},getComputedStyle:()=>({position:'relative',color:'rgb(255,255,255)',transform:'matrix(.4,0,0,.4,0,0)',opacity:'.9'}),setTimeout(fn,ms){timers.set(++id,{fn,at:time+ms});return id;},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(source,context);
 return{button,dispatch,activations:()=>activations,advance(ms){time+=ms;for(const [id,j]of [...timers])if(j.at<=time){timers.delete(id);j.fn();}}};
}
test('touch long hold activates once and consumes its browser follow-up click',()=>{
 const p=setup();p.dispatch('pointerdown');assert.equal(p.button.attributes.has('data-fmc-pressed'),true);p.advance(199);assert.equal(p.button.children.length,0);p.advance(1);assert.equal(p.button.children.length,1);
 p.dispatch('pointerup');assert.equal(p.activations(),1);assert.equal(p.button.attributes.has('data-fmc-pressed'),false);
 const click=p.dispatch('click');assert.equal(click.blocked,true);assert.equal(p.activations(),1);p.advance(240);assert.equal(p.button.children.length,0);
});
test('moving a held finger cancels activation and fades existing ink instead of snapping it away',()=>{
 const p=setup();p.dispatch('pointerdown');p.advance(400);const ink=p.button.children[0];p.dispatch('pointermove',{clientX:80});assert.equal(p.button.attributes.has('data-fmc-pressed'),false);assert.ok('releasing' in ink.dataset);assert.equal(ink.isConnected,true);
 p.dispatch('pointerup',{clientX:80});assert.equal(p.activations(),0);assert.equal(p.dispatch('click').blocked,true);p.advance(240);assert.equal(ink.isConnected,false);
});
test('a quick tap has press feedback without delayed ink leaking onto the next page',()=>{const p=setup();p.dispatch('pointerdown');p.advance(50);p.dispatch('pointerup');p.advance(500);assert.equal(p.button.children.length,0);assert.equal(p.activations(),1);});
test('native dragging is prevented and disabled buttons never start a press',()=>{const p=setup();assert.equal(p.dispatch('dragstart').prevented,true);p.button.disabled=true;p.dispatch('pointerdown');p.advance(300);assert.equal(p.button.children.length,0);assert.equal(p.button.attributes.has('data-fmc-pressed'),false);});
test('reduced motion skips ink and scaled canvases retain the press origin',()=>{
 const reduced=setup({reduced:true});reduced.dispatch('pointerdown');reduced.advance(500);assert.equal(reduced.button.children.length,0);reduced.dispatch('pointerup');assert.equal(reduced.activations(),1);
 const p=setup({scale:2});p.dispatch('pointerdown',{clientX:110,clientY:70});p.advance(200);const ink=p.button.children[0];assert.equal(Number.parseFloat(ink.style.left)+Number.parseFloat(ink.style.width)/2,50);assert.equal(Number.parseFloat(ink.style.top)+Number.parseFloat(ink.style.height)/2,25);
});
