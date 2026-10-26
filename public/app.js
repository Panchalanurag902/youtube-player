const TOPICS=[['all','All topics'],['finance','Finance'],['technology','Technology'],['news','News'],['government','Government jobs'],['exams','Exams & results'],['entertainment','Entertainment'],['comedy','Comedy']];
const $=id=>document.getElementById(id);
let feed={videos:[],updatedAt:null},topic='finance',query='',token='',results=[],selected=null,busy=false,limitedMsg='',loading=true;
function h(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
function fmt(v){const d=new Date(v);return isNaN(d)?'':d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
function topicVideos(){const v=topic==='all'?feed.videos:feed.videos.filter(x=>x.category===topic);return v.slice().sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt))}
function localMatches(){const w=query.toLowerCase().split(/\s+/).filter(Boolean);return feed.videos.filter(v=>w.every(t=>(v.title+' '+v.channelTitle).toLowerCase().includes(t)))}
function renderTopics(){const nav=$('topics');nav.textContent='';TOPICS.forEach(([val,label])=>{const b=h('button','topic-pill',label);b.type='button';b.setAttribute('aria-pressed',String(!query&&topic===val));b.onclick=()=>{stopPlayer();topic=val;query='';token='';results=[];limitedMsg='';$('q').value='';render()};nav.appendChild(b)})}
function stopPlayer(){selected=null;const p=$('player');p.textContent='';const w=h('div','player-placeholder');w.appendChild(h('p',null,'Choose a video to start watching'));p.appendChild(w);const m=$('meta');m.textContent=''}
function play(v){selected=v;const p=$('player');p.textContent='';const f=document.createElement('iframe');
  f.src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(v.videoId)+'?autoplay=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&controls=0&disablekb=1&fs=0';
  f.title='Video player: '+v.title;f.allow='autoplay; encrypted-media; picture-in-picture';f.referrerPolicy='strict-origin-when-cross-origin';
  p.append(f,h('div','shield full'));
  const m=$('meta');m.textContent='';const d=h('div');d.appendChild(h('h3',null,v.title));
  const l=h('div','channel-line');l.append(h('span',null,v.channelTitle));if(fmt(v.publishedAt))l.append(h('span',null,'\u00b7 '+fmt(v.publishedAt)));
  d.appendChild(l);m.appendChild(d)}
function card(v){const b=h('button','video-card');b.type='button';b.setAttribute('aria-label','Play '+v.title);
  if(selected&&selected.videoId===v.videoId)b.setAttribute('aria-current','true');
  const t=h('span','thumb-wrap');const i=document.createElement('img');i.src=v.thumbnailUrl;i.alt='';i.loading='lazy';t.append(i,h('span','play-overlay','\u25b6'));
  const c=h('span','video-copy');c.append(h('strong',null,v.title),h('span',null,v.channelTitle+(fmt(v.publishedAt)?' \u00b7 '+fmt(v.publishedAt):'')));
  b.append(t,c);b.onclick=()=>{play(v);render()};return b}
function render(){renderTopics();const searching=!!query;
  const vids=searching?results:topicVideos();
  $('title').textContent=searching?'Results for \u201c'+query+'\u201d':(topic==='finance'?'Finance, made clearer':(TOPICS.find(t=>t[0]===topic)||[,'Videos'])[1]);
  $('back').hidden=!searching;$('listTitle').textContent=searching?'Search results':'Up next';
  $('count').textContent=loading?'Loading':vids.length+' videos';
  $('updated').textContent=feed.updatedAt?'Feed updated '+fmt(feed.updatedAt):'Public video feed';
  const msg=$('msg');msg.textContent='';if(limitedMsg)msg.appendChild(h('div','msg-note',limitedMsg));
  const list=$('list');list.textContent='';
  if(!vids.length&&!loading){const s=h('div','state-card');s.append(h('h3',null,searching?'No matching videos yet':'Nothing in this topic just now'),h('p',null,searching?'Try a broader phrase or another topic.':'Pick another topic to explore.'));list.appendChild(s)}
  vids.forEach(v=>list.appendChild(card(v)));
  $('more').hidden=!(searching&&token);$('more').disabled=busy}
async function runSearch(more){if(busy)return;busy=true;limitedMsg='';loading=!more;render();
  try{const r=await fetch('/api/search?q='+encodeURIComponent(query)+(more&&token?'&pageToken='+encodeURIComponent(token):''));
    const d=await r.json();
    if(!d||d.limited||!Array.isArray(d.items)){limitedMsg='Live search is resting for now. Showing matching videos from our daily feed.';results=localMatches();token=''}
    else{const seen=new Set(more?results.map(v=>v.videoId):[]);results=(more?results:[]).concat(d.items.filter(v=>!seen.has(v.videoId)));token=d.nextPageToken||''}
  }catch(e){limitedMsg='Live search is resting for now. Showing matching videos from our daily feed.';results=localMatches();token=''}
  busy=false;loading=false;render()}
$('searchForm').onsubmit=e=>{e.preventDefault();const q=$('q').value.trim();if(q.length<2)return;stopPlayer();query=q;token='';results=[];runSearch(false)};
$('back').onclick=()=>{stopPlayer();query='';token='';results=[];limitedMsg='';$('q').value='';render()};
$('more').onclick=()=>runSearch(true);
fetch('/feed.json').then(r=>r.json()).then(d=>{feed=d}).catch(()=>{}).finally(()=>{loading=false;render()});
render();
