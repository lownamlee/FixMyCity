const privacyBack=document.getElementById('privacy-back') as HTMLAnchorElement;
const privacyFrom=new URL(location.href).searchParams.get('from');
const privacyDestination=privacyFrom==='home'?'home#settings':privacyFrom==='scan-face'?'scan-face':'scan-card#consent';
privacyBack.href=privacyDestination;
privacyBack.setAttribute('aria-label',privacyFrom==='home'?'Back to settings':'Back to verification');
privacyBack.addEventListener('click',event=>{
  // Section links add their own history entries; leave the policy in one tap.
  if(location.hash){event.preventDefault();location.replace(privacyDestination);return;}
  let previous:URL|null=null;try{previous=new URL(document.referrer);}catch{}
  if(previous?.origin===location.origin&&['/scan-card','/scan-card.html','/scan-face','/scan-face.html','/home','/home.html'].includes(previous.pathname)&&history.length>1){event.preventDefault();history.back();}
});
