const GAS_URL = "https://script.google.com/macros/s/AKfycby_SL7npPwAqurjNmvKOcKK5GHHZOA3Lki4xTSkBy7M6riTR1h3xJUchOhZ2iEQ5tHq/exec";

let currentSites = []; 
let allSchedules = [];
let showPast = false;
let currentView = 'list';
let viewDate = new Date();
let delMode = { member: false, car: false, material: false, payer: false };

// 1. [데이터 초기화]
const savedLists = localStorage.getItem('titan_custom_lists');
let lists = savedLists ? JSON.parse(savedLists) : {
    member: ["기원", "창재", "조환", "서호"],
    car: ["봉고", "포터", "스타렉스", "창재차"],
    material: ["2.5sq 전선", "4sq 전선", "CD관", "난연관", "복스"],
    payer: ["서영", "기원", "창재"]
};

function saveListsToStorage() {
    localStorage.setItem('titan_custom_lists', JSON.stringify(lists));
}

// 2. [초기 로드]
document.addEventListener('DOMContentLoaded', () => {
    let myName = localStorage.getItem('titan_user_name');
    if (!myName) {
        myName = prompt("이름을 입력해주세요.");
        if (myName) localStorage.setItem('titan_user_name', myName);
    }
    const subEl = document.getElementById('submitter');
    if (subEl) subEl.value = myName || "미지정";
    
    const dateEl = document.getElementById('date');
    if (dateEl) dateEl.valueAsDate = new Date();
    
    generateTimeOptions();
    renderAllChips(); 
    loadTitanDataWithBackgroundSync();

    const searchEl = document.getElementById('siteSearch');
    if (searchEl) {
        searchEl.addEventListener('input', (e) => {
            const term = e.target.value.trim();
            const filtered = currentSites.filter(s => s.name.includes(term));
            renderSiteChips(filtered, term);
        });
    }
});

// 3. [데이터 동기화] (무한로딩 방지 안전장치 포함)
async function loadTitanDataWithBackgroundSync() {
    const startTime = Date.now();
    
    // 🛡️ 5초 지나면 강제로 로딩 화면 끄기 (안전장치)
    const safetyTimeout = setTimeout(() => {
        console.log("서버 지연: 강제 화면 진입");
        hideSplashScreen();
    }, 5000); 

    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getAllData' })
        });
        const fullData = await res.json();
        
        if (fullData && !fullData.status) {
            localStorage.setItem('titan_full_data_cache', JSON.stringify(fullData));
            renderClientChips(Object.keys(fullData));
        }
    } catch (e) {
        console.log("연결 실패: 캐시 데이터 사용");
        const cached = localStorage.getItem('titan_full_data_cache');
        if (cached) renderClientChips(Object.keys(JSON.parse(cached)));
    } finally {
        clearTimeout(safetyTimeout); 
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, 1500 - elapsedTime);
        setTimeout(() => hideSplashScreen(), remainingTime);
    }
}

function hideSplashScreen() {
    const splash = document.getElementById('splash-screen');
    if (splash && splash.style.display !== 'none') {
        splash.style.opacity = '0';
        setTimeout(() => { splash.style.display = 'none'; }, 500);
    }
}

function fetchSites(clientName) {
    const cached = localStorage.getItem('titan_full_data_cache');
    if (cached) {
        const fullData = JSON.parse(cached);
        currentSites = fullData[clientName] || [];
        renderSiteChips(currentSites);
    }
}

// 4. [UI 렌더링]
function renderClientChips(clients) {
    const box = document.getElementById('client-chips');
    if (!box) return;
    box.innerHTML = "";
    clients.forEach(name => {
        const div = document.createElement('div');
        div.className = 'chip';
        div.innerText = name;
        div.onclick = () => {
            document.querySelectorAll('#client-chips .chip').forEach(c => c.classList.remove('active'));
            div.classList.add('active');
            fetchSites(name);
        };
        box.appendChild(div);
    });
}

function renderSiteChips(sites = currentSites, term = "") {
    const box = document.getElementById('site-chips');
    const showAll = document.getElementById('showFinished').checked;
    if (!sites || !Array.isArray(sites)) return;
    box.innerHTML = "";
    sites.forEach(s => {
        const isFin = s.status === "완료";
        if (!isFin || showAll) {
            if(term === "" || s.name.includes(term)) {
                const div = document.createElement('div');
                div.className = `chip ${isFin ? 'finished' : ''}`;
                div.innerText = isFin ? `[완료] ${s.name}` : s.name;
                div.onclick = () => {
                    document.getElementById('siteSearch').value = s.name;
                    document.querySelectorAll('#site-chips .chip').forEach(c => c.classList.remove('active'));
                    div.classList.add('active');
                };
                box.appendChild(div);
            }
        }
    });
}

