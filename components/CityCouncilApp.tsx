'use client';

import {useEffect,useMemo,useState} from 'react';
import {decisions,Decision} from '@/data/decisions';

type LiveNotice={id:string;title:string;description:string;noticeDate:string|null;topics:string[];addresses:{label:string;latitude:number|null;longitude:number|null}[];sourceUrl:string;generatedBy:string;generatedAt:string;simple:{plainTitle:string;whatIsHappening:string;whyItMatters:string;whoMayBeAffected:string;where:string;decisionStage:string;howToParticipate:string;participationDeadline:string;uncertainty:string}};
type View='Home'|'Map'|'Decisions'|'Participate'|'Saved';
const topics=['All topics','Transportation','Housing','Budget','Infrastructure','News'] as const;
const topicLabels:Record<string,string>={Transportation:'Transportation',Housing:'Housing & real estate',Budget:'Taxes & budget',Infrastructure:'Infrastructure',News:'News'};

export default function CityCouncilApp(){
  const [view,setView]=useState<View>('Home');
  const [topic,setTopic]=useState<string>('All topics');
  const [query,setQuery]=useState('');
  const [sort,setSort]=useState<'newest'|'oldest'>('newest');
  const [saved,setSaved]=useState<number[]>([]);
  const [detail,setDetail]=useState<Decision|null>(null);
  const [liveDetail,setLiveDetail]=useState<LiveNotice|null>(null);
  const [live,setLive]=useState<LiveNotice[]>([]);
  const [syncing,setSyncing]=useState(false);
  const [message,setMessage]=useState('');

  useEffect(()=>{try{setSaved(JSON.parse(localStorage.getItem('yc-saved')||'[]'))}catch{};loadLive()},[]);
  useEffect(()=>{try{localStorage.setItem('yc-saved',JSON.stringify(saved))}catch{}},[saved]);

  async function loadLive(){
    try{
      const r=await fetch('/api/processed-notices',{cache:'no-store'});
      const j=await r.json();
      if(j.ok&&Array.isArray(j.notices))setLive(j.notices);
    }catch{}
  }

  async function sync(){
    setSyncing(true);
    setMessage('Fetching Toronto data and simplifying new records…');
    try{
      const r=await fetch('/api/sync',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({limit:5})});
      const j=await r.json();
      if(!r.ok||!j.ok)throw new Error(j.error||'Update failed');
      await loadLive();
      setMessage(`Updated: ${j.generated} new/changed; ${j.reused} already current.`);
    }catch(e){
      setMessage(e instanceof Error?e.message:'Update failed');
    }finally{
      setSyncing(false);
    }
  }

  function go(v:View){
    setView(v);
    setQuery('');
    if(v!=='Map'&&v!=='Decisions')setTopic('All topics');
    window.scrollTo({top:0,behavior:'smooth'});
  }

  const filtered=useMemo(()=>{
    let x=decisions.filter(d=>(view!=='Saved'||saved.includes(d.id))&&(topic==='All topics'||d.topic===topic));
    const q=query.trim().toLowerCase();
    if(q)x=x.filter(d=>[d.title,d.summary,d.topic,d.area].join(' ').toLowerCase().includes(q));
    return [...x].sort((a,b)=>sort==='oldest'?a.sortDate.localeCompare(b.sortDate):b.sortDate.localeCompare(a.sortDate));
  },[view,saved,topic,query,sort]);

  const mapReadyLive=useMemo(()=>live.filter(n=>n.addresses.some(a=>a.latitude!==null&&a.longitude!==null)&&(
    topic==='All topics'||n.topics.some(t=>t.toLowerCase().includes(topic.toLowerCase()))
  )),[live,topic]);

  if(view==='Participate')return <Shell view={view} saved={saved.length} go={go}>
    <section className="page-heading"><div className="eyebrow">YOUR VOICE MATTERS</div><h1>Have a say in<br/>your city.</h1><p>Use official City of Toronto channels to find meetings, committee speaking opportunities, public consultations and your councillor.</p></section>
    <section className="participation-grid">
      {[['Find an upcoming meeting','https://www.toronto.ca/city-government/council/'],['Contact your councillor','https://www.toronto.ca/city-government/council/members-of-council/'],['Explore public consultations','https://www.toronto.ca/community-people/get-involved/public-consultations/']].map((x,i)=><div className="info-card" key={x[0]}><span className="number">0{i+1} / GET INVOLVED</span><h3>{x[0]}</h3><p>Check the official City source for current dates, rules and deadlines.</p><a href={x[1]} target="_blank" rel="noreferrer">Official City page ↗</a></div>)}
    </section>
  </Shell>;

  if(view==='Map')return <Shell view={view} saved={saved.length} go={go}>
    <section className="page-heading map-heading">
      <div className="eyebrow">EXPLORE BY PLACE</div>
      <h1>What is happening<br/>near you?</h1>
      <p>Use location to connect municipal notices with neighbourhoods. Only verified source coordinates will be plotted.</p>
    </section>
    <SecondaryTopics topic={topic} setTopic={setTopic}/>
    <section className="map-workspace">
      <aside className="map-list">
        <div className="map-list-head"><strong>{mapReadyLive.length}</strong><span>location-ready live records</span></div>
        {mapReadyLive.length?mapReadyLive.slice(0,8).map(n=><button key={n.id} className="map-record" onClick={()=>setLiveDetail(n)}><span className="topic">{n.topics[0]||'Public notice'}</span><b>{n.simple.plainTitle||n.title}</b><small>{n.addresses.find(a=>a.latitude!==null&&a.longitude!==null)?.label||n.simple.where}</small></button>):<div className="map-empty">No processed records with verified coordinates yet. Use <b>Update data</b> on Home, then return here.</div>}
      </aside>
      <div className="map-stage">
        <div className="map-stage-inner">
          <span className="map-badge">MAP DEVELOPMENT AREA</span>
          <h2>Toronto basemap + verified municipal locations</h2>
          <p>The next implementation step will render these coordinate-ready records on an interactive map, with the same topic filters shown above.</p>
          <div className="map-readiness">
            <span><b>{live.length}</b> processed live records</span>
            <span><b>{mapReadyLive.length}</b> have coordinates</span>
          </div>
        </div>
      </div>
    </section>
    {liveDetail&&<LiveModal notice={liveDetail} close={()=>setLiveDetail(null)}/>}
  </Shell>;

  const showDecisionTools=view==='Decisions';
  const visible= view==='Home' ? filtered.slice(0,6) : filtered;

  return <Shell view={view} saved={saved.length} go={go}>
    <section className="hero"><div className="eyebrow">{view==='Decisions'?'DECISION LIBRARY':view==='Saved'?'YOUR FOLLOWING':'THE TORONTO EDITION'}</div><h1>{view==='Decisions'?'Explore municipal decisions.':view==='Saved'?'Stories you saved.':<>Your city. <em>In the open.</em></>}</h1><p className="lead">{view==='Decisions'?'Browse by topic, search the archive, and open the source-backed details.':view==='Saved'?'Keep important local decisions in one place.':'The decisions shaping your neighbourhood, made easier to understand.'}</p>{view==='Home'&&<p className="disclaimer">Selected Toronto decisions · 2024–2026. Archive summaries are curated; live records are fetched from Toronto Public Notices.</p>}</section>

    {view==='Home'&&<section className="live-panel"><div className="live-panel-head"><div><div className="eyebrow">LIVE DATA BETA</div><h2>Latest Toronto notices, simplified locally.</h2><p>Fetch current public notices, then use your local Qwen3.5:4b model to rewrite new or changed records in plain English.</p></div><button className="primary" onClick={sync} disabled={syncing}>{syncing?'Updating…':'Update data'}</button></div><div className="live-status"><span><b>{live.length}</b> processed records stored locally</span><span>{message||'The official source remains the source of truth.'}</span></div>{live.length?<div className="live-grid">{live.slice(0,5).map((n)=><article className="live-card" key={n.id}><span className="topic">{n.topics[0]||'Public notice'}</span><h3><button onClick={()=>setLiveDetail(n)}>{n.simple.plainTitle||n.title}</button></h3><p>{n.simple.whatIsHappening}</p><div className="live-card-meta">{n.simple.decisionStage} · {n.simple.where}</div></article>)}</div>:<div className="live-empty">No locally processed live records yet. Start Ollama, then click <b>Update data</b>.</div>}</section>}

    {showDecisionTools&&<>
      <SecondaryTopics topic={topic} setTopic={setTopic}/>
      <section className="toolbox"><label className="search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search decisions"/></label><select value={sort} onChange={e=>setSort(e.target.value as 'newest'|'oldest')}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></section>
    </>}

    <div className="list-head"><span className="count">{visible.length} {view==='Saved'?'SAVED':'CURATED'} RECORDS</span>{view==='Home'&&<button className="text-link" onClick={()=>go('Decisions')}>View all decisions →</button>}</div>
    {visible.length?<section className="grid">{visible.map((d)=><article className="story" key={d.id}><div className="story-tags"><span className="topic">{topicLabels[d.topic]||d.topic}</span><span className="status">{d.status}</span></div><h3><button onClick={()=>setDetail(d)}>{d.title}</button></h3><p className="summary">{d.summary}</p><div className="story-bottom"><div className="story-meta"><span>{d.date}</span><span>Toronto · {d.area}</span></div><button className={`save ${saved.includes(d.id)?'saved':''}`} onClick={()=>setSaved(s=>s.includes(d.id)?s.filter(x=>x!==d.id):[...s,d.id])}>{saved.includes(d.id)?'♥ Saved':'♡ Save'}</button></div></article>)}</section>:<div className="empty"><h3>No matching decisions.</h3><p>Change your filters or return to the full feed.</p></div>}

    {detail&&<Modal close={()=>setDetail(null)}><span className="topic">{topicLabels[detail.topic]||detail.topic}</span> <span className="status">{detail.status}</span><h2>{detail.title}</h2><div className="detail-meta">{detail.date} · Toronto · {detail.area}</div><h3>What happened?</h3><p>{detail.summary}</p><p><a href="https://www.toronto.ca/city-government/council/" target="_blank" rel="noreferrer">Browse official council records ↗</a></p></Modal>}
    {liveDetail&&<LiveModal notice={liveDetail} close={()=>setLiveDetail(null)}/>}
  </Shell>;
}

