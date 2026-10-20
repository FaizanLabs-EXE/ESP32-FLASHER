import { resolveFirmware } from './github.js';
import { supported, connected, connect, disconnect, flash } from './flasher.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const state = { files:[], busy:false, chip:null };
const terminal = $('#terminal');
function toast(msg){ const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800); }
function log(msg){ const text=String(msg).replace(/\r/g,''); terminal.textContent += `\n${text}`;terminal.scrollTop=terminal.scrollHeight; }
function setPanel(n){ $$('.panel').forEach(x=>x.classList.toggle('active',x.dataset.panel===String(n)));$$('.step').forEach(x=>x.classList.toggle('active',x.dataset.step===String(n))); }
function fmt(n){ return n>1048576?`${(n/1048576).toFixed(2)} MB`:`${Math.ceil(n/1024)} KB`; }
function inferAddress(name){ const n=name.toLowerCase();if(n.includes('bootloader'))return'0x1000';if(n.includes('partition'))return'0x8000';if(n.includes('boot_app0')||n.includes('ota_data_initial'))return'0xe000';return'0x10000'; }
function renderFiles(){
  $('#imageRows').innerHTML=state.files.map((f,i)=>`<div class="image-row"><span class="file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span><input class="address" data-i="${i}" value="${f.address}"><span class="size">${fmt(f.size)}</span><button class="remove" data-i="${i}" aria-label="Remove">×</button></div>`).join('');
  const ready=state.files.length>0;$('.next[data-next="2"]').disabled=!ready;$('#sourceHint').textContent=ready?`${state.files.length} image${state.files.length>1?'s':''} · ${fmt(state.files.reduce((s,f)=>s+f.size,0))}`:'No firmware loaded';
  $$('.address').forEach(x=>x.onchange=()=>state.files[+x.dataset.i].address=x.value.trim());$$('.remove').forEach(x=>x.onclick=()=>{state.files.splice(+x.dataset.i,1);renderFiles()});
}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
async function addLocal(list){ for(const file of list){if(!/\.bin$/i.test(file.name)){toast(`Skipped ${file.name}`);continue}const data=new Uint8Array(await file.arrayBuffer());state.files.push({name:file.name,size:data.length,data,address:inferAddress(file.name),source:'local'});}renderFiles();if(state.files.length)toast('Firmware loaded'); }
async function doConnect(){
  try{$('#connectBtn').disabled=true;log('[serial] Requesting device access...');const r=await connect({baudrate:$('#baud').value,log:m=>log(`[device] ${m}`)});state.chip=r.chip;$('#chipName').textContent=r.chip;$('#deviceName').textContent='Connected';$('#connectBtn').textContent='Device connected';toast(`Connected: ${r.chip}`);return r;}catch(e){log(`[error] ${e.message}`);toast(e.message);throw e}finally{$('#connectBtn').disabled=false}
}
async function doFlash(){
  if(state.busy)return; state.busy=true; $('#flashBtn').disabled=true;$('#cancelBtn').classList.remove('hidden');setProgress(0,'CONNECTING');
  try{ if(!connected())await doConnect();setProgress(1,'WRITING');$('#flashTitle').textContent='Flashing firmware';log('[flash] Operation started. Do not disconnect the board.');await flash({files:state.files,baudrate:$('#baud').value,eraseAll:$('#eraseAll').checked,flashMode:$('#flashMode').value,flashFreq:$('#flashFreq').value,flashSize:$('#flashSize').value,compress:$('#compress').checked,onProgress:p=>setProgress(p,'WRITING'),log:m=>log(`[flash] ${m}`)});setProgress(100,'COMPLETE');$('#flashTitle').textContent='Flash complete';$('#flashSub').textContent='The device was reset. You can disconnect it safely.';$('#operationBadge').textContent='Success';log('[success] Firmware written successfully.');toast('Flash complete');}
  catch(e){setProgress(0,'FAILED');$('#flashTitle').textContent='Operation failed';$('#flashSub').textContent=e.message;$('#operationBadge').textContent='Error';log(`[error] ${e.stack||e.message}`);toast(e.message)}finally{state.busy=false;$('#flashBtn').disabled=false;$('#cancelBtn').classList.add('hidden')}
}
function setProgress(p,phase){$('#ring').style.setProperty('--p',p);$('#progressText').textContent=`${p}%`;$('#progressPhase').textContent=phase;}

$('#apiPill').textContent=supported()?'Web Serial ready':'Web Serial unavailable';$('#securePill').textContent=isSecureContext?'Secure context':'HTTPS required';
$('#themeBtn').onclick=()=>document.documentElement.dataset.theme=document.documentElement.dataset.theme==='light'?'dark':'light';
$$('[data-next]').forEach(b=>b.onclick=()=>setPanel(b.dataset.next));$$('[data-back]').forEach(b=>b.onclick=()=>setPanel(b.dataset.back));$$('.step').forEach(b=>b.onclick=()=>{const n=+b.dataset.step;if(n===1||state.files.length)setPanel(n)});
$('#fileInput').onchange=e=>addLocal(e.target.files);$('#addFileBtn').onclick=()=>$('#fileInput').click();
const drop=$('#dropzone');['dragenter','dragover'].forEach(x=>drop.addEventListener(x,e=>{e.preventDefault();drop.classList.add('drag')}));['dragleave','drop'].forEach(x=>drop.addEventListener(x,e=>{e.preventDefault();drop.classList.remove('drag')}));drop.ondrop=e=>addLocal(e.dataTransfer.files);
$('#resolveBtn').onclick=async()=>{const btn=$('#resolveBtn'),meta=$('#repoMeta');try{btn.disabled=true;btn.textContent='Scanning';const result=await resolveFirmware($('#githubUrl').value,s=>{meta.textContent=s;meta.classList.remove('hidden')});state.files=result.files;meta.innerHTML=`<b>${escapeHtml(result.repo)}</b> · ★ ${result.stars}<br>${escapeHtml(result.description)}`;renderFiles();toast('GitHub firmware resolved')}catch(e){meta.textContent=e.message;meta.classList.remove('hidden');toast(e.message)}finally{btn.disabled=false;btn.textContent='Analyze'}};
$('#connectBtn').onclick=()=>doConnect().catch(()=>{});$('#flashBtn').onclick=doFlash;$('#disconnectBtn').onclick=async()=>{await disconnect();$('#deviceName').textContent='Not connected';$('#chipName').textContent='Auto-detect';$('#connectBtn').textContent='Connect device';log('[serial] Disconnected.');};
$('#clearLog').onclick=()=>terminal.textContent='[system] Console cleared.';$('#copyLog').onclick=async()=>{await navigator.clipboard.writeText(terminal.textContent);toast('Console copied')};$('#demoBtn').onclick=()=>{document.querySelector('.workspace').scrollIntoView({behavior:'smooth'});toast('Start with a GitHub URL or local .bin')};
$('#cancelBtn').onclick=()=>toast('Safe cancellation depends on the current write block. Disconnect only after the operation stops.');
