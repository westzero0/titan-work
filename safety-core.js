/* 안전점검: 폰 화면(safety.html)과 PC 보고서(safety-report.html)가 같이 쓰는 규칙.
 * 여기를 고치면 두 화면이 같이 바뀐다. DOM, 시계, 저장소는 건드리지 않고 값만 받아 값만 돌려준다(오늘 날짜도 인자로 받는다).
 * ES5 문법으로 쓴다(폰 브라우저가 오래돼도 돌아가게). 빌드 없음. */
var SafetyCore=(function(){
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function pad(n){return (n<10?'0':'')+n;}
  /* Date -> 'YYYY-MM-DD' (동선 날짜 id와 같은 모양) */
  function ymd(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
  /* 주소 -> {sido,gu} */
  function region(addr){var p=String(addr||'').trim().split(/\s+/);return {sido:p[0]||'',gu:p[1]||''};}
  function regionText(addr){var r=region(addr);return r.sido+(r.gu?' '+r.gu:'');}
  /* 점검취소는 빼고 센다 -> {d:완료, t:대상, p:%} */
  function progress(list){
    var live=list.filter(function(s){return s.status!=='점검취소';});
    var d=live.filter(function(s){return s.status==='점검완료';}).length;
    return {d:d,t:live.length,p:live.length?Math.round(d/live.length*100):0};
  }
  function remaining(s){return s.status!=='점검완료'&&s.status!=='점검취소';}
  /* 결선도에서 내용이 한 칸이라도 있는 회로만 */
  function circuits(sheet){
    return ((sheet&&sheet.rows)||[]).filter(function(r){return r.name||r.type||r.p||r.at||r.af||r.l1||r.l2||r.l3||r.sq;});
  }
  /* 오늘(todayYmd) 이후 이 점포가 들어 있는 동선 중 가장 빠른 것. routes는 배열. 없으면 null */
  function nextRoute(routes,id,todayYmd){
    var best=null;
    routes.forEach(function(r){if(r.date>=todayYmd&&(r.stops||[]).indexOf(id)>=0&&(!best||r.date<best.date))best=r;});
    return best;
  }
  /* ---- 동선: 누가 어느 날 어디 가는지 (routes는 배열, who는 로그인한 사람 이름) ---- */
  function routeId(date,who){return 'r'+date+'_'+who;}
  function routeOf(routes,date,who){
    var r=null;routes.forEach(function(x){if(!r&&x.date===date&&(x.owner||'')===who)r=x;});return r;
  }
  /* 같은 날 다른 사람의 동선(점포가 있는 것만) */
  function othersOn(routes,date,who){
    return routes.filter(function(x){return x.date===date&&(x.owner||'')!==who&&(x.stops||[]).length;});
  }
  /* 그 날 다른 사람 동선에 이미 있는 점포면 그 사람 이름('미정' 포함), 아니면 '' */
  function takenBy(routes,id,date,who){
    var o='';routes.forEach(function(x){if(!o&&x.date===date&&(x.owner||'')!==who&&(x.stops||[]).indexOf(id)>=0)o=x.owner||'미정';});return o;
  }
  /* 편집 중인 draft -> 저장할 동선. old는 저장돼 있던 같은 동선(없으면 null), now는 현재 시각(ms) */
  function buildRoute(d,who,old,now){
    var id=d.id||routeId(d.date,who);
    return {id:id,name:d.name||'',owner:who,date:d.date,start:d.start||'09:00',work:d.work||60,stops:d.stops.slice(),created:(old&&old.created)||now};
  }
  /* 저장된 동선(없으면 빈 것) -> 편집용 draft */
  function draftOf(r,date){
    return r?{id:r.id,name:r.name||'',date:date,start:r.start||'09:00',work:r.work||60,stops:(r.stops||[]).slice()}:{id:null,name:'',date:date,start:'09:00',work:60,stops:[]};
  }
  /* 두 좌표 [위도,경도]의 직선거리(km) */
  function km(a,b){var t=Math.PI/180,dl=(b[0]-a[0])*t,dn=(b[1]-a[1])*t;var h=Math.sin(dl/2)*Math.sin(dl/2)+Math.cos(a[0]*t)*Math.cos(b[0]*t)*Math.sin(dn/2)*Math.sin(dn/2);return 12742*Math.asin(Math.sqrt(h));}
  /* 가까운 점포부터 이어 붙인 순서. pos는 {점포id:[위도,경도]}, start는 출발 좌표 또는 null */
  function orderNear(list,pos,start){
    var left=list.slice(),out=[],cur=start;
    while(left.length){
      var bi=0,bd=1e9;
      left.forEach(function(s,i){var p=pos[s.id];var d=(cur&&p)?km(cur,p):i;if(d<bd){bd=d;bi=i;}});
      var n=left.splice(bi,1)[0];out.push(n);cur=pos[n.id]||cur;
    }
    return out;
  }
  /* 시간표: 이동시간은 직선거리x1.4 / 45km/h 추정(최소 5분). startMin은 시작 시각(분), work는 점포당 작업 분 */
  function schedule(list,pos,startMin,work){
    var cur=startMin,w=parseInt(work,10)||60,out=[],prev=null;
    list.forEach(function(s){
      var trav=0;if(prev&&pos[prev.id]&&pos[s.id])trav=Math.max(5,Math.round(km(pos[prev.id],pos[s.id])*1.4/45*60));
      cur+=trav;out.push({s:s,trav:trav,a:cur,e:cur+w});cur+=w;prev=s;
    });
    return out;
  }
  /* 결선도 한 장(A4 세로)의 안쪽 markup. sheet는 {panel,incoming,rows[]} 또는 없음 */
  function paperHTML(s,sheet){
    var sh=sheet||{},rows=sh.rows||[],n=Math.max(40,rows.length),b='',i,r;
    for(i=0;i<n;i++){
      r=rows[i]||{};
      b+='<tr><td>'+(i+1)+'</td><td class="l">'+esc(r.name)+'</td><td>'+['MDDB','ELB'].map(function(t){return r.type===t?'<span class="cir">'+t+'</span>':t;}).join(' / ')+'</td><td>'+esc(r.p)+'</td><td>'+esc(r.at)+'</td><td>'+esc(r.af)+'</td><td>'+esc(r.l1)+'</td><td>'+esc(r.l2)+'</td><td>'+esc(r.l3)+'</td><td>'+esc(r.sq)+'</td></tr>';
    }
    return '<h1>분전반 결선도</h1>'+
     '<table class="top2"><tr><th>점포명</th><td colspan="3">'+esc(s.name)+' ('+esc(s.code)+')</td></tr><tr><th>PANE NAME</th><td>'+esc(sh.panel)+'</td><th>인입방식</th><td>'+esc(sh.incoming)+'</td></tr></table>'+
     '<table><colgroup><col style="width:8mm"><col style="width:73mm"><col style="width:26mm"><col style="width:9mm"><col style="width:11mm"><col style="width:11mm"><col style="width:12mm"><col style="width:12mm"><col style="width:12mm"><col style="width:16mm"></colgroup>'+
     '<thead><tr><th rowspan="2">번호</th><th rowspan="2">회로명</th><th colspan="4">차단기 특성</th><th colspan="3">측정치(A)</th><th rowspan="2">전선규격<br>(sq)</th></tr><tr><th>종류</th><th>P</th><th>AT</th><th>AF</th><th>L1</th><th>L2</th><th>L3</th></tr></thead><tbody>'+b+'</tbody></table>';
  }
  /* paperHTML이 쓰는 종이 모양 CSS. sel = 그 markup을 담는 요소의 선택자 (예: '#printsheet', '.paper') */
  function paperCss(sel){
    return sel+'{color:#000;background:#fff;font-size:9pt;line-height:1.25}'+
     sel+' h1{margin:0 0 3mm;text-align:center;font-size:15pt}'+
     sel+' table{width:100%;border-collapse:collapse;table-layout:fixed}'+
     sel+' th,'+sel+' td{border:1px solid #000;padding:0 1mm;height:5.4mm;text-align:center;overflow:hidden;white-space:nowrap;background:#fff}'+
     sel+' td.l{text-align:left}'+
     sel+' th{background:#eee}'+
     sel+' thead{display:table-header-group}'+
     sel+' tr{page-break-inside:avoid}'+
     sel+' .top2{margin-bottom:2mm}'+
     sel+' .top2 th{width:30mm}'+
     sel+' .top2 td{text-align:left;height:7mm}'+
     sel+' .cir{border:1px solid #000;border-radius:50%;padding:0 1.2mm;font-weight:700}';
  }
  return {esc:esc,pad:pad,ymd:ymd,region:region,regionText:regionText,progress:progress,remaining:remaining,circuits:circuits,nextRoute:nextRoute,routeId:routeId,routeOf:routeOf,othersOn:othersOn,takenBy:takenBy,buildRoute:buildRoute,draftOf:draftOf,km:km,orderNear:orderNear,schedule:schedule,paperHTML:paperHTML,paperCss:paperCss};
})();
/* 자체 점검: 브라우저 콘솔에서 SafetyCore.selfTest() -> true */
SafetyCore.selfTest=function(){
  var C=SafetyCore,a=function(c,m){if(!c)throw new Error('selfTest: '+m);};
  a(C.esc('<a&"\'>')==='&lt;a&amp;&quot;&#39;&gt;','esc');
  a(C.ymd(new Date(2026,0,5))==='2026-01-05','ymd');
  a(C.region('서울 강북구 수유동').gu==='강북구'&&C.regionText('서울')==='서울','region');
  var p=C.progress([{status:'점검완료'},{status:'미정'},{status:'점검취소'}]);
  a(p.d===1&&p.t===2&&p.p===50,'progress');
  a(C.circuits({rows:[{},{name:'x'}]}).length===1,'circuits');
  var r=C.nextRoute([{date:'2026-10-01',stops:['s1']},{date:'2026-10-20',stops:['s1']},{date:'2026-10-15',stops:['s1']}],'s1','2026-10-10');
  a(r&&r.date==='2026-10-15','nextRoute');
  a(C.paperHTML({name:'A',code:'1'},null).indexOf('<tr>')>0,'paperHTML');
  var rs=[{id:'r1',date:'2026-10-14',owner:'서영',stops:['s1']},{id:'r2',date:'2026-10-14',owner:'기원',stops:['s2','s3']},{id:'r3',date:'2026-10-14',owner:'창재',stops:[]}];
  a(C.routeOf(rs,'2026-10-14','기원').id==='r2'&&!C.routeOf(rs,'2026-10-15','기원'),'routeOf');
  a(C.othersOn(rs,'2026-10-14','서영').length===1,'othersOn(빈 동선 제외)');
  a(C.takenBy(rs,'s3','2026-10-14','서영')==='기원'&&C.takenBy(rs,'s1','2026-10-14','서영')==='','takenBy');
  var b=C.buildRoute({id:null,date:'2026-10-14',stops:['s1'],name:'',work:0},'서영',null,5);
  a(b.id==='r2026-10-14_서영'&&b.created===5&&b.start==='09:00'&&b.work===60,'buildRoute');
  a(C.draftOf(null,'2026-10-14').stops.length===0&&C.draftOf(b,'2026-10-14').id===b.id,'draftOf');
  var pos={a:[37.5,127],b:[37.51,127],c:[35,129]},ord=C.orderNear([{id:'c'},{id:'b'}],pos,pos.a);
  a(ord[0].id==='b','orderNear');
  var sc=C.schedule([{id:'a'},{id:'b'}],pos,540,60);
  a(sc[0].a===540&&sc[1].trav>=5&&sc[1].a===540+60+sc[1].trav,'schedule');
  return true;
};
