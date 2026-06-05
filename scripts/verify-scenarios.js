const https=require('https');
const GAS='https://script.google.com/macros/s/AKfycbx3ait9hRE5NkEJUhMWh7o7jFoZ2DAxceibZ4JkH0rORp6a95VO-CZunQGsySF2sQ_aDw/exec';
function get(resource){return new Promise((res,rej)=>{const follow=u=>https.get(u,x=>{if(x.statusCode>=300&&x.statusCode<400&&x.headers.location)return follow(x.headers.location);let d='';x.on('data',c=>d+=c);x.on('end',()=>{try{res(JSON.parse(d))}catch(e){res({raw:d.slice(0,150)})}});}).on('error',rej);follow(`${GAS}?resource=${resource}`);});}
(async()=>{
  const t=await get('scenario_steps');
  const rows=t.data||[];
  console.log('steps総数:',rows.length);
  const chk=rows.filter(x=>(x.scenario_id==='STG-SCN-034'&&['8','9','10'].includes(String(x.step_no)))||(x.scenario_id==='STG-SCN-035'&&['7','8'].includes(String(x.step_no))));
  chk.sort((a,b)=>a.scenario_id.localeCompare(b.scenario_id)||a.step_no-b.step_no);
  chk.forEach(x=>console.log('---',x.scenario_id,'step',x.step_no,'\n  ',String(x.action).slice(0,90)));
})();
