(function buildPaco(){
 const fs = require('fs'), path = require('path'), zlib=require('zlib');
 fs.mkdirSync('public',{recursive:true});
 // Mesa 120x60x80cm; eixo Y vertical, unidades em metros.
 const parts={wood:{pos:[],norm:[],uv:[],ind:[]},steel:{pos:[],norm:[],uv:[],ind:[]}};
 function box(cx,cy,cz,w,h,d,material){
  const m=parts[material], x=w/2,y=h/2,z=d/2;
  const faces=[
   [[-x,y,-z],[x,y,-z],[x,y,z],[-x,y,z],[0,1,0]],
   [[-x,-y,z],[x,-y,z],[x,-y,-z],[-x,-y,-z],[0,-1,0]],
   [[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z],[0,0,1]],
   [[x,-y,-z],[-x,-y,-z],[-x,y,-z],[x,y,-z],[0,0,-1]],
   [[x,-y,z],[x,-y,-z],[x,y,-z],[x,y,z],[1,0,0]],
   [[-x,-y,-z],[-x,-y,z],[-x,y,z],[-x,y,-z],[-1,0,0]]
  ];
  for(const f of faces){
   const start=m.pos.length/3;
   for(let i=0;i<4;i++){
    m.pos.push(f[i][0]+cx, f[i][1]+cy, f[i][2]+cz);
    m.norm.push(...f[4]);
    const uv=[[0,0],[1,0],[1,1],[0,1]][i];m.uv.push(...uv);
   }
   m.ind.push(start,start+1,start+2,start,start+2,start+3);
  }
 }
 // Madeira superior em duas chapas, 30mm
 box(0,.785,0,1.2,.03,.6,'wood');
 // Metalon preto 40 x 40mm: duas estruturas U
 for(const x of [-.56,.56]){
   for(const z of [-.26,.26])box(x,.38,z,.04,.76,.04,'steel');
   box(x,.02,0,.04,.04,.56,'steel');
   box(x,.748,0,.04,.04,.56,'steel');
 }
 // Apoios longitudinais sob o tampo e reforço transversal central
 for(const z of [-.26,.26])box(0,.748,z,1.12,.04,.04,'steel');
 box(0,.747,0,.04,.04,.56,'steel');
 const bdata=[], views=[], accessors=[];
 function append(buf,target){const pad=(4-(buf.length%4))%4;const offset=bdata.reduce((a,b)=>a+b.length,0);bdata.push(buf,Buffer.alloc(pad));const idx=views.length;views.push({buffer:0,byteOffset:offset,byteLength:buf.length,...(target?{target}:{})});return idx}
 function af32(arr,target=34962){const buf=Buffer.alloc(arr.length*4);arr.forEach((v,i)=>buf.writeFloatLE(v,i*4));return append(buf,target)}
 function au16(arr){const buf=Buffer.alloc(arr.length*2);arr.forEach((v,i)=>buf.writeUInt16LE(v,i*2));return append(buf,34963)}
 function accessor(view,componentType,count,type,min,max){const a={bufferView:view,componentType,count,type};if(min)a.min=min;if(max)a.max=max;accessors.push(a);return accessors.length-1}
 function primitive(k,mat){const d=parts[k];const p=accessor(af32(d.pos),5126,d.pos.length/3,'VEC3',[Math.min(...d.pos.filter((_,i)=>i%3===0)),Math.min(...d.pos.filter((_,i)=>i%3===1)),Math.min(...d.pos.filter((_,i)=>i%3===2))],[Math.max(...d.pos.filter((_,i)=>i%3===0)),Math.max(...d.pos.filter((_,i)=>i%3===1)),Math.max(...d.pos.filter((_,i)=>i%3===2))]);const n=accessor(af32(d.norm),5126,d.norm.length/3,'VEC3');const uv=accessor(af32(d.uv),5126,d.uv.length/2,'VEC2');const ind=accessor(au16(d.ind),5123,d.ind.length,'SCALAR');return {attributes:{POSITION:p,NORMAL:n,TEXCOORD_0:uv},indices:ind,material:mat}}
 // Textura procedimental do Freijó amadeirado
 const W=512,H=256;let raw=Buffer.alloc(H*(1+W*4)),seed=99;
 for(let y=0;y<H;y++){
   const line=y*(1+W*4);raw[line]=0;
   for(let x=0;x<W;x++){seed=(seed*1664525+1013904223)>>>0;const grain=7*Math.sin(y*.31+5*Math.sin(x*.009))+4*Math.sin(y*.93+x*.02)+((seed/4294967296)-.5)*10;const off=line+1+x*4;raw[off]=Math.max(0,Math.min(255,184+grain));raw[off+1]=Math.max(0,Math.min(255,133+grain*.8));raw[off+2]=Math.max(0,Math.min(255,86+grain*.58));raw[off+3]=255;}
 }
 const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
 function chunk(name,data){const a=Buffer.alloc(8);a.writeUInt32BE(data.length,0);a.write(name,4,4,'ascii');const b=Buffer.concat([Buffer.from(name,'ascii'),data]);let c=0xffffffff;for(const v of b)c=crcTable[(c^v)&255]^(c>>>8);const tail=Buffer.alloc(4);tail.writeUInt32BE((c^0xffffffff)>>>0);return Buffer.concat([a,data,tail]);}
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(W,0);ihdr.writeUInt32BE(H,4);ihdr[8]=8;ihdr[9]=6;
 const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:7})),chunk('IEND',Buffer.alloc(0))]);
 const wood=primitive('wood',0), steel=primitive('steel',1);
 const imageView=append(png);
 const binary=Buffer.concat(bdata);
 const doc={asset:{version:'2.0',generator:'PACO Mantovani Mesa RA'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[wood,steel]}],buffers:[{byteLength:binary.length}],bufferViews:views,accessors,images:[{bufferView:imageView,mimeType:'image/png'}],samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}],textures:[{sampler:0,source:0}],materials:[{name:'MDF Freijo 30mm',pbrMetallicRoughness:{baseColorTexture:{index:0},metallicFactor:0,roughnessFactor:.73},doubleSided:true},{name:'Metalon preto fosco',pbrMetallicRoughness:{baseColorFactor:[.06,.065,.062,1],metallicFactor:.32,roughnessFactor:.62},doubleSided:true}]};
 const json=Buffer.from(JSON.stringify(doc),'utf8');const jp=Buffer.alloc((4-json.length%4)%4,32),bp=Buffer.alloc((4-binary.length%4)%4);
 const len=12+8+json.length+jp.length+8+binary.length+bp.length;
 const header=Buffer.alloc(12);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(len,8);
 const jhead=Buffer.alloc(8);jhead.writeUInt32LE(json.length+jp.length,0);jhead.write('JSON',4);
 const bhead=Buffer.alloc(8);bhead.writeUInt32LE(binary.length+bp.length,0);bhead.write('BIN\0',4);
 fs.writeFileSync('public/mesa-paco-120x60x80.glb',Buffer.concat([header,jhead,json,jp,bhead,binary,bp]));
 fs.writeFileSync('public/index.html',`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#17201c"><title>PACO MANTOVANI | Mesa Office em RA</title><meta name="description" content="Veja a Mesa Office PACO no seu ambiente em tamanho real."><script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/4.4.0/model-viewer.min.js"></script><style>*,*:before,*:after{box-sizing:border-box}body{margin:0;background:#f4f1eb;color:#19201c;font-family:system-ui,-apple-system,Arial}header{padding:24px 5vw;border-bottom:1px solid #ddd9d0}h1{font-size:clamp(42px,6vw,75px);letter-spacing:-3px;font-weight:550;margin:10px 0}main{max-width:1280px;margin:auto;padding:28px 5vw}small{letter-spacing:3px;color:#9b6b43;font-weight:700}.subtitle{color:#73786f;line-height:1.6}.panel{display:grid;grid-template-columns: minmax(0,2fr) minmax(250px,1fr);gap:22px;margin-top:23px}.view{min-height:560px;border-radius:14px;overflow:hidden;background:#e3ded4;position:relative}.view model-viewer{width:100%;height:560px;display:block;--progress-bar-color:#9f7651}.spec{background:white;border-radius:14px;padding:28px}.spec h2{font-size:27px;font-weight:550}.item{display:flex;justify-content:space-between;gap:20px;padding:15px 0;border-bottom:1px solid #ebe8e2;font-size:14px}.item span{color:#7b7c76}.help{color:#7b7c76;font-size:13px;line-height:1.7;margin-top:25px}.ar{background:#18221d;color:white;border:0;border-radius:9px;padding:17px 21px;position:absolute;bottom:18px;right:18px;left:18px;font-weight:700;font-size:16px;box-shadow:0 5px 25px #1113}.tag{position:absolute;z-index:2;top:15px;left:15px;padding:8px 11px;border-radius:999px;background:#fff9;font-size:11px;pointer-events:none}footer{padding:30px 5vw;text-align:center;color:#888;font-size:11px}@media(max-width:850px){.panel{grid-template-columns:1fr}.view,.view model-viewer{height:60vh;min-height:400px}.spec{padding:20px}}</style></head><body><header><b style="letter-spacing:3px">PACO MANTOVANI</b><div style="font-size:9px;letter-spacing:2px;margin-top:5px;color:#93775c">DESIGN & EXECUÇÃO</div></header><main><small>EXPERIÊNCIA 3D · REALIDADE AUMENTADA</small><h1>Mesa Office<span style="color:#aa7f54">.</span></h1><p class="subtitle">Explore o projeto da PACO de todos os ângulos. No celular compatível, experimente a mesa no seu próprio espaço, em escala real.</p><div class="panel"><div class="view"><div class="tag">MODELO 3D EM ESCALA 1:1</div><model-viewer src="mesa-paco-120x60x80.glb" ar ar-modes="scene-viewer quick-look webxr" ar-scale="fixed" ar-placement="floor" camera-controls auto-rotate rotation-per-second="12deg" shadow-intensity="1" shadow-softness=".8" environment-image="neutral" exposure="1.1" camera-orbit="30deg 72deg auto" alt="Mesa PACO 120 por 60 por 80 centímetros com tampo Freijó 30 milímetros e estrutura de metalon preto"><button class="ar" slot="ar-button">◈ Ver no meu espaço</button></model-viewer></div><div class="spec"><small>PROJETO R01</small><h2>Design para o seu espaço.</h2><div class="item"><span>Largura</span><b>120 cm</b></div><div class="item"><span>Profundidade</span><b>60 cm</b></div><div class="item"><span>Altura</span><b>80 cm</b></div><div class="item"><span>Tampo</span><b>MDF 30 mm</b></div><div class="item"><span>Acabamento</span><b>Freijó amadeirado</b></div><div class="item"><span>Estrutura</span><b>Metalon preto fosco</b></div><p class="help"><b>Como usar:</b> abra este link no Chrome do Android ou Safari do iPhone; toque em “Ver no meu espaço”, autorize a câmera, mire no chão e posicione a mesa.<br><br>O modo RA requer um aparelho compatível; em outros dispositivos, use o visualizador 3D.</p></div></div></main><footer>PACO MANTOVANI · MODELO DE APRESENTAÇÃO · MEDIDAS PRELIMINARES</footer></body></html>`);
 console.log('build ok',binary.length);
})();

