/* Local, masked animation of the existing paintings. No whole-image panning. */
(() => {
const vertex=`attribute vec2 position;varying vec2 uv;void main(){uv=(position+1.0)*.5;gl_Position=vec4(position,0.,1.);}`;
const fragment=`precision mediump float;varying vec2 uv;uniform sampler2D painting;uniform sampler2D atlas;uniform float time;uniform float scene;
void main(){vec2 p=vec2(uv.x,1.-uv.y);vec3 m=texture2D(atlas,uv).rgb;vec2 d=vec2(0.);
 d.x+=m.r*(sin(p.y*143.-time*1.7)*.0027+sin(p.y*69.+time*.9)*.0015);
 d.y+=m.r*(sin(p.x*88.+time*1.25)*.0018+sin(p.y*121.-time*1.3)*.001);
 d.x+=m.g*(sin(time*.88+p.y*4.5)*.007+sin(time*1.63+p.x*6.)*.002)*(1.-p.y*.45);
 d.y+=m.g*sin(time*.76+p.x*9.)*.0017;
 d.x+=m.b*sin(time*.64+p.y*9.)*.0038;d.y+=m.b*sin(time*.75+p.x*9.)*.0013;
 vec2 q=clamp(p+d,vec2(.001),vec2(.999));vec4 c=texture2D(painting,vec2(q.x,1.-q.y));
 float shimmer=sin(p.y*160.+time*1.2+sin(p.x*24.))*sin(p.x*67.-time*.8)*.012;
 c.rgb+=m.r*shimmer;if(scene>8.5&&scene<9.5)c.rgb+=m.b*(.025+.017*sin(time*5.3)+.008*sin(time*11.));
 gl_FragColor=c;}`;
const painters=[];let enabled=true,last=0;
function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s}
function load(url){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url})}
async function create(frame){if(frame.dataset.initialized)return;frame.dataset.initialized='true';const canvas=frame.querySelector('canvas');const gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,preserveDrawingBuffer:true});if(!gl){frame.dataset.motion='unavailable';return}
 try{const [image,mask]=await Promise.all([load(frame.dataset.image),load(frame.dataset.mask)]);canvas.width=Math.min(1000,image.width);canvas.height=Math.round(canvas.width*image.height/image.width);const program=gl.createProgram();gl.attachShader(program,shader(gl,gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl,gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const loc=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
 [image,mask].forEach((im,i)=>{gl.activeTexture(gl.TEXTURE0+i);const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);gl.uniform1i(gl.getUniformLocation(program,i===0?'painting':'atlas'),i)});
 const time=gl.getUniformLocation(program,'time');gl.uniform1f(gl.getUniformLocation(program,'scene'),+frame.dataset.scene);gl.viewport(0,0,canvas.width,canvas.height);const p={frame,canvas,gl,program,time,visible:frame.classList.contains('in-view')};painters.push(p);gl.uniform1f(time,0);gl.drawArrays(gl.TRIANGLES,0,6);canvas.classList.add('ready');frame.dataset.motion='ready';
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();canvas.classList.remove('ready');frame.dataset.motion='unavailable';p.visible=false});
 }catch(e){console.warn('Painting animation unavailable',frame.dataset.scene,e);frame.dataset.motion='unavailable'}
}
const observer=new IntersectionObserver(entries=>{for(const entry of entries){const frame=entry.target;frame.classList.toggle('in-view',entry.isIntersecting);if(entry.isIntersecting)create(frame);const p=painters.find(p=>p.frame===frame);if(p)p.visible=entry.isIntersecting}},{rootMargin:'120px 0px'});
function tick(t){requestAnimationFrame(tick);if(!enabled||document.hidden||t-last<40)return;last=t;for(const p of painters){if(!p.visible)continue;p.gl.useProgram(p.program);p.gl.uniform1f(p.time,t/1000);p.gl.drawArrays(p.gl.TRIANGLES,0,6)}}requestAnimationFrame(tick);
window.PaintingMotion={observe:frame=>observer.observe(frame),setEnabled:value=>{enabled=value;document.body.classList.toggle('no-motion',!value)}};
})();
