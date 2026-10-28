import {translate, type AppLanguage} from './lib/ui-translations';

const key='fixmycity2-ui-language-v1';
function saved():AppLanguage {
  try { const value=localStorage.getItem(key); if(value==='en'||value==='ms')return value; } catch {}
  try { return sessionStorage.getItem(key)==='ms'?'ms':'en'; } catch {return 'en';}
}
let language=saved();
type CopyRecord={source:string;rendered:string};
const records=new WeakMap<Node,CopyRecord>();
const attributes=new WeakMap<Element,Map<string,CopyRecord>>();
// Do not rewrite editable fields, report evidence, transcripts, or resident content.
const excluded='script,style,svg,textarea,input,code,pre,[contenteditable], [data-i18n-ignore],.rp-message,.rp-chat-message,.voice-transcript,#rp-conversation,#area-label,.profile-name,.profile-location,.rr-title,.report-title,.feed-description';
const sourceFor=(value:string,prior?:CopyRecord)=>prior&&value===prior.rendered?prior.source:value;
function localizeText(node:Text) {
  if(!node.parentElement||node.parentElement.closest(excluded))return;
  const value=node.data;if(!value.trim())return;
  const source=sourceFor(value,records.get(node)),rendered=translate(source,language);
  records.set(node,{source,rendered});if(value!==rendered)node.data=rendered;
}
function localizeAttributes(element:Element) {
  if(element.closest('[data-i18n-ignore],svg,script,style'))return;
  let values=attributes.get(element);if(!values){values=new Map();attributes.set(element,values);}
  for(const name of ['placeholder','aria-label','title','alt']) {
    const value=element.getAttribute(name);if(!value)continue;
    const source=sourceFor(value,values.get(name)),rendered=translate(source,language);
    values.set(name,{source,rendered});if(value!==rendered)element.setAttribute(name,rendered);
  }
}
function walk(root:Node) {
  if(root.nodeType===Node.TEXT_NODE){localizeText(root as Text);return;}
  if(!(root instanceof Element))return;
  if(root.matches('input,textarea')){localizeAttributes(root);return;}
  if(root.closest(excluded))return;
  localizeAttributes(root);
  for(const child of root.childNodes)walk(child);
}
function buttons() {
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-language-toggle]')) {
    const label=language==='ms'?'BM':'EN';if(button.textContent!==label)button.textContent=label;
    const description=language==='ms'?'Bahasa Melayu. Tukar ke English':'English. Switch to Bahasa Melayu';
    if(button.getAttribute('aria-label')!==description)button.setAttribute('aria-label',description);
    button.lang=language;button.title=description;
  }
}
function refresh(){document.documentElement.lang=language;walk(document.body);buttons();}
function set(next:AppLanguage) {
  if(next!=='en'&&next!=='ms')return;
  language=next;
  try{localStorage.setItem(key,next);}catch{}
  try{sessionStorage.setItem(key,next);}catch{}
  refresh();window.dispatchEvent(new CustomEvent('fixmycity:languagechange',{detail:{language}}));
}
window.FMCLanguage={get:()=>language,set,t:(text:string)=>translate(text,language),refresh};
function mount(parent:Element|null,position:string) {
  if(!parent||parent.querySelector(':scope > [data-language-toggle]'))return;
  const button=document.createElement('button');button.type='button';button.className='language-toggle '+position;
  button.dataset.languageToggle='';button.dataset.i18nIgnore='';button.addEventListener('click',()=>set(language==='en'?'ms':'en'));
  parent.append(button);
}
function init() {
  const isHome=document.documentElement.dataset.flowPage==='home';
  if(!isHome) {
    document.querySelectorAll('.canvas').forEach(canvas=>mount(canvas,'language-welcome'));
    mount(document.querySelector('#camera-permission'),'language-camera');
    mount(document.querySelector('.guidance-banner'),'language-guide');
    mount(document.querySelector('#scanner-page .top-bar'),'language-card');
    mount(document.querySelector('#scan-screen .scan-header'),'language-face');
    mount(document.querySelector('#success-screen .screen'),'language-success');
    mount(document.querySelector('#scene'),'language-intro');
  }
  refresh();
  // Legacy screens render their own labels. Translate new UI without replacing
  // elements/listeners, restarting a camera, or touching application state.
  const observer=new MutationObserver(changes=>{
    observer.disconnect();
    for(const change of changes) {
      if(change.type==='characterData')localizeText(change.target as Text);
      else if(change.type==='attributes')localizeAttributes(change.target as Element);
      else change.addedNodes.forEach(walk);
    }
    buttons();observe();
  });
  const observe=()=>observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title','alt']});
  observe();
  window.addEventListener('storage',event=>{if(event.key===key&&(event.newValue==='en'||event.newValue==='ms')){language=event.newValue;refresh();window.dispatchEvent(new CustomEvent('fixmycity:languagechange',{detail:{language}}));}});
  window.addEventListener('pageshow',()=>{language=saved();refresh();});
  window.dispatchEvent(new CustomEvent('fixmycity:languagechange',{detail:{language}}));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();

declare global {interface Window {FMCLanguage:{get():AppLanguage;set(language:AppLanguage):void;t(text:string):string;refresh():void}}}