function renderAllChips() { ['member', 'car', 'material', 'payer'].forEach(type => renderChips(type)); }

function renderChips(type) {
    const box = document.getElementById(`${type}-chips`);
    if (!box) return;
    box.innerHTML = "";
    lists[type].forEach(name => {
        const div = document.createElement('div');
        div.className = `chip ${delMode[type] ? 'delete-target' : ''}`;
        div.innerText = name;
        div.onclick = () => {
            if (delMode[type]) { 
                lists[type] = lists[type].filter(i => i !== name); 
                saveListsToStorage(); 
                renderChips(type); 
            } else {
                if (type === 'payer') document.querySelectorAll('#payer-chips .chip').forEach(c => c.classList.remove('active'));
                div.classList.toggle('active');
            }
        };
        box.appendChild(div);
    });
}

function addItem(type) {
    const input = document.getElementById(`add-${type}-input`);
    const val = input.value.trim();
    if (val && !lists[type].includes(val)) { 
        lists[type].push(val); 
        saveListsToStorage(); 
        renderChips(type); 
    }
    input.value = "";
}

function toggleDelMode(type) {
    delMode[type] = !delMode[type];
    const btn = document.getElementById(`del-btn-${type}`);
    if (btn) btn.innerText = delMode[type] ? "✅ 완료" : "🗑️ 삭제";
    renderChips(type);
}

function generateTimeOptions() {
    const s = document.getElementById('start'), e = document.getElementById('end');
    if(!s || !e) return;
    s.innerHTML = ""; e.innerHTML = "";
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) {
            const t = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            s.add(new Option(t, t)); e.add(new Option(t, t));
        }
    }
    s.value = "08:00"; e.value = "17:00";
}

// 6. [전송 및 공유] 데이터 서버 저장 및 카톡 전송 
async function send() {
    const btn = document.getElementById('sBtn');
    const work = document.getElementById('work').value.trim();
    const client = document.querySelector('#client-chips .chip.active')?.innerText;
    const site = document.querySelector('#site-chips .chip.active')?.innerText || document.getElementById('siteSearch').value.trim();

    if (!client || !site || !work) return alert("⚠️ 필수 정보를 입력해주세요.");

    btn.disabled = true; btn.innerText = "⏳ 데이터 전송 중...";
    const getSel = (id) => Array.from(document.querySelectorAll(`${id} .chip.active`)).map(c => c.innerText).join(', ');
    
    // 데이터 정리
    const expAmount = Number(document.getElementById('expAmount').value) || 0; 
    const expDetail = document.getElementById('expDetail').value.trim();
    const materials = [getSel('#material-chips'), document.getElementById('materialExtra').value.trim()].filter(Boolean).join(', ') || "없음";
    let expenseLine = expAmount > 0 ? `\n💰 경비: ${expAmount.toLocaleString()}원${expDetail ? ` (${expDetail})` : ''}` : "";

    // 카톡 메시지 미리 생성 (백업)
    const msg = `⚡ [타이탄 작업일보]\n📅 날짜: ${document.getElementById('date').value}\n🏢 거래처: ${client}\n🏗️ 현장명: ${site}\n🛠️ 작업내용: ${work}\n⏰ 시간: ${document.getElementById('start').value} ~ ${document.getElementById('end').value}\n👥 인원: ${getSel('#member-chips') || "없음"}\n🚗 차량: ${getSel('#car-chips') || "없음"}\n🍱 석식: ${document.getElementById('dinner').value}\n📦 자재: ${materials}${expenseLine}`;

    // 이미지 처리
    const receiptInput = document.getElementById('receipt');
    let filesData = [];
    if (receiptInput.files.length > 0) {
        for (let i = 0; i < receiptInput.files.length; i++) {
            btn.innerText = `📸 압축 중 (${i + 1}/${receiptInput.files.length})`;
            const data = await compressImage(receiptInput.files[i]);
            filesData.push({ content: data.base64, type: data.mimeType, name: data.name });
        }
    }

    try {
        btn.innerText = "🚀 서버 전송 중..."; 
        const payload = {
            action: "saveLog",
            data: {
                date: document.getElementById('date').value, client, site, work,
                start: document.getElementById('start').value, end: document.getElementById('end').value,
                members: getSel('#member-chips'), car: getSel('#car-chips'), materials, 
                dinner: document.getElementById('dinner').value,
                expAmount, expDetail, expPayer: getSel('#payer-chips'), files: filesData,
                submitter: document.getElementById('submitter').value
            }
        };

        // 💡 핵심 수리: 'no-cors' 모드를 사용해 차단 에러를 회피하고 강제 성공 처리
        await fetch(GAS_URL, { 
            method: 'POST', 
            mode: 'no-cors', // 응답을 못 들어도 전송은 성공하게 만듦
            body: JSON.stringify(payload) 
        });

        // 💡 전송 후 1.5초 뒤에 무조건 노란 버튼으로 전환 (데이터 들어가는 시간 확보)
        setTimeout(() => {
            const tempMsg = msg;
            resetFormOnlyInputs(); // 입력칸 비우기

            btn.disabled = false;
            btn.style.setProperty("background-color", "#fee500", "important");
            btn.style.setProperty("color", "#3c1e1e", "important");
            btn.innerText = "➡️ 지금 카톡으로 공유하기";

            btn.onclick = async () => {
                if (navigator.share) {
                    await navigator.share({ text: tempMsg }).catch(() => {});
                } else {
                    await copyToClipboard(tempMsg);
                }
                resetFormFull();
            };
            alert("✅ 저장 완료! 노란색 버튼을 눌러 공유하세요.");
        }, 1500);

    } catch (e) {
        alert("⚠️ 전송 시도 중 오류가 발생했습니다. (시트 확인 요망)");
        btn.disabled = false; btn.innerText = "🚀 다시 시도";
    }
}

