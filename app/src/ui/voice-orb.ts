import {buildPalette, FRAG, STATE_TABLE, UNIFORMS, VERT, type OrbState, type SheetParams} from '../vendor/voiceorbs/siri-sheet';

/** The CyberBuddy Siri Sheet shader, with a framework-independent lifecycle. */
export class VoiceOrb {
  state: OrbState = 'connecting';
  level = 0;
  private canvas = document.createElement('canvas');
  private frame = 0;
  private phase = 1.7;
  private previous = 0;
  private energy = 0;
  private params: SheetParams = {...STATE_TABLE.connecting};
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private disposeGL = () => {};
  private draw: (() => void) | null = null;
  constructor(private host: HTMLElement) {
    this.canvas.setAttribute('aria-hidden','true');
    host.append(this.canvas);
    this.setup();
    this.reduced.addEventListener('change',this.wake);
    document.addEventListener('visibilitychange',this.wake);
    this.wake();
  }
  private setup() {
    const gl = this.canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:true,powerPreference:'low-power'});
    if(!gl) return;
    const compile = (type:number,source:string) => {
      const shader=gl.createShader(type)!; gl.shaderSource(shader,source); gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);return null;} return shader;
    };
    const vert=compile(gl.VERTEX_SHADER,VERT), frag=compile(gl.FRAGMENT_SHADER,FRAG), program=gl.createProgram();
    this.disposeGL=()=>{if(vert)gl.deleteShader(vert);if(frag)gl.deleteShader(frag);if(program)gl.deleteProgram(program);};
    if(!vert||!frag||!program){this.disposeGL();return;}
    gl.attachShader(program,vert);gl.attachShader(program,frag);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)){this.disposeGL();return;}
    gl.useProgram(program);
    const px=Math.round(240*Math.min(devicePixelRatio||1,2));
    this.canvas.width=px;this.canvas.height=px;gl.viewport(0,0,px,px);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    const pos=gl.getAttribLocation(program,'aPos');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
    const loc=Object.fromEntries(UNIFORMS.map(name=>[name,gl.getUniformLocation(program,name)]));
    gl.uniform1f(loc.uSize,px);
    const cleanup=this.disposeGL;this.disposeGL=()=>{gl.deleteBuffer(buffer);cleanup();};
    this.draw=()=>{
      const p=this.params, level=this.reduced.matches?0:this.energy, voice=p.voice*level;
      const pal=buildPalette([130,244,255],[142,108,255],p.mute);
      const values={uPhase:this.phase,uLevel:level,uWarp:p.warp*3.2+.85*voice,uRidge:p.ridge+.35*voice+.25*p.hear*level,uSharp:p.sharp*2.2,uZoom:p.zoom,uExposure:p.exposure*1.9*(1+.12*voice+.1*p.hear*level),uGlow:p.glow*.45,uRim:p.rim,uHear:p.hear,uFade:p.fade};
      for(const [name,value] of Object.entries(values))gl.uniform1f(loc[name],value);
      for(const [name,value] of Object.entries({uColA:pal.a,uColB:pal.b,uColC:pal.c,uColD:pal.d,uHi:pal.hi,uCool:pal.cool,uWarm:pal.warm,uGlowCol:pal.glow}))gl.uniform3f(loc[name],...value);
      gl.drawArrays(gl.TRIANGLES,0,3);
    };
    this.canvas.addEventListener('webglcontextlost',()=>{this.draw=null;this.host.classList.remove('has-shader');cancelAnimationFrame(this.frame);});
    this.host.classList.add('has-shader');
  }
  private tick = (now:number) => {
    this.frame=0;
    const dt=this.previous?Math.min((now-this.previous)/1000,.1):.016;this.previous=now;
    const target=STATE_TABLE[this.state];
    for(const key of Object.keys(target))this.params[key]+=(target[key]-this.params[key])*(1-Math.exp(-8*dt));
    this.energy+=(Math.max(0,Math.min(1,this.level))-this.energy)*(1-Math.exp(-12*dt));
    if(!this.reduced.matches)this.phase+=dt*this.params.speed*(1+.7*this.params.voice*this.energy);
    this.draw?.();
    if(!document.hidden && !this.reduced.matches && this.draw)this.frame=requestAnimationFrame(this.tick);
  };
  private wake = () => {cancelAnimationFrame(this.frame);this.previous=0;if(!document.hidden)this.frame=requestAnimationFrame(this.tick);};
  setState(state:OrbState){this.state=state;this.host.dataset.state=state;this.wake();}
  destroy(){cancelAnimationFrame(this.frame);this.reduced.removeEventListener('change',this.wake);document.removeEventListener('visibilitychange',this.wake);this.disposeGL();this.canvas.remove();}
}
