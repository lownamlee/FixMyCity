export function actionSamples(actions=['look_left','look_right','blink'],now=Date.now()){
 const samples=[];let time=now-6000,media=10;
 const add=(yaw=0,left=.05,right=left)=>{time+=100;media+=.1;samples.push({at:time,mediaTime:media,faceCount:1,inFrame:true,yaw,blinkLeft:left,blinkRight:right});};
 for(const action of actions){for(let i=0;i<4;i++)add();if(action==='blink'){add(0,.85);add(0,.05);}else for(let i=0;i<5;i++)add(action==='look_left'?.24:-.24);}
 return samples;
}