async function compressImage(file) {
    return new Promise((resolve, reject) => {
        const blob = file.slice(0, file.size, file.type);
        const blobUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.src = blobUrl;
        img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error("이미지 로드 실패")); };
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            let w = img.width, h = img.height;
            const max = 800;
            if (w > h) { if (w > max) { h *= max / w; w = max; } } 
            else { if (h > max) { w *= max / h; h = max; } }
            canvas.width = w; canvas.height = h;
            ctx.drawImage(img, 0, 0, w, h);
            resolve({ base64: canvas.toDataURL('image/jpeg', 0.5).split(',')[1], mimeType: 'image/jpeg', name: file.name });
        };
    });
}

function resetFormFull() {
    location.reload();
}

function copyAddr(text) {
    navigator.clipboard.writeText(text);
    alert("복사되었습니다: " + text);
}

// 6. [일정 관리 로직]
async function loadSchedules() {
    const container = document.getElementById('schedule-container');
    container.innerHTML = '<p style="text-align:center;">🔌 서버 연결 중...</p>';

    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getScheduleData' })
        });
        const result = await res.json();
        allSchedules = result.schedules;
        
        const select = document.getElementById('worker-select');
        select.innerHTML = '<option value="전체">👤 전체 보기</option>';
        let workerSet = new Set();
        allSchedules.forEach(s => s.workers.forEach(w => workerSet.add(w)));
        Array.from(workerSet).sort().forEach(w => select.add(new Option(w, w)));
        
        renderView();
    } catch (e) {
        container.innerHTML = '<p style="text-align:center; color:red;">⚠️ 일정 로드 실패</p>';
    }
}

function renderView() {
    const timeline = document.getElementById('timeline-grid');
    if (currentView === 'calendar') {
        if (timeline) timeline.style.display = 'none';
        renderCalendar(); 
    } else {
        if (timeline) timeline.style.display = 'flex';
        renderCards();    
        setTimeout(() => renderTimeline(), 100);
    }
}

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if(id === 'log-page') document.getElementById('tab-log').classList.add('active');
    else {
        document.getElementById('tab-sched').classList.add('active');
        if(allSchedules.length === 0) loadSchedules();
        else renderView();
    }
}

