/** Canvas implementation inspired by the supplied WABuddy DotGrid interaction. */
export class DotField{
 private ctx:CanvasRenderingContext2D|null;private frame=0;private x=-1000;private y=-1000;private energy=0;private observer:ResizeObserver;private reduced=matchMedia('(prefers-reduced-motion: reduce)');
 constructor(private canvas:HTMLCanvasElement){this.ctx=canvas.getContext('2d');this.observer=new ResizeObserver(()=>this.paint());this.observer.observe(canvas);canvas.parentElement?.addEventListener('pointermove',this.move);canvas.parentElement?.addEventListener('pointerleave',this.leave);this.paint();}
 private move=(event:PointerEvent)=>{if(this.reduced.matches)return;const r=this.canvas.getBoundingClientRect();this.x=event.clientX-r.left;this.y=event.clientY-r.top;this.energy=1;this.paint();};
 private leave=()=>{this.x=-1000;this.y=-1000;this.energy=0;this.paint();};
 private paint(){const ctx=this.ctx;if(!ctx)return;cancelAnimationFrame(this.frame);this.frame=requestAnimationFrame(()=>{const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;const dpr=Math.min(2,devicePixelRatio||1);this.canvas.width=r.width*dpr;this.canvas.height=r.height*dpr;ctx.scale(dpr,dpr);for(let y=16;y<r.height;y+=19)for(let x=16;x<r.width;x+=19){const dx=x-this.x,dy=y-this.y,d=Math.hypot(dx,dy),force=Math.max(0,1-d/145)*this.energy;const push=force*force*10;ctx.fillStyle=force?`rgba(36,123,235,${.20+force*.45})`:'#d6e2f1';ctx.beginPath();ctx.arc(x+(dx/(d||1))*push,y+(dy/(d||1))*push,.85+force*1.4,0,Math.PI*2);ctx.fill();}});}
 destroy(){cancelAnimationFrame(this.frame);this.observer.disconnect();this.canvas.parentElement?.removeEventListener('pointermove',this.move);this.canvas.parentElement?.removeEventListener('pointerleave',this.leave);}
}
