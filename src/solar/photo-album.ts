import './photo-album.css';

export const PHOTO_ALBUM_KEY='orbital-expedition-photo-album-v1';
const MAX_PHOTOS=12,MAX_IMAGE_CHARACTERS=400000,MAX_ALBUM_CHARACTERS=1600000;
export interface ExpeditionPhoto {id:string;imageDataUrl:string;target:string;label:string;scientific:boolean;capturedAt:string}
export interface PhotoInput {imageDataUrl:string;target:string;label:string;scientific:boolean}
const jpeg=(value:unknown):value is string=>typeof value==='string'&&value.length<=MAX_IMAGE_CHARACTERS&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
let sessionPhotos:ExpeditionPhoto[]=[];
let activeAlbum:{close():void}|null=null;
function validPhoto(value:unknown):value is ExpeditionPhoto {
 const photo=value as Partial<ExpeditionPhoto>|null;
 return !!photo&&typeof photo.id==='string'&&photo.id.length<=100&&jpeg(photo.imageDataUrl)&&typeof photo.target==='string'&&photo.target.length<=80&&typeof photo.label==='string'&&photo.label.length<=160&&typeof photo.scientific==='boolean'&&typeof photo.capturedAt==='string'&&Number.isFinite(Date.parse(photo.capturedAt));
}
function bounded(photos:ExpeditionPhoto[]):ExpeditionPhoto[]{
 const result:ExpeditionPhoto[]=[];let size=0;
 for(const photo of photos){if(!validPhoto(photo)||result.some(existing=>existing.id===photo.id))continue;if(result.length===MAX_PHOTOS||size+photo.imageDataUrl.length>MAX_ALBUM_CHARACTERS)continue;result.push({...photo});size+=photo.imageDataUrl.length;}
 return result;
}
function storedPhotos():ExpeditionPhoto[]{
 try{const text=localStorage.getItem(PHOTO_ALBUM_KEY);if(!text||text.length>MAX_ALBUM_CHARACTERS+100000)return [];const raw=JSON.parse(text);return raw.version===1&&Array.isArray(raw.photos)?bounded(raw.photos):[];}catch{return [];}
}
/** Photos are independent of accepted science and Earth receipt. A rejected
 * exposure can be kept as a picture without granting any scientific progress. */
