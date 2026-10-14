/* 안전점검: 현장 사진 (폰에서 찍어 점포에 붙이고, 나중에 확인한다)
 * - 찍은 사진은 긴 변 2560px(JPEG)로 줄이고, 목록용 작은 사진(320px)도 같이 만든다.
 * - 올리는 일은 뒤에서 한다. 폰(IndexedDB)에 먼저 쌓고, 연결되면 하나씩 서버(Apps Script -> 드라이브)로 보낸다.
 * - 올리기가 끝나면 시트의 photos 컬렉션에 {store, fileId, thumbId, at, by} 한 줄을 적는다(db.doc('photos/<id>').set).
 * - 서버가 아직 사진 동작을 모르면(구버전) 이 module은 enabled()=false 이고 화면에 아무것도 안 나온다.
 * 의존: 전역 sendToGas (common.js). 화면은 건드리지 않고 onChange 로만 알린다. */
var SafetyPhoto=(function(){
  var MAX_EDGE=2560,Q_FULL=0.85,THUMB=320,Q_THUMB=0.7,LIMIT=10;
  var cfg={db:null,onChange:function(){},who:function(){return '';}};
  var pend=[];          // 아직 서버에 못 올린 사진 [{id,storeId,code,at,by,tries,jpg,thumb,thumbURL}]
  var thumbs={};        // 사진 번호 -> 목록용 사진 objectURL
  var asking={},bad={}; // 서버에서 가져오는 중 / 가져오지 못한 목록용 사진
  var idb=null,mem={up:{},th:{}},uploading=false,retryT=null;

  function enabled(){try{return window.SAFETY_PHOTO===true||localStorage.getItem('safety-photo-ok')==='1';}catch(e){return window.SAFETY_PHOTO===true;}}
  function notify(){try{cfg.onChange();}catch(e){}}

  /* ---------- 폰 저장소 (IndexedDB, 안 되면 이 화면을 닫을 때까지만 메모리) ---------- */
  function open(){
    if(idb)return idb;
    idb=new Promise(function(res){
      try{
        var rq=indexedDB.open('safety-photo-v1',1);
        rq.onupgradeneeded=function(){var d=rq.result;d.createObjectStore('up',{keyPath:'id'});d.createObjectStore('th');};
        rq.onsuccess=function(){res(rq.result);};
        rq.onerror=function(){res(null);};
      }catch(e){res(null);}
    });
    return idb;
  }
  function tx(store,mode,fn){
    return open().then(function(d){
      if(!d)return fn(null);
      return new Promise(function(res){
        var t=d.transaction(store,mode),s=t.objectStore(store),out=fn(s);
        t.oncomplete=function(){res(out&&out.result!==undefined?out.result:out);};t.onerror=t.onabort=function(){res(null);};
      });
    });
  }
  function idbPut(store,val,key){return tx(store,'readwrite',function(s){if(!s){mem[store==='up'?'up':'th'][key||val.id]=val;return;}return key!=null?s.put(val,key):s.put(val);});}
  function idbDel(store,key){return tx(store,'readwrite',function(s){if(!s){delete mem[store==='up'?'up':'th'][key];return;}return s.delete(key);});}
  function idbAll(store){
    return open().then(function(d){
      if(!d)return Object.keys(mem[store]).map(function(k){return mem[store][k];});
      return new Promise(function(res){var r=d.transaction(store).objectStore(store).getAll();r.onsuccess=function(){res(r.result||[]);};r.onerror=function(){res([]);};});
    });
  }
  function idbGet(store,key){
    return open().then(function(d){
      if(!d)return mem[store][key]||null;
      return new Promise(function(res){var r=d.transaction(store).objectStore(store).get(key);r.onsuccess=function(){res(r.result||null);};r.onerror=function(){res(null);};});
    });
  }

  /* ---------- 줄이기 ---------- */
  function shrink(file,edge,q){
    return new Promise(function(res,rej){
      var u=URL.createObjectURL(file),im=new Image();
      im.onload=function(){
        var sc=Math.min(1,edge/Math.max(im.naturalWidth,im.naturalHeight)),w=Math.max(1,Math.round(im.naturalWidth*sc)),h=Math.max(1,Math.round(im.naturalHeight*sc));
        var cv=document.createElement('canvas');cv.width=w;cv.height=h;cv.getContext('2d').drawImage(im,0,0,w,h);
        URL.revokeObjectURL(u);
        cv.toBlob(function(b){b?res(b):rej(new Error('변환 실패'));},'image/jpeg',q);
      };
      im.onerror=function(){URL.revokeObjectURL(u);rej(new Error('읽기 실패'));};
      im.src=u;
    });
  }
  function b64(blob){return new Promise(function(res,rej){var r=new FileReader();r.onload=function(){res(String(r.result).split(',')[1]||'');};r.onerror=function(){rej(new Error('읽기 실패'));};r.readAsDataURL(blob);});}
  function fromB64(s){var bin=atob(s),n=bin.length,a=new Uint8Array(n);for(var i=0;i<n;i++)a[i]=bin.charCodeAt(i);return new Blob([a],{type:'image/jpeg'});}
  function newId(){return 'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
  function withTimeout(p,ms){return Promise.race([p,new Promise(function(_,rej){setTimeout(function(){rej(new Error('timeout'));},ms);})]);}

  /* ---------- 추가 ---------- */
  /* file 하나를 점포에 붙인다. 폰에 바로 보이고, 올리기는 뒤에서 한다. */
  function add(file,store){
    return Promise.all([shrink(file,MAX_EDGE,Q_FULL),shrink(file,THUMB,Q_THUMB)]).then(function(r){
      var p={id:newId(),storeId:store.id,code:store.code,at:Date.now(),by:cfg.who(),tries:0,jpg:r[0],thumb:r[1]};
      p.thumbURL=URL.createObjectURL(p.thumb);thumbs[p.id]=p.thumbURL;
      pend.push(p);
      return idbPut('up',{id:p.id,storeId:p.storeId,code:p.code,at:p.at,by:p.by,tries:0,jpg:p.jpg,thumb:p.thumb}).then(function(){notify();flush();});
    });
  }

  /* ---------- 올리기 (하나씩, 실패하면 조금 뒤 다시) ---------- */
  function flush(){
    if(uploading||!pend.length||!cfg.db)return;
    clearTimeout(retryT);
    var p=pend[0];uploading=true;notify();
    Promise.all([b64(p.jpg),b64(p.thumb)]).then(function(r){
      return withTimeout(sendToGas('safetyPhotoPut',{id:p.id,code:p.code,jpg:r[0],thumb:r[1]}),120000);
    }).then(function(r){
      if(!r||r.res!=='SUCCESS'||!r.fileId)throw new Error((r&&(r.msg||r.message))||'서버 오류');
      return cfg.db.doc('photos/'+p.id).set({store:p.storeId,fileId:r.fileId,thumbId:r.thumbId||'',at:p.at,by:p.by}).then(function(){
        idbPut('th',p.thumb,p.id);
        pend=pend.filter(function(x){return x!==p;});
        return idbDel('up',p.id);
      });
    }).then(function(){uploading=false;notify();flush();},function(){
      p.tries++;uploading=false;notify();
      retryT=setTimeout(flush,Math.min(120000,10000*p.tries));
    });
  }

  /* ---------- 서버에서 가져오기 ---------- */
  function fetchBatch(ids){
    return withTimeout(sendToGas('safetyPhotoGet',{ids:ids}),90000).then(function(r){
      if(!r||r.res!=='SUCCESS')throw new Error('서버 오류');return r.data||[];
    });
  }
  /* 목록용 작은 사진: 이미 있으면 바로, 없으면 한꺼번에 가져와서 onChange */
  function thumbURL(ph){
    if(thumbs[ph.id])return thumbs[ph.id];
    if(!ph.thumbId||asking[ph.id]||bad[ph.id])return '';
    asking[ph.id]=1;
    idbGet('th',ph.id).then(function(b){
      if(b){thumbs[ph.id]=URL.createObjectURL(b);delete asking[ph.id];notify();return;}
      scheduleFetch();
    });
    return '';
  }
  var fetchT=null;
  function scheduleFetch(){
    clearTimeout(fetchT);
    fetchT=setTimeout(function(){
      var ids=Object.keys(asking).filter(function(id){return !thumbs[id];});
      if(!ids.length)return;
      var byThumb=ids.map(function(id){var ph=cfg.photos&&cfg.photos()[id];return ph?{id:id,tid:ph.thumbId}:null;}).filter(Boolean).slice(0,12);
      if(!byThumb.length)return;
      fetchBatch(byThumb.map(function(x){return x.tid;})).then(function(rows){
        rows.forEach(function(row){
          var x=byThumb.filter(function(y){return y.tid===row.id;})[0];if(!x)return;
          delete asking[x.id];
          if(row.b64){var b=fromB64(row.b64);thumbs[x.id]=URL.createObjectURL(b);idbPut('th',b,x.id);}else bad[x.id]=1;
        });
        notify();
        if(Object.keys(asking).some(function(id){return !thumbs[id]&&!bad[id];}))scheduleFetch();
      }).catch(function(){byThumb.forEach(function(x){delete asking[x.id];});});
    },200);
  }
  /* 큰 사진: Promise<objectURL>. 아직 못 올린 사진은 폰에 있는 것을 그대로 */
  function fullURL(ph){
    var local=pend.filter(function(p){return p.id===ph.id;})[0];
    if(local)return Promise.resolve(URL.createObjectURL(local.jpg));
    return fetchBatch([ph.fileId]).then(function(rows){
      var row=rows[0];if(!row||!row.b64)throw new Error('사진을 가져오지 못했어요');
      return URL.createObjectURL(fromB64(row.b64));
    });
  }

  /* ---------- 지우기 ---------- */
  function remove(ph){
    var local=pend.filter(function(p){return p.id===ph.id;})[0];
    if(local){pend=pend.filter(function(p){return p!==local;});delete thumbs[ph.id];notify();return idbDel('up',ph.id);}
    delete thumbs[ph.id];
    var ids=[ph.fileId,ph.thumbId].filter(Boolean);
    return cfg.db.doc('photos/'+ph.id).delete().then(function(){
      idbDel('th',ph.id);
      /* 서버 파일은 드라이브 휴지통으로 간다. 실패해도 목록에서는 이미 사라졌다. */
      return withTimeout(sendToGas('safetyPhotoDel',{ids:ids}),60000).catch(function(){return null;});
    });
  }

  /* ---------- 점포 한 곳의 사진 목록: 올라간 것 + 올리는 중인 것, 오래된 순 ---------- */
  function list(storeId,photos){
    var out=[];
    Object.keys(photos||{}).forEach(function(id){var p=photos[id];if(p&&p.store===storeId)out.push({id:id,fileId:p.fileId,thumbId:p.thumbId,at:p.at||0,by:p.by||'',state:'done'});});
    pend.forEach(function(p){if(p.storeId===storeId)out.push({id:p.id,at:p.at,by:p.by,state:p.tries?'fail':'wait'});});
    out.sort(function(a,b){return a.at-b.at;});
    return out;
  }
  function pendingCount(){return pend.length;}

  function init(o){
    cfg.db=o.db;cfg.onChange=o.onChange||cfg.onChange;cfg.who=o.who||cfg.who;cfg.photos=o.photos;
    idbAll('up').then(function(rows){
      rows.forEach(function(r){
        if(pend.some(function(p){return p.id===r.id;}))return;
        r.thumbURL=URL.createObjectURL(r.thumb);thumbs[r.id]=r.thumbURL;pend.push(r);
      });
      if(rows.length)notify();flush();
    });
    window.addEventListener('online',flush);
    document.addEventListener('visibilitychange',function(){if(!document.hidden)flush();});
    window.addEventListener('safety-retry',flush);
  }
  return {init:init,enabled:enabled,add:add,list:list,thumbURL:thumbURL,fullURL:fullURL,remove:remove,pendingCount:pendingCount,LIMIT:LIMIT,flush:flush};
})();