function SecondaryTopics({topic,setTopic}:{topic:string;setTopic:(value:string)=>void}){
  return <section className="secondary-nav"><div className="secondary-label">TOPICS</div><div className="filters">{topics.map(t=><button key={t} className={`pill ${topic===t?'selected':'g'}`} onClick={()=>setTopic(t)}>{t==='Housing'?'Housing & real estate':t==='Budget'?'Taxes & budget':t}</button>)}</div></section>;
}

function LiveModal({notice,close}:{notice:LiveNotice;close:()=>void}){
  return <Modal close={close}><span className="topic">{notice.topics[0]||'Public notice'}</span> <span className="status">{notice.simple.decisionStage}</span><h2>{notice.simple.plainTitle}</h2><div className="detail-meta">AI simplified with {notice.generatedBy}</div><h3>What is happening?</h3><p>{notice.simple.whatIsHappening}</p><h3>Why might this matter?</h3><p>{notice.simple.whyItMatters}</p><h3>Who may be affected?</h3><p>{notice.simple.whoMayBeAffected}</p><h3>Where?</h3><p>{notice.simple.where}</p><div className="detail-callout"><strong>How can residents participate?</strong><p>{notice.simple.howToParticipate}</p><p><b>Deadline:</b> {notice.simple.participationDeadline}</p></div><h3>Uncertainty</h3><p>{notice.simple.uncertainty}</p><p><a href={notice.sourceUrl} target="_blank" rel="noreferrer">Open official Toronto source ↗</a></p></Modal>;
}