export function loadPhotos():ExpeditionPhoto[]{return bounded([...sessionPhotos,...storedPhotos()].sort((a,b)=>b.capturedAt.localeCompare(a.capturedAt)));}
export function savePhoto(input:PhotoInput):{photo:ExpeditionPhoto;persisted:boolean}{
 if(!jpeg(input.imageDataUrl))throw new Error('The captured JPEG is missing or exceeds the photo size limit.');
 const photo:ExpeditionPhoto={id:globalThis.crypto?.randomUUID?.()??`photo-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,imageDataUrl:input.imageDataUrl,target:input.target.slice(0,80),label:input.label.slice(0,160),scientific:input.scientific,capturedAt:new Date().toISOString()};
 sessionPhotos=bounded([photo,...loadPhotos()]);
 try{localStorage.setItem(PHOTO_ALBUM_KEY,JSON.stringify({version:1,photos:sessionPhotos}));return {photo,persisted:true};}catch{return {photo,persisted:false};}
}
export function downloadPhoto(photo:ExpeditionPhoto):void {
 if(!jpeg(photo.imageDataUrl))throw new Error('This photo is not available.');
 const binary=atob(photo.imageDataUrl.slice(photo.imageDataUrl.indexOf(',')+1)),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 const url=URL.createObjectURL(new Blob([bytes],{type:'image/jpeg'})),link=document.createElement('a');
 const safe=(value:string)=>value.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,40);
 link.href=url;link.download=`orbital-${safe(photo.target)||'space'}-${safe(photo.capturedAt.replace(/[-:]/g,'').slice(0,15))}-${safe(photo.id).slice(0,8)}.jpg`;
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
/** The modal lives outside the game HUD so HUD updates cannot detach a focused
 * download button. Keyboard events stay in the modal rather than firing thrust,
 * shutter or game-pause shortcuts underneath it. */
export function openPhotoAlbum(language:'ko'|'en',photos?:ExpeditionPhoto[]):{close():void}{
 activeAlbum?.close();
 const words=(ko:string,en:string)=>language==='ko'?ko:en;
 const items=photos?bounded(photos):loadPhotos(),previousFocus=document.activeElement as HTMLElement|null;
 const dialog=document.createElement('dialog');dialog.className='expedition-photo-album';dialog.setAttribute('aria-label',words('사진 보관함','Photo album'));
 const header=document.createElement('header'),heading=document.createElement('div'),title=document.createElement('h2'),subtitle=document.createElement('p'),closeButton=document.createElement('button');
 title.textContent=words('우리가 담은 우주','Our view of space');subtitle.textContent=words('최근 사진 12장까지 · 중요한 사진은 파일로 저장하세요','Up to 12 recent photos · download the ones you want to keep');heading.append(title,subtitle);
 closeButton.type='button';closeButton.dataset.photoClose='';closeButton.textContent=words('닫기 ×','Close ×');header.append(heading,closeButton);dialog.append(header);
 const body=document.createElement('section');body.className='expedition-photo-body';dialog.append(body);
 const status=document.createElement('p');status.dataset.photoStatus='';status.className='expedition-photo-status';status.setAttribute('role','status');dialog.append(status);
 const persistedIds=new Set(storedPhotos().map(photo=>photo.id));
 let selected=items[0];
 const draw=()=>{
  body.replaceChildren();status.textContent='';
  if(!selected){const empty=document.createElement('p');empty.dataset.photoEmpty='';empty.className='expedition-photo-empty';empty.textContent=words('아직 사진이 없어요. 탐사 중 촬영하면 여기에 남습니다.','No photos yet. Take a photo during your expedition to keep it here.');body.append(empty);return;}
  const figure=document.createElement('figure'),picture=document.createElement('img'),caption=document.createElement('figcaption');
  picture.dataset.photoImage='';picture.src=selected.imageDataUrl;picture.alt=selected.label;figure.className='expedition-photo-preview';
  const label=document.createElement('strong'),meta=document.createElement('span');label.textContent=selected.label;
  meta.textContent=`${new Date(selected.capturedAt).toLocaleString(language==='ko'?'ko-KR':'en-US')} · ${selected.scientific?words('관측 기록','Science observation'):words('탐사 사진 · 과학 점수와 별도','Expedition photo · separate from science credit')}`;
  caption.append(label,meta);figure.append(picture,caption);body.append(figure);
  const controls=document.createElement('div');controls.className='expedition-photo-controls';
  const save=document.createElement('button');save.type='button';save.dataset.photoDownload='';save.textContent=words('↓ 사진 저장 (.jpg)','↓ Save photo (.jpg)');save.className='expedition-photo-save';
  save.addEventListener('click',()=>{try{downloadPhoto(selected);status.textContent=words('사진 다운로드를 요청했어요. 브라우저의 다운로드 목록을 확인하세요.','Photo download requested. Check your browser’s downloads.');}catch{status.textContent=words('파일을 만들지 못했어요. 사진을 다시 선택해 주세요.','The file could not be created. Select the photo and try again.');}});controls.append(save);body.append(controls);
  if(!persistedIds.has(selected.id)&&!selected.id.startsWith('received-'))status.textContent=words('브라우저 저장 공간이 부족해 이 사진은 현재 탭에만 있어요. 파일로 저장해 주세요.','Browser storage is full. This photo is only in this tab; download it to keep it.');
  if(items.length>0){const strip=document.createElement('div');strip.className='expedition-photo-strip';strip.setAttribute('aria-label',words('사진 선택','Choose a photo'));
   for(const photo of items){const button=document.createElement('button'),thumb=document.createElement('img');button.type='button';button.dataset.photoSelect=photo.id;button.setAttribute('aria-label',photo.label);button.setAttribute('aria-pressed',String(photo.id===selected.id));thumb.src=photo.imageDataUrl;thumb.alt='';button.append(thumb);button.addEventListener('click',()=>{selected=photo;draw();body.querySelector<HTMLButtonElement>(`[data-photo-select="${CSS.escape(photo.id)}"]`)?.focus();});strip.append(button);}body.append(strip);
  }
 };
 let closed=false;
 const handle={close:()=>{if(closed)return;closed=true;dialog.close();dialog.remove();if(activeAlbum===handle)activeAlbum=null;if(previousFocus?.isConnected)previousFocus.focus();}};
 closeButton.addEventListener('click',handle.close);dialog.addEventListener('cancel',event=>{event.preventDefault();handle.close();});dialog.addEventListener('keydown',event=>event.stopPropagation());dialog.addEventListener('keyup',event=>event.stopPropagation());dialog.addEventListener('pointerdown',event=>event.stopPropagation());dialog.addEventListener('pointerup',event=>event.stopPropagation());
 draw();document.body.append(dialog);dialog.showModal();closeButton.focus();activeAlbum=handle;return handle;
}
