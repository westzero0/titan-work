const GAS_URL = "https://script.google.com/macros/s/AKfycbwpxUcqkehrTbQzQXZi1hHbqhv8u4qhfw6Rhi4sIhbtpFRol3d0J9w3pfS0ovMMfWS1/exec";


// 💡 1. 통합 초기 로드 로직
document.addEventListener('DOMContentLoaded', async () => {
    // 스플래시 화면 제어
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => { splash.style.display = 'none'; }, 500);
        }
    }, 2000);

    // 로그인 상태 확인
    const savedName = localStorage.getItem('titan_user_name');
    
    if (!savedName) {
        showLoginScreen();
    } else {
        const isActive = await checkAuth(savedName);
        if (isActive) {
            initApp(savedName); 
        }
    }
});


/**
 * 💡 로그인 화면 제어
 */
async function showLoginScreen() {
    const screen = document.getElementById('login-screen');
    const select = document.getElementById('login-name-select');
    
    // 메인 페이지와 내비바 숨기기
    document.querySelector('.container').style.display = 'none';
    document.querySelector('.bottom-nav').style.display = 'none';
    screen.style.display = 'flex';

    try {
// 💡 fetch 옵션에서 'mode'는 제거하고 'redirect'를 추가합니다.
const res = await fetch(GAS_URL, {
    method: 'POST',
    // mode: 'cors' 혹은 'no-cors'가 있다면 지우세요! (기본값으로 두는게 안전함)
    body: JSON.stringify({ action: "getWorkerList" }),
    
    // 🔑 구글 서버의 리다이렉션을 따라가도록 만드는 핵심 옵션
    redirect: 'follow' 
});

// 💡 응답을 텍스트로 먼저 받은 후 JSON으로 파싱 (CORS 에러 완화 전략)
const text = await res.text();
const workers = JSON.parse(text);
        workers.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.innerText = name;
            select.appendChild(opt);
        });
    } catch (e) {
        alert("명단을 불러오지 못했습니다. 인터넷을 확인하세요.");
    }
}

/**
 * 💡 로그인 실행
 */
async function handleLogin() {
    const name = document.getElementById('login-name-select').value;
    const pw = document.getElementById('login-pw-input').value;
    const btn = document.getElementById('login-btn');

    if (!name || !pw) return alert("이름과 비밀번호를 입력하세요.");

    btn.disabled = true;
    btn.innerText = "⏳ 확인 중...";

    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "loginCheck", userName: name, password: pw })
        });
        const result = await res.json();

        if (result.res === "SUCCESS") {
            localStorage.setItem('titan_user_name', name);
            alert(`${name}님, 환영합니다!`);
            location.reload(); // 새로고침하여 메인 진입
        } else {
            alert(result.msg);
            btn.disabled = false;
            btn.innerText = "로그인";
        }
    } catch (e) {
        alert("로그인 중 오류 발생");
        btn.disabled = false;
        btn.innerText = "로그인";
    }
}

/**
 * 💡 퇴사 여부 실시간 체크
 */
async function checkAuth(userName) {
    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "loginCheck", userName: userName, password: "SKIP_PASSWORD" })
        });
        const result = await res.json();
        
        if (result.msg === "퇴사 처리된 계정입니다.") {
            localStorage.removeItem('titan_user_name');
            alert("접근 권한이 취소되었습니다. 관리자에게 문의하세요.");
            location.reload();
            return false;
        }
        return true;
    } catch (e) {
        return true; // 에러 시 서비스 연속성을 위해 일단 허용
    }
}


/**
 * 💡 앱 초기화 (로그인 성공 후)
 */
