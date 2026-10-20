import { ESPLoader, Transport } from 'https://esm.sh/esptool-js@0.7.0';
import CryptoJS from 'https://esm.sh/crypto-js@4.2.0';
let port = null, transport = null, loader = null;

export function supported(){ return !!navigator.serial && window.isSecureContext; }
export function connected(){ return !!port; }
export async function connect({ baudrate=460800, log=()=>{} }={}) {
  if (!window.isSecureContext) throw new Error('Open this site over HTTPS or localhost.');
  if (!navigator.serial) throw new Error('Web Serial is not available in this browser. Use a compatible Chromium browser or install the site as instructed by your device vendor.');
  if (!port) port = await navigator.serial.requestPort();
  transport = new Transport(port, true);
  const terminal = { clean(){}, write(data){log(String(data));}, writeLine(data){log(String(data));} };
  loader = new ESPLoader({ transport, baudrate:Number(baudrate), terminal, debugLogging:false });
  const chip = await loader.main();
  return { chip, info:port.getInfo?.() || {} };
}
export async function disconnect(){
  try { await transport?.disconnect?.(); } finally { port=null;transport=null;loader=null; }
}
function binaryString(bytes){ let out='', chunk=0x8000; for(let i=0;i<bytes.length;i+=chunk) out += String.fromCharCode(...bytes.subarray(i,i+chunk)); return out; }
export async function flash({ files, baudrate, eraseAll=false, flashMode='keep', flashFreq='keep', flashSize='keep', compress=true, onProgress=()=>{}, log=()=>{} }) {
  if (!loader) await connect({ baudrate, log });
  if (!files.length) throw new Error('No firmware images loaded.');
  const fileArray = files.map(f => ({ data:binaryString(f.data), address:Number.parseInt(f.address,16) }));
  if (fileArray.some(f => !Number.isFinite(f.address))) throw new Error('One or more flash addresses are invalid.');
  if (eraseAll) { log('Erasing full flash...'); await loader.eraseFlash(); }
  let last = 0;
  await loader.writeFlash({
    fileArray,
    flashSize,
    flashMode,
    flashFreq,
    eraseAll:false,
    compress,
    reportProgress(fileIndex,written,total){
      const doneBefore = fileArray.slice(0,fileIndex).reduce((s,f)=>s+f.data.length,0);
      const all = fileArray.reduce((s,f)=>s+f.data.length,0);
      const current = Math.round((doneBefore + written) / all * 100);
      if (current !== last) { last=current; onProgress(current,fileIndex,written,total); }
    },
    calculateMD5Hash(image){ return CryptoJS.MD5(CryptoJS.enc.Latin1.parse(image)).toString(); }
  });
  onProgress(100,files.length-1,1,1);
  try { await transport.setDTR(false); await new Promise(r=>setTimeout(r,100)); await transport.setRTS(true); await new Promise(r=>setTimeout(r,100)); await transport.setRTS(false); } catch {}
}