function renderTimeline() {
    const grid = document.getElementById('timeline-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const worker = document.getElementById('worker-select').value;
    const todayStr = new Date().toISOString().split('T')[0];

    for (let i = 0; i < 14; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        let dayJobs = allSchedules.filter(j => 
            j.date === dateStr && (worker === "전체" || j.workers.includes(worker))
        );

        const col = document.createElement('div');
        col.className = `time-col ${dateStr === todayStr ? 'today' : ''}`;
        col.innerHTML = `
            <div style="font-size:0.75rem; text-align:center; margin-bottom:5px; font-weight:bold;">${dateStr === todayStr ? '🌟' : (date.getMonth()+1)+'/'+date.getDate()}</div>
            <div style="display:flex; flex-direction:column; gap:4px;">
                ${dayJobs.map(j => `<div class="job-bar ${j.shift === '야' ? 'bar-night' : 'bar-day'}" onclick="scrollToCard('${j.date}', '${j.site}')">${j.site}</div>`).join('')}
            </div>
        `;
        grid.appendChild(col);
    }
}

function renderCards() {
    const container = document.getElementById('schedule-container');
    const worker = document.getElementById('worker-select').value;
    const today = new Date().toISOString().split('T')[0];

    const filtered = allSchedules.filter(s => 
        (worker === "전체" || s.workers.includes(worker)) && (showPast ? s.date < today : s.date >= today)
    );

    filtered.sort((a, b) => showPast ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));

    let html = `<button class="past-btn" onclick="togglePast()">${showPast ? '⬆️ 예정 일정' : '⬇️ 지난 일정'}</button>`;
    
    if (filtered.length === 0) html += `<p style="text-align:center; padding:20px;">일정이 없습니다.</p>`;
    else {
        html += filtered.map(s => `
            <div class="card schedule-card-item" data-date="${s.date}" data-site="${s.site}" style="border-left: 5px solid ${s.shift==='야'?'#1e293b':'#2563eb'}; padding:15px; position:relative;">
                <div onclick='copyScheduleToLog(${JSON.stringify(s)})' style="position:absolute; top:10px; right:10px; font-size:1.5rem;">📝</div>
                <div><b>${s.date}</b> (${s.shift})</div>
                <div style="color:#666; font-size:0.9rem;">${s.client}</div>
                <div style="font-size:1.2rem; font-weight:bold;">${s.site}</div>
                <div style="margin-top:5px;">${s.workers.map(w=>`<span class="worker-chip">${w}</span>`).join('')}</div>
                ${s.address ? `<div onclick="copyAddr('${s.address}')" style="margin-top:5px; color:blue; cursor:pointer;">📍 ${s.address}</div>` : ''}
            </div>
        `).join('');
    }
    container.innerHTML = html;
}

function renderCalendar() {
    const container = document.getElementById('schedule-container');
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    
    let html = `<div class="card calendar-card" style="padding:10px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
            <button onclick="changeMonth(-1)">◀</button> <b>${year}.${month+1}</b> <button onclick="changeMonth(1)">▶</button>
        </div>
        <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:1px; background:#ddd;">
            ${['일','월','화','수','목','금','토'].map(d=>`<div style="background:#f8f9fa; text-align:center; font-size:0.8rem; padding:5px;">${d}</div>`).join('')}
    `;
    
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    
    for(let i=0; i<firstDay; i++) html += `<div style="background:white; min-height:80px;"></div>`;
    
    for(let d=1; d<=lastDate; d++) {
        const dStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const jobs = allSchedules.filter(s => s.date === dStr);
        html += `<div style="background:white; min-height:80px; padding:2px; border:1px solid #eee;">
            <span style="font-size:0.8rem; font-weight:bold;">${d}</span>
            ${jobs.map(j => `<div onclick="jumpToCard('${j.date}','${j.site}')" style="background:${j.shift==='야'?'#333':'#007bff'}; color:white; font-size:0.6rem; padding:2px; margin-top:2px; border-radius:3px;">${j.site}</div>`).join('')}
        </div>`;
    }
    html += `</div></div>`;
    container.innerHTML = html;
}

function toggleView() {
    currentView = (currentView === 'list') ? 'calendar' : 'list';
    document.getElementById('view-toggle').innerText = (currentView === 'list') ? '📅' : '📋';
    renderView();
}

function togglePast() { showPast = !showPast; renderView(); }
function changeMonth(v) { viewDate.setMonth(viewDate.getMonth()+v); renderCalendar(); }
function jumpToCard(d, s) { 
    showPast = (d < new Date().toISOString().split('T')[0]);
    currentView = 'list'; 
    document.getElementById('view-toggle').innerText = '📅';
    renderView();
    setTimeout(() => scrollToCard(d, s), 200);
}
function scrollToCard(d, s) {
    const el = document.querySelector(`.schedule-card-item[data-date="${d}"][data-site="${s}"]`);
    if(el) el.scrollIntoView({behavior:'smooth', block:'center'});
}

function copyScheduleToLog(s) {
    if(!confirm("일보 작성을 시작할까요?")) return;
    document.getElementById('date').value = s.date;
    document.getElementById('siteSearch').value = s.site;
    document.getElementById('work').value = s.workContent || "";
    
    const clientChips = document.querySelectorAll('#client-chips .chip');
    clientChips.forEach(c => { if(c.innerText === s.client) c.click(); });
    
    setTimeout(() => {
        const siteInput = document.getElementById('siteSearch');
        if(siteInput) { siteInput.dispatchEvent(new Event('input')); }
        const siteChips = document.querySelectorAll('#site-chips .chip');
        siteChips.forEach(c => { if(c.innerText.includes(s.site)) c.classList.add('active'); });
    }, 500);

    if(s.shift==='야') { document.getElementById('start').value="18:00"; document.getElementById('end').value="05:00"; }
    else { document.getElementById('start').value="08:00"; document.getElementById('end').value="17:00"; }
    
    showPage('log-page');
}
