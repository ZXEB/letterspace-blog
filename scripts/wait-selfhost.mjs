const origin=process.env.BLOG_ORIGIN || 'http://localhost:18080'
let healthy=false
for(let attempt=0;attempt<120;attempt++){
  try {const response=await fetch(origin+'/api/v3/ping',{signal:AbortSignal.timeout(5000)});healthy=response.ok&&(await response.text()).includes('pong')}catch{}
  if(healthy)break
  await new Promise(resolve=>setTimeout(resolve,2000))
}
if(!healthy)throw Error('Mix Space did not become ready. Check compose logs for migrate and mx-core.')
console.log('Self-hosted API is ready.')