function Shell({view,saved,go,children}:{view:View;saved:number;go:(v:View)=>void;children:React.ReactNode}){
  const nav:[View,string,string][]=[['Home','⌂','Home'],['Map','⌖','Map'],['Decisions','▦','Decisions'],['Participate','◎','Participate'],['Saved','♡','Saved']];
  return <div className="app-shell"><aside className="sidebar"><div className="mark">yc<span>.</span></div><div className="brand-title">Your City<br/>Council</div><div className="locale">◉ Toronto, Ontario</div><div className="nav-label">Explore your city</div><nav>{nav.map(([k,i,l])=><button key={k} className={`nav ${view===k?'active':''}`} onClick={()=>go(k)}><span>{i}</span>{l}{k==='Saved'&&<b className="saved-number">{saved}</b>}</button>)}</nav><div className="sidebar-foot">INDEPENDENT CIVIC PROTOTYPE<br/>Not affiliated with the City of Toronto.</div></aside><div className="main-wrap"><header className="topbar"><span>YOUR CITY COUNCIL <i>/</i> TORONTO</span><span className="top-right">THE TORONTO EDITION <span className="dot"/></span></header><main>{children}</main><footer className="footer">Your City Council · Independent civic information prototype <span>Made for clearer local democracy.</span></footer></div></div>;
}

function Modal({close,children}:{close:()=>void;children:React.ReactNode}){
  return <div className="overlay" onMouseDown={e=>{if(e.currentTarget===e.target)close()}}><article className="modal" role="dialog" aria-modal="true"><button className="x" onClick={close}>×</button>{children}</article></div>;
}
