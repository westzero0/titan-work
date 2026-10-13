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
  return {esc:esc,pad:pad,ymd:ymd,region:region,regionText:regionText,progress:progress,remaining:remaining,circuits:circuits,nextRoute:nextRoute,paperHTML:paperHTML,paperCss:paperCss};
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
  return true;
};