const fsPaco = require('fs');
const page = 'public/index.html';
let htmlPaco = fsPaco.readFileSync(page,'utf8');
const modelUrl = 'https://paco-mesa-office-ra.onrender.com/mesa-paco-120x60x80.glb';
const websiteUrl = 'https://paco-mesa-office-ra.onrender.com/';
const sceneUrl = 'intent://arvr.google.com/scene-viewer/1.0?file='+encodeURIComponent(modelUrl)+'&mode=ar_preferred&title=Mesa%20Office%20PACO&resizable=false#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url='+encodeURIComponent(websiteUrl)+';end;';
htmlPaco=htmlPaco.replace('ar-modes="scene-viewer quick-look webxr"','ar-modes="scene-viewer webxr quick-look"');
htmlPaco=htmlPaco.replace('</model-viewer></div>','</model-viewer><div class="camera-cta"><a id="paco-camera" href="'+sceneUrl+'">📷 Abrir a câmera · Ver no meu espaço</a><span id="camera-note">Abra pelo Chrome do Android. No app do ChatGPT, escolha “Abrir no navegador”.</span></div></div>');
htmlPaco=htmlPaco.replace('</style>',' .view{padding-bottom:102px} .camera-cta{position:absolute;left:14px;right:14px;bottom:12px;z-index:5;display:flex;flex-direction:column;gap:6px;text-align:center} .camera-cta a{display:block;padding:15px 10px;border-radius:8px;background:#18221d;color:white;font-weight:700;text-decoration:none;font-size:15px} .camera-cta span{font-size:12px;color:#555e55;background:#fffefaec;border-radius:6px;padding:5px} model-viewer .ar{display:none} </style>');
htmlPaco=htmlPaco.replace('</body>',`<script>
(function(){
  const camera=document.getElementById('paco-camera');
  const note=document.getElementById('camera-note');
  const mv=document.querySelector('model-viewer');
  const ua=navigator.userAgent || '';
  if(/iPhone|iPad|iPod/i.test(ua)){
    camera.href='#camera';
    camera.onclick=async function(e){e.preventDefault();try{if(mv.canActivateAR){await mv.activateAR()}else{note.textContent='Abra este link no Safari para usar a realidade aumentada no iPhone.';}}catch(err){note.textContent='Não foi possível abrir a câmera. Abra pelo Safari e tente novamente.';}};
    note.textContent='No iPhone, abra no Safari. A câmera requer compatibilidade com Quick Look.';
  }else if(!/Android/i.test(ua)){
    camera.href='#camera';
    camera.onclick=function(e){e.preventDefault();note.textContent='Para posicionar a mesa em realidade aumentada, abra esta página no Chrome de um Android compatível ou Safari de um iPhone.';};
    note.textContent='Para usar a câmera, abra em um celular compatível.';
  }
  mv.addEventListener('error',function(){note.textContent='Falha ao carregar o 3D. Atualize a página e verifique a internet.';});
})();
</script></body>`);
fsPaco.writeFileSync(page,htmlPaco);