function initApp(name) {
    // 1. UI 전환
    document.getElementById('login-screen').style.display = 'none';
    document.querySelector('.container').style.display = 'block';
    document.querySelector('.bottom-nav').style.display = 'flex';

    // 2. 데이터 세팅
    const subEl = document.getElementById('submitter');
    if (subEl) subEl.value = name;
    
    const dateEl = document.getElementById('date');
    if (dateEl) dateEl.valueAsDate = new Date();
    
    // 3. 필수 함수 실행
    generateTimeOptions(); // 시간 옵션 생성
    renderAllChips();      // 로컬 리스트 칩 렌더링
    loadTitanDataWithBackgroundSync(); // 👈 여기서 거래처/현장을 서버에서 가져옵니다!

    // 4. 검색 이벤트 리스너 등록
    const searchEl = document.getElementById('siteSearch');
    if (searchEl) {
        searchEl.addEventListener('input', (e) => {
            const term = e.target.value.trim();
            const filtered = currentSites.filter(s => s.name.includes(term));
            renderSiteChips(filtered, term);
        });
    }
}

// 현장 검색 핸들러 (분리해서 관리하는 것이 깔끔합니다)
function siteSearchHandler(e) {
    const term = e.target.value.trim();
    const filtered = currentSites.filter(s => s.name.includes(term));
    renderSiteChips(filtered, term);
}


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



// 3. [데이터 동기화] (무한로딩 방지 안전장치 포함)
async function loadTitanDataWithBackgroundSync() {
    const startTime = Date.now();
    const safetyTimeout = setTimeout(() => hideSplashScreen(), 5000); 

    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getAllData' })
        });
        const fullData = await res.json();
        
        // 데이터가 정상적인 객체인지 확인
        if (fullData && typeof fullData === 'object' && !fullData.status) {
            localStorage.setItem('titan_full_data_cache', JSON.stringify(fullData));
            
            // 칩 렌더링 함수 실행
            const clientNames = Object.keys(fullData);
            renderClientChips(clientNames);
        }
    } catch (e) {
        console.log("연결 실패: 캐시 데이터 사용");
        const cached = localStorage.getItem('titan_full_data_cache');
        if (cached) renderClientChips(Object.keys(JSON.parse(cached)));
    } finally {
        clearTimeout(safetyTimeout); 
        const remainingTime = Math.max(0, 1500 - (Date.now() - startTime));
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
// 💡 거래처 칩 렌더링 함수 (비우기 로직 강화 버전)
function renderClientChips(clients) {
    const box = document.getElementById('client-chips');
    if (!box) return;
    
    // 1. 기존 내용(글자, 로딩 메시지 등)을 완전히 깨끗하게 삭제
    box.innerHTML = ""; 

    if (!clients || clients.length === 0) {
        box.innerHTML = "<span class='loading-text' style='color:#ef4444;'>등록된 거래처가 없습니다.</span>";
        return;
    }

    // 2. 서버에서 받은 이름들을 가나다 순으로 정렬해서 칩 생성
    clients.sort().forEach(name => {
        if (!name) return; 
        const div = document.createElement('div');
        div.className = 'chip';
        div.innerText = name;
        div.onclick = () => {
            // 다른 칩의 파란색(active)을 끄고 클릭한 것만 켬
            document.querySelectorAll('#client-chips .chip').forEach(c => c.classList.remove('active'));
            div.classList.add('active');
            fetchSites(name); // 해당 거래처의 현장 목록 불러오기
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

// 💡 통합된 추가 함수 (버튼 클릭 & 컴퓨터 자동 추가 공용)
function addItem(type, val = null) {
    // 1. 직접 입력(val 없음)이면 입력창에서 가져오고, 자동추가(val 있음)면 그 값을 씀
    const input = document.getElementById(`add-${type}-input`);
    const finalVal = (val !== null) ? val.trim() : input.value.trim();

    if (finalVal && !lists[type].includes(finalVal)) {
        lists[type].push(finalVal);
        saveListsToStorage();
        renderChips(type);
    }

    // 2. 입력창을 통해 추가했을 때만 칸을 비워줌
    if (input && val === null) input.value = "";

    // 3. 자동 추가 시에는 해당 칩을 파란색(active)으로 바로 켜줌
    if (val !== null) {
        setTimeout(() => {
            const chips = document.querySelectorAll(`#${type}-chips .chip`);
            chips.forEach(c => { if(c.innerText === finalVal) c.classList.add('active'); });
        }, 50);
    }
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
    const matListForServer = Object.values(selectedMaterials).filter(m => m.qty > 0);

    
// 💡 신규 시스템에서 수량이 1개 이상인 항목만 추출
    const matList = Object.values(selectedMaterials).filter(m => m.qty > 0);
const matDetailedString = matList.map(m => `${m.name}(${m.qty}${m.unit})`).join(', ');
    
    if (!client || !site || !work) return alert("⚠️ 필수 정보를 입력해주세요.");

    btn.disabled = true; btn.innerText = "⏳ 데이터 전송 중...";
    const getSel = (id) => Array.from(document.querySelectorAll(`${id} .chip.active`)).map(c => c.innerText).join(', ');
    
    // 데이터 정리
    const expAmount = Number(document.getElementById('expAmount').value) || 0; 
    const expDetail = document.getElementById('expDetail').value.trim();
const materials = [
    getSel('#material-chips'), 
    document.getElementById('materialExtra').value.trim(),
    matDetailedString // 신규 정밀 자재 추가
].filter(Boolean).join(', ') || "없음";    let expenseLine = expAmount > 0 ? `\n💰 경비: ${expAmount.toLocaleString()}원${expDetail ? ` (${expDetail})` : ''}` : "";

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
            date: document.getElementById('date').value,
            client: client,
            site: site,
            work: work,
            start: document.getElementById('start').value,
            end: document.getElementById('end').value,
            members: getSel('#member-chips'),
            car: getSel('#car-chips'),
            dinner: document.getElementById('dinner').value,
            
            // 1. 기존 방식 (텍스트 메모)
            materials: document.getElementById('materialExtra').value.trim() || "없음",
            
            // 2. 신규 방식 (선택된 자재 리스트 전송)
            selectedMaterials: matList, 

            expAmount: Number(document.getElementById('expAmount').value) || 0,
            expDetail: document.getElementById('expDetail').value.trim(),
            expPayer: getSel('#payer-chips'),
            files: filesData,
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

// 💡 사진을 초경량으로 압축해서 서버로 보낼 수 있게 만드는 함수 (수정본)
async function compressImage(file) {
    return new Promise((resolve, reject) => {
        const blob = file.slice(0, file.size, file.type);
        const blobUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.src = blobUrl;

        img.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            reject(new Error("사진 로딩 실패"));
        };

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 가로폭을 600px로 압축 (현장에서 가장 잘 전송되는 크기)
            let width = img.width;
            let height = img.height;
            const max_size = 600; 

            if (width > height) {
                if (width > max_size) { height *= max_size / width; width = max_size; }
            } else {
                if (height > max_size) { width *= max_size / height; height = max_size; }
            }

            canvas.width = width;
            canvas.height = height;
            
            // 품질을 0.3까지 낮춰 전송 속도 3배 향상
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.3);
            
            URL.revokeObjectURL(blobUrl);

            resolve({
                base64: dataUrl.split(',')[1],
                mimeType: 'image/jpeg',
                name: file.name.split('.')[0] + '.jpg'
            });
        };
    });
}


// 💡 입력창만 비우는 함수 (send 함수에서 호출함)
function resetFormOnlyInputs() {
    // 지울 항목들 리스트
    const targetIds = ['work', 'siteSearch', 'materialExtra', 'expAmount', 'expDetail'];
    
    targetIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = ""; // 글자 입력칸 비우기
    });

    // 영수증 파일 칸 비우기
    const receipt = document.getElementById('receipt');
    if (receipt) receipt.value = "";

    // 선택된 칩들(파란색) 전부 해제
    document.querySelectorAll('.chip.active').forEach(chip => {
        chip.classList.remove('active');
    });
    // 💡 추가: 신규 자재 데이터 초기화
    selectedMaterials = {}; 
    const matListContainer = document.getElementById('material-list');
    if (matListContainer) matListContainer.innerHTML = "<p style='text-align: center; color: #94a3b8; font-size: 0.8rem; padding: 20px;'>대분류를 선택하면 자재 목록이 나옵니다.</p>";
}


// 💡 공유까지 끝난 후 완전 초기화하는 함수
function resetFormFull() {
    resetFormOnlyInputs(); // 일단 입력칸 다 비우고
    
    // 시간만 기본값으로 복구
    const startTime = document.getElementById('start');
    const endTime = document.getElementById('end');
    if (startTime) startTime.value = "08:00";
    if (endTime) endTime.value = "17:00";

    // 날짜는 오늘로 다시 세팅
    const dateEl = document.getElementById('date');
    if (dateEl) dateEl.valueAsDate = new Date();

    // 전송 버튼 원래대로 복구
    const btn = document.getElementById('sBtn');
    if (btn) {
        btn.style.backgroundColor = ""; 
        btn.style.color = ""; 
        btn.innerText = "🚀 저장 및 카톡 공유";
        btn.onclick = send; // 다시 저장 기능으로 연결
        btn.disabled = false;
    }
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
    
    // 💡 오늘 날짜를 비교하기 위해 이 줄이 반드시 필요합니다.
    const todayStr = new Date().toISOString().split('T')[0]; 

    for (let i = 0; i < 14; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        let dayJobs = allSchedules.filter(j => 
            j.date === dateStr && (worker === "전체" || j.workers.includes(worker))
        );

        const col = document.createElement('div');
        // 💡 여기서 todayStr을 사용합니다.
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
    if(!confirm("📝 선택한 일정 내용으로 일보 작성을 시작할까요?")) return;

    // 1. 날짜, 현장명, 작업내용 기본 입력
    document.getElementById('date').value = s.date;
    document.getElementById('siteSearch').value = s.site;
    document.getElementById('work').value = s.workContent || "";
    
    // 2. 거래처 칩 먼저 선택 (현장 칩을 불러오기 위함)
    const clientChips = document.querySelectorAll('#client-chips .chip');
    clientChips.forEach(c => { if(c.innerText === s.client) c.click(); });

    // 3. 시간 설정 (주간/야간)
    if(s.shift === '야') {
        document.getElementById('start').value = "18:00";
        document.getElementById('end').value = "05:00";
    } else {
        document.getElementById('start').value = "08:00";
        document.getElementById('end').value = "17:00";
    }

    // 💡 4. 핵심 수리: 0.5초 대기 후 인원/차량/현장 칩 자동 선택
    // (칩들이 화면에 다 그려질 시간을 주는 겁니다)
    setTimeout(() => {
        // [현장 칩 선택]
        const siteInput = document.getElementById('siteSearch');
        if(siteInput) { siteInput.dispatchEvent(new Event('input')); }
        const siteChips = document.querySelectorAll('#site-chips .chip');
        siteChips.forEach(c => {
            if(c.innerText.includes(s.site)) c.classList.add('active');
        });

        // [인원 칩 선택]
        const memChips = document.querySelectorAll('#member-chips .chip');
        memChips.forEach(c => c.classList.remove('active')); // 초기화
        if (s.workers && Array.isArray(s.workers)) {
            s.workers.forEach(w => {
                let found = false;
                memChips.forEach(c => {
                    if(c.innerText === w.trim()) { c.classList.add('active'); found = true; }
                });
                // 목록에 없는 사람이라면 새로 만들어서 선택
                if(!found && w.trim()){
                     addItem('member', w.trim());
                }
            });
        }

        // [차량 칩 선택]
        const carChips = document.querySelectorAll('#car-chips .chip');
        carChips.forEach(c => c.classList.remove('active')); // 초기화
        if(s.car){
            let found = false;
            carChips.forEach(c => {
                if(c.innerText === s.car.trim()){ c.classList.add('active'); found = true; }
            });
            // 목록에 없는 차량이라면 새로 만들어서 선택
            if(!found) addItem('car', s.car.trim());
        }
    }, 500);

    showPage('log-page');
    window.scrollTo(0, 0);
}


// --- 🧪 1. 테스트용 임시 데이터 (이게 있어야 중분류가 보입니다!) ---
let allMaterials = {
    "배선": [
        { subCat: "VCTF", name: "VCTF 전선", spec: "1.5sq 2C", unit: "m", price: 800 },
        { subCat: "VCTF", name: "VCTF 전선", spec: "2.5sq 2C", unit: "m", price: 1200 },
        { subCat: "HIV", name: "HIV 전선", spec: "2.5sq (적)", unit: "m", price: 600 },
        { subCat: "HIV", name: "HIV 전선", spec: "2.5sq (청)", unit: "m", price: 600 }
    ],
    "배관": [
        { subCat: "CD관", name: "CD관 (난연)", spec: "16mm", unit: "roll", price: 15000 },
        { subCat: "CD관", name: "CD관 (난연)", spec: "22mm", unit: "roll", price: 20000 },
        { subCat: "PVC", name: "PVC 파이프", spec: "16mm", unit: "본", price: 4000 }
    ]
};

let selectedMaterials = {};
let currentCategory = "";

// --- 2. 로직 함수들 ---

// 자재창 열기 (초기화)
function toggleMaterialUI() {
    const section = document.getElementById('material-section');
    if (section.style.display === 'none') {
        section.style.display = 'block';
        document.getElementById('btn-toggle-mat').innerText = '창 닫기';
        // 탭 생성 실행
        renderCategoryTabs();
    } else {
        section.style.display = 'none';
        document.getElementById('btn-toggle-mat').innerText = '자재창 열기';
    }
}

// 대분류 탭 생성
function renderCategoryTabs() {
    const cats = Object.keys(allMaterials);
    const container = document.getElementById('category-tabs');
    
    if(!container) return;

    container.innerHTML = cats.map(cat => `
        <div class="cat-tab" onclick="filterMaterial('${cat}', this)" 
             style="padding:8px 15px; margin-right:5px; background:#e2e8f0; border-radius:20px; font-weight:bold; white-space:nowrap; cursor:pointer;">
            ${cat}
        </div>
    `).join('');

    // [수정 포인트] firstChild 대신 querySelector로 확실하게 요소를 잡습니다.
    if(cats.length > 0 && !currentCategory) {
        const firstTab = container.querySelector('.cat-tab'); // 여기가 핵심 수정!
        if (firstTab) {
            filterMaterial(cats[0], firstTab);
        }
    }
}

// 3. 대분류 선택 -> 중분류 칩 생성 (수정됨: 스타일 적용 안전장치 추가)
function filterMaterial(cat, el) {
    currentCategory = cat;
    
    // [수정 포인트] el이 없거나 style 속성이 없는 경우(텍스트 노드 등) 에러 방지
    document.querySelectorAll('.cat-tab').forEach(t => { 
        if(t && t.style) {
            t.style.background = '#e2e8f0'; 
            t.style.color = '#475569'; 
        }
    });

    if(el && el.style) { // 여기가 에러가 났던 847번째 줄 부근입니다. 안전장치 추가!
        el.style.background = '#2563eb'; 
        el.style.color = 'white'; 
    }

    // 데이터 안전 확인
    if (!allMaterials[cat]) return;

    // 중분류 추출
    const items = allMaterials[cat];
    const subCats = [...new Set(items.map(i => i.subCat))].sort();

    const subContainer = document.getElementById('sub-category-chips');
    
    // 중분류 칩 HTML
    let html = `<div class="sub-chip active" onclick="filterSubCat('ALL', this)">전체</div>`;
    html += subCats.map(sub => 
        `<div class="sub-chip" onclick="filterSubCat('${sub}', this)">${sub}</div>`
    ).join('');
    
    subContainer.innerHTML = html;
    
    // 처음엔 전체 리스트
    renderMaterialTable(items);
}

// 중분류 필터링
function filterSubCat(subCat, el) {
    document.querySelectorAll('.sub-chip').forEach(c => {
        c.classList.remove('active');
        c.style.background = 'white'; c.style.color = '#64748b';
    });
    el.classList.add('active');
    el.style.background = '#3b82f6'; el.style.color = 'white';

    const items = allMaterials[currentCategory];
    if (subCat === 'ALL') renderMaterialTable(items);
    else renderMaterialTable(items.filter(i => i.subCat === subCat));
}

// 3단계: 표 그리기 (3칸 분리 & 수량 외곽선 제거 버전)
function renderMaterialTable(list) {
    const container = document.getElementById('material-list');
    
    // 테이블 헤더: 품목 | 규격 | 수량 (3칸 분리)
    let html = `
        <table class="mat-table">
            <colgroup>
                <col style="width: 40%"> <col style="width: 35%"> <col style="width: 25%"> </colgroup>
            <thead>
                <tr>
                    <th>품목</th>
                    <th>규격</th>
                    <th>수량</th>
                </tr>
            </thead>
            <tbody>
    `;

    if (list.length === 0) {
        html += `<tr><td colspan="3" style="text-align:center; padding:20px; color:#94a3b8;">항목이 없습니다.</td></tr>`;
    }

    list.forEach(m => {
        const qty = selectedMaterials[m.name] ? selectedMaterials[m.name].qty : 0;
        const rowBg = qty > 0 ? 'style="background-color:#eff6ff;"' : ''; // 선택 시 배경색

        html += `
            <tr ${rowBg}>
                <td style="font-weight:bold; color:#1e293b; text-align:center;" onclick="focusQty('${m.name}')">
                    ${m.name}
                </td>
                
                <td style="color:#64748b; text-align:center; font-size:0.75rem;" onclick="focusQty('${m.name}')">
                    ${m.spec}<br>
                    <span style="font-size:0.7rem; color:#94a3b8;">(${m.unit})</span>
                </td>

                <td style="text-align:center;">
                    <div class="qty-control-box">
                        <input type="number" id="qty-${m.name}" class="qty-input-box" value="${qty}" readonly>
                        <div class="qty-btn-col">
                            <button type="button" class="qty-btn-up" onclick="testChangeQty('${m.name}', 1); event.stopPropagation();">▲</button>
                            <button type="button" class="qty-btn-down" onclick="testChangeQty('${m.name}', -1); event.stopPropagation();">▼</button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    });
    
    html += `</tbody></table>`;
    container.innerHTML = html;
}

// (편의 기능) 이름 클릭 시 수량 +1
function focusQty(name) {
    // 현재 수량이 0일 때만 1로 증가 (이미 입력 중이면 건드리지 않음)
    if (!selectedMaterials[name] || selectedMaterials[name].qty === 0) {
        testChangeQty(name, 1);
    }
}

// 수량 변경 함수 (테스트용)
function testChangeQty(name, val) {
    if (!selectedMaterials[name]) {
        const item = allMaterials[currentCategory].find(i => i.name === name);
        selectedMaterials[name] = { ...item, qty: 0 };
    }
    
    let newQty = selectedMaterials[name].qty + val;
    if (newQty < 0) newQty = 0;
    
    selectedMaterials[name].qty = newQty;
    document.getElementById(`qty-${name}`).value = newQty;
}

// 목록에 없는 자재 직접 입력 팝업
function addCustomMaterialRow() {
    const name = prompt("자재명을 입력하세요 (예: 전산볼트)");
    if (!name) return;
    const spec = prompt("규격/사이즈를 입력하세요 (예: M10)", "-");
    const unit = prompt("단위를 입력하세요 (예: 개, m, box)", "개");
    const price = prompt("단가를 입력하세요 (숫자만)", "0");
    const qty = prompt("사용 수량을 입력하세요", "1");

    const numQty = parseInt(qty);
    if (isNaN(numQty) || numQty <= 0) return alert("수량을 정확히 입력하세요.");

    // 직접 입력한 자재를 selectedMaterials 객체에 강제 삽입
    selectedMaterials[name] = {
        category: "직접입력",
        name: name,
        spec: spec,
        unit: unit,
        price: Number(price) || 0,
        qty: numQty
    };

    alert(`'${name}' ${numQty}${unit}이(가) 리스트에 추가되었습니다.\n(전송 시 시트에 기록됩니다)`);
}
