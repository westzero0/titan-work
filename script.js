const GAS_URL = "https://script.google.com/macros/s/AKfycbwD0o90GoUApVhc2hqvemBcwlHsaTBImJqfYtN1dGJ1d4IJERCSq30PSZ5CbZjk1pJL/exec";

let currentSites = []; 

// 1. [데이터 초기화] 저장된 리스트가 있으면 불러오고, 없으면 기본값 사용
const savedLists = localStorage.getItem('titan_custom_lists');
let lists = savedLists ? JSON.parse(savedLists) : {
    member: ["기원", "창재", "조환", "서호"],
    car: ["봉고", "포터", "스타렉스", "창재차"],
    material: ["2.5sq 전선", "4sq 전선", "CD관", "난연관", "복스"],
    payer: ["서영", "기원", "창재"]
};

// 2. [데이터 저장] 리스트가 변경될 때마다 핸드폰에 저장하는 함수
function saveListsToStorage() {
    localStorage.setItem('titan_custom_lists', JSON.stringify(lists));
}

let delMode = { member: false, car: false, material: false, payer: false };

// 3. [초기 로드] 앱 실행 시 실행되는 로직
document.addEventListener('DOMContentLoaded', () => {
    // 사용자 이름 로드
    let myName = localStorage.getItem('titan_user_name');
    if (!myName) {
        myName = prompt("이름을 입력해주세요.");
        if (myName) localStorage.setItem('titan_user_name', myName);
    }
    document.getElementById('submitter').value = myName || "미지정";
    document.getElementById('date').valueAsDate = new Date();
    
    generateTimeOptions();
    renderAllChips(); // 저장된 리스트로 칩 생성
    
    // 거래처/현장 데이터 동기화
    loadTitanDataWithBackgroundSync();

    // 현장 검색 리스너
    document.getElementById('siteSearch').addEventListener('input', (e) => {
        const term = e.target.value.trim();
        const filtered = currentSites.filter(s => s.name.includes(term));
        renderSiteChips(filtered, term);
    });
});

// 3. [데이터 동기화 및 스플래시 화면 제어]
async function loadTitanDataWithBackgroundSync() {

    // 💡 시작 시간을 기록합니다.
    const startTime = Date.now();
    
    const cachedMap = localStorage.getItem('titan_full_data_cache');
    if (cachedMap) { renderClientChips(Object.keys(JSON.parse(cachedMap))); }

    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getAllData' })
        });
        const fullData = await res.json();
        localStorage.setItem('titan_full_data_cache', JSON.stringify(fullData));
        if (!cachedMap) renderClientChips(Object.keys(fullData));
    } catch (e) {
        console.log("오프라인 모드: 캐시 사용");
    } finally {
        // 💡 핵심: 현재 시간과 시작 시간의 차이를 계산합니다.
        const elapsedTime = Date.now() - startTime;
        const minimumDisplayTime = 2000; // 2초 (2000ms)

        // 💡 2초보다 빨리 끝났다면 부족한 시간만큼 기다렸다가 숨깁니다.
        const remainingTime = Math.max(0, minimumDisplayTime - elapsedTime);
        
        setTimeout(() => {
            hideSplashScreen();
        }, remainingTime);
    }
}



function hideSplashScreen() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.style.display = 'none';
        }, 500);
    }
}

function fetchSites(clientName) {
    const cachedMap = localStorage.getItem('titan_full_data_cache');
    if (cachedMap) {
        const fullData = JSON.parse(cachedMap);
        const sites = fullData[clientName] || [];
        currentSites = sites;
        renderSiteChips(sites);
    }
}

// 5. [UI 렌더링] 칩 생성 및 관리 로직
function renderClientChips(clients) {
    const box = document.getElementById('client-chips');
    if (!box) return;
    box.innerHTML = "";
    clients.forEach(name => {
        const div = document.createElement('div');
        div.className = 'chip';
        div.innerText = name;
        div.onclick = async () => {
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
                saveListsToStorage(); // 💡 삭제 시 즉시 저장
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
        saveListsToStorage(); // 💡 추가 시 즉시 저장
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

    btn.disabled = true; btn.innerText = "⏳ 데이터 수집 중...";
    const getSel = (id) => Array.from(document.querySelectorAll(`${id} .chip.active`)).map(c => c.innerText).join(', ');
    
    const startTime = document.getElementById('start').value;
    const endTime = document.getElementById('end').value;
    const members = getSel('#member-chips') || "없음";
    const car = getSel('#car-chips') || "없음";
    const dinner = document.getElementById('dinner').value === "O" ? "O" : "X";
    const materials = [getSel('#material-chips'), document.getElementById('materialExtra').value.trim()].filter(Boolean).join(', ') || "없음";

    const expAmount = Number(document.getElementById('expAmount').value) || 0; 
    const expDetail = document.getElementById('expDetail').value.trim();
    const expPayer = getSel('#payer-chips') || "없음";

    let expenseLine = expAmount > 0 ? `\n💰 경비: ${expAmount.toLocaleString()}원${expDetail ? ` (${expDetail})` : ''}` : "";

    // 📸 [영수증 처리]
    const receiptInput = document.getElementById('receipt');
    const files = receiptInput.files;
    let filesData = [];

    if (files.length > 0) {
        try {
            for (let i = 0; i < files.length; i++) {
                btn.innerText = `📸 압축 중 (${i + 1}/${files.length})`; 
                const data = await compressImage(files[i]); 
                filesData.push({ content: data.base64, type: data.mimeType, name: data.name });
            }
        } catch (err) {
            alert("사진 압축 오류: " + err.message);
            btn.disabled = false; btn.innerText = "🚀 다시 시도";
            return;
        }
    }

    const msg = `⚡ [타이탄 작업일보]\n📅 날짜: ${document.getElementById('date').value}\n🏢 거래처: ${client}\n🏗️ 현장명: ${site}\n🛠️ 작업내용: ${work}\n⏰ 시간: ${startTime} ~ ${endTime}\n👥 인원: ${members}\n🚗 차량: ${car}\n🍱 석식: ${dinner}\n📦 자재: ${materials}${expenseLine}`;

    try {
        btn.innerText = "🚀 서버 전송 중..."; 
        const payload = {
            action: "saveLog",
            data: {
                date: document.getElementById('date').value, client, site, work,
                start: startTime, end: endTime, members, car, materials, dinner,
                expAmount, expDetail, expPayer, files: filesData,
                submitter: document.getElementById('submitter').value
            }
        };

     // 서버 전송 실행 (한 번만!)
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        const resultText = await res.text();

        if (resultText === "SUCCESS") {
            const tempMsg = msg; // 공유 메시지 백업
            resetFormOnlyInputs(); // 즉시 입력칸 비우기

            btn.disabled = false;
            btn.style.setProperty("background-color", "#fee500", "important");
            btn.style.setProperty("color", "#3c1e1e", "important");
            btn.innerText = "➡️ 지금 카톡으로 공유하기";

            btn.onclick = async () => {
                try {
                    if (navigator.share) {
                        await navigator.share({ text: tempMsg });
                    } else {
                        await copyToClipboard(tempMsg);
                    }
                    resetFormFull(); // 공유 후 버튼까지 리셋
                } catch (err) {
                    console.log("공유 취소");
                    resetFormFull();
                }
            };
            alert("✅ 저장 성공! 노란색 버튼을 눌러 공유하세요.");
        }
    } catch (e) {
        alert("⚠️ 전송 오류: " + e.message);
        btn.disabled = false; btn.innerText = "🚀 다시 시도";
    }
}

// 4. [리셋 함수 분리]
function resetFormOnlyInputs() {
    ['work', 'siteSearch', 'materialExtra', 'expAmount', 'expDetail'].forEach(id => {
        const el = document.getElementById(id); if(el) el.value = "";
    });
    const receipt = document.getElementById('receipt'); if(receipt) receipt.value = "";
    document.querySelectorAll('.chip.active').forEach(chip => chip.classList.remove('active'));
}

function resetFormFull() {
    resetFormOnlyInputs();
    // 1. 💡 시간 선택 상자를 다시 08:00와 17:00로 돌려놓습니다.
    const startTime = document.getElementById('start');
    const endTime = document.getElementById('end');
    if (startTime) startTime.value = "08:00";
    if (endTime) endTime.value = "17:00";

    // 2. 석식 여부도 다시 'X'로 초기화
    const dinner = document.getElementById('dinner');
    if (dinner) dinner.value = "X";

    // 3. 날짜를 오늘로 다시 설정
    document.getElementById('date').valueAsDate = new Date();
    
    const btn = document.getElementById('sBtn');
    btn.style.backgroundColor = ""; btn.style.color = ""; btn.style.fontWeight = "normal";
    btn.innerText = "🚀 저장 및 카톡 공유";
    btn.onclick = send; // 전송 함수 다시 연결
    document.getElementById('date').valueAsDate = new Date();
}


// 📋 메시지 복사 함수
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        alert("메시지가 복사되었습니다.");
    } catch (err) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert("메시지가 복사되었습니다.");
    }
}

async function compressImage(file) {
    return new Promise((resolve, reject) => {
        // 💡 1단계: 파일을 아주 작은 덩어리(Blob)로 복제해서 권한을 고정합니다.
        const blob = file.slice(0, file.size, file.type);
        const blobUrl = URL.createObjectURL(blob);
        const img = new Image();

        img.src = blobUrl;

        img.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            reject(new Error("사진 로딩 실패: 사진 용량이 너무 커서 브라우저가 읽지 못합니다. (다른 앱을 닫고 다시 시도해 주세요)"));
        };

        img.onload = () => {
            try {
                // 💡 2단계: 캔버스 크기를 600px로 더 줄여서 메모리 과부하를 원천 차단합니다.
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                let width = img.width;
                let height = img.height;
                const max_size = 600; // 800에서 600으로 더 하향

                if (width > height) {
                    if (width > max_size) { height *= max_size / width; width = max_size; }
                } else {
                    if (height > max_size) { width *= max_size / height; height = max_size; }
                }

                canvas.width = width;
                canvas.height = height;
                
                // 💡 3단계: 이미지를 캔버스에 그릴 때 품질 손실을 감수하고서라도 메모리를 아낍니다.
                ctx.imageSmoothingEnabled = false; 
                ctx.drawImage(img, 0, 0, width, height);

                // 💡 4단계: 품질을 0.3까지 낮춰 전송 성공률을 99%까지 끌어올립니다.
                const dataUrl = canvas.toDataURL('image/jpeg', 0.3);
                URL.revokeObjectURL(blobUrl);

                if (dataUrl.length < 100) throw new Error("압축 데이터 생성 실패");

                resolve({
                    base64: dataUrl.split(',')[1],
                    mimeType: 'image/jpeg',
                    name: file.name.split('.')[0] + '.jpg'
                });
            } catch (e) {
                URL.revokeObjectURL(blobUrl);
                reject(new Error("메모리 부족: 실행 중인 다른 앱들을 종료하고 다시 시도해 주세요."));
            }
        };
    });
}


let allSchedules = [];

// 💡 1. 시트에서 데이터를 받아와 화면에 뿌리는 함수 (통합 버전)
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
        
    // 💡 드롭다운 목록 생성 (최근 2주간 일정이 있는 사람만 필터링)
const select = document.getElementById('worker-select');
const currentVal = select.value;
select.innerHTML = '<option value="전체">👤 전체 보기</option>';

if (allSchedules.length > 0) {
    const today = new Date();
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(today.getDate() - 14); // 오늘부터 14일 전 계산

    // 1. 최근 2주간 일정이 있는 데이터만 골라내기
    const recentSchedules = allSchedules.filter(s => {
        const scheduleDate = new Date(s.date);
        return scheduleDate >= twoWeeksAgo;
    });

    // 2. 해당 일정들에 포함된 작업자 이름만 수집 (중복 제거)
    let activeWorkerSet = new Set();
    recentSchedules.forEach(s => {
        if (s.workers) {
            s.workers.forEach(w => activeWorkerSet.add(w));
        }
    });

    // 3. 이름순으로 정렬해서 드롭다운에 추가
    Array.from(activeWorkerSet).sort().forEach(w => {
        select.add(new Option(w, w));
    });
}

select.value = currentVal || "전체";

        // 💡 핵심: 두 화면을 한 번에 그립니다.
        renderSchedulePage(); 
    } catch (e) {
        container.innerHTML = '<p style="text-align:center; color:red;">⚠️ 일정 로드 실패</p>';
    }
}

// 💡 2. 선택한 사람의 일정만 골라서 보여주는 함수
function filterSchedules() {
    renderSchedulePage(); 
}


let showPast = false; // 과거 일정 노출 여부

function renderSchedulePage() {
    renderTimeline(); // 1. 상단 2주치 막대 달력
    renderCards();    // 2. 하단 상세 카드뷰
}

// 1. 타임라인 (2주치 막대) 그리기
function renderTimeline() {
    const grid = document.getElementById('timeline-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const worker = document.getElementById('worker-select').value;

    for (let i = 0; i < 14; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dateStr = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
        
        let dayJobs = allSchedules.filter(j => {
            const isDateMatch = j.date === dateStr;
            const isWorkerMatch = (worker === "전체" || j.workers.includes(worker));
            return isDateMatch && isWorkerMatch;
        });

        const col = document.createElement('div');
        col.className = 'time-col';
        if (i === 0) { col.style.border = "2px solid var(--primary)"; col.style.background = "#eff6ff"; }

     // renderTimeline 내 막대 생성 부분
col.innerHTML = `
    <div style="font-size:0.85rem; color:#1e293b; font-weight:800; margin-bottom:8px; border-bottom:2px solid #e2e8f0; width:100%; text-align:center; padding-bottom:4px;">
        ${date.getMonth()+1}/${date.getDate()}
    </div>
    ${dayJobs.length > 0 ? dayJobs.map(j => `
        <div class="job-bar ${j.shift === '주' ? 'bar-day' : 'bar-night'}" 
             onclick="scrollToCard('${j.date}', '${j.site}')">
            ${j.site}<br>
            <span style="font-size:0.65rem; font-weight:500; opacity:0.9;">(${j.workers.length}명)</span>
        </div>
    `).join('') : '<div style="height:20px;"></div>'}
`;
        grid.appendChild(col);
    }
}

// 💡 막대 클릭 시 해당 카드로 이동하는 함수
function scrollToCard(date, site) {
    const cards = document.querySelectorAll('.schedule-card-item');
    for (let card of cards) {
        if (card.dataset.date === date && card.dataset.site === site) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.style.boxShadow = "0 0 15px rgba(37, 99, 235, 0.5)"; // 하이라이트 효과
            setTimeout(() => card.style.boxShadow = "", 2000);
            break;
        }
    }
}


// 💡 1. 카드뷰 렌더링 (아이콘 추가 및 괄호 보수)
function renderCards() {
    const container = document.getElementById('schedule-container');
    const worker = document.getElementById('worker-select').value;
    const today = new Date().toISOString().split('T')[0];

    const filtered = allSchedules.filter(s => {
        const isWorkerMatch = (worker === "전체" || s.workers.includes(worker));
        const isDateMatch = (showPast || s.date >= today);
        return isWorkerMatch && isDateMatch;
    }).sort((a, b) => showPast ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));

    let html = `<button class="past-btn" onclick="togglePast()">${showPast ? '⬆️ 과거 일정 숨기기' : '⬇️ 지난 일정 보기'}</button>`;

    if (filtered.length === 0) {
        html += '<p style="text-align:center; padding:20px; color:#94a3b8;">해당하는 일정이 없습니다.</p>';
    } else {
        html += filtered.map(s => {
            const shiftColor = s.shift === '야' ? '#1e293b' : '#2563eb';
            const shiftLabel = s.shift === '야' ? '🌙 야간' : '☀️ 주간';
            
           // renderCards 함수 내 카드 생성 부분 보수
return `
    <div class="card schedule-card-item" 
         data-date="${s.date}" 
         data-site="${s.site}" 
         style="border-left: 6px solid ${shiftColor}; padding: 12px 16px; position: relative; transition: all 0.3s ease;">
        
        <div onclick='copyScheduleToLog(${JSON.stringify(s)})' 
             style="position: absolute; top: 12px; right: 12px; font-size: 1.4rem; cursor: pointer; padding: 5px; z-index: 10;">
            📝
        </div>

        <div style="display:flex; align-items:center; margin-bottom:8px;">
            <span style="font-weight:bold; font-size:1.1rem;">📅 ${s.date}</span>
            <span style="margin-left:8px; color:${shiftColor}; font-weight:bold; font-size:0.85rem;">${shiftLabel}</span>
        </div>

        <div style="margin-bottom:10px;">
            <div style="font-size:0.85rem; color:#64748b; margin-bottom:2px;">🏢 ${s.client}</div>
            <div style="font-size:1.2rem; font-weight:800; color:#1e293b; line-height:1.3;">${s.site}</div>
        </div>

        <div style="margin-bottom:12px; display:flex; flex-wrap:wrap; gap:4px;">
            ${s.workers.length > 0 
                ? s.workers
                    .filter(w => w && w.trim() !== "" && w !== s.memo)
                    .map(w => `<span class="worker-chip">${w}</span>`).join('') 
                : '<span style="font-size:0.8rem; color:#94a3b8;">인원 미정</span>'}
        </div>

        ${s.address ? `
            <div onclick="copyAddr('${s.address}')" style="background:#eff6ff; border:1px dashed #bfdbfe; padding:10px; border-radius:10px; font-size:0.85rem; cursor:pointer; color:#1d4ed8; display:flex; justify-content:space-between;">
                <span>📍 ${s.address}</span>
                <span style="font-weight:bold;">[복사]</span>
            </div>` : ''}

        ${s.memo ? `
            <div style="margin-top:10px; padding-top:8px; border-top:1px solid #f1f5f9; font-size:0.85rem; color:#ef4444; font-weight:500;">
                🔑 메모: ${s.memo}
            </div>` : ''}
    </div>
`;
        }).join('');
    }
    container.innerHTML = html;
}

// 💡 2. 데이터 전송 로직 (실제 일보 폼으로 데이터 쏴주기)
function copyScheduleToLog(s) {
    if(!confirm("📝 선택한 일정 내용으로 일보 작성을 시작할까요?")) return;

    // 1. 기본 정보 입력
    document.getElementById('date').value = s.date;
    document.getElementById('siteSearch').value = s.site;
    // H열(작업내용)작업 칸에 입력
    document.getElementById('work').value = (s.workContent || ""); 
    
    // 2. 거래처 칩 선택
    const clientChips = document.querySelectorAll('#client-chips .chip');
    clientChips.forEach(chip => {
        if(chip.innerText === s.client) chip.click();
    });

    
// 💡 4. 현장 칩 자동 활성화 (현장명이 동일한 경우) 보강
    // 거래처 클릭 후 현장 칩들이 생성될 시간을 위해 잠시 후 실행
    setTimeout(() => {
        // 검색창에 현장명 먼저 입력 (이게 되어야 칩이 보임)
        const siteSearchInput = document.getElementById('siteSearch');
        if (siteSearchInput) {
            siteSearchInput.value = s.site;
            // 입력 이벤트 강제 발생시켜서 칩 렌더링 유도
            siteSearchInput.dispatchEvent(new Event('input'));
        }

        // 그 다음 생성된 칩들 중 이름이 같은 걸 찾아 활성화
        const siteChips = document.querySelectorAll('#site-chips .chip');
        siteChips.forEach(chip => {
            // [완료] 표시가 붙은 칩일 수도 있으니 includes로 체크
            if(chip.innerText.includes(s.site)) {
                chip.classList.add('active');
                // 화면 중앙으로 스크롤 (칩이 많을 경우 대비)
                chip.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                chip.classList.remove('active');
            }
        });
    }, 400); // 0.1초 더 늘려서 안정성 확보

    
    // 3. 인원 칩 활성화 (목록에 없으면 자동 추가)
const memberContainer = document.getElementById('member-chips'); // 칩들이 담긴 부모 요소
const memberChips = document.querySelectorAll('#member-chips .chip');

// 먼저 기존 칩들 상태 초기화
memberChips.forEach(chip => chip.classList.remove('active'));

s.workers.forEach(workerName => {
    let found = false;
    memberChips.forEach(chip => {
        if (chip.innerText === workerName) {
            chip.classList.add('active');
            found = true;
        }
    });

    // 💡 만약 칩 목록에 이름이 없다면? 새로 만들어줍니다!
    if (!found && workerName.trim() !== "") {
        const newChip = document.createElement('div');
        newChip.className = 'chip active'; // 만들자마자 활성화
        newChip.innerText = workerName;
        // 기존 칩들과 동일한 클릭 이벤트 연결 (필요 시)
        newChip.onclick = function() { this.classList.toggle('active'); };
        memberContainer.appendChild(newChip);
    }
});

   // 4. 💡 차량 칩 자동 선택 및 목록에 없으면 자동 추가
const carContainer = document.getElementById('car-chips');
const carChips = document.querySelectorAll('#car-chips .chip');

// 기존 차량 칩 상태 초기화
carChips.forEach(chip => chip.classList.remove('active'));

if (s.car && s.car.trim() !== "") {
    let carFound = false;
    carChips.forEach(chip => {
        if (chip.innerText === s.car) {
            chip.click(); // 기존 칩이 있으면 클릭해서 활성화
            carFound = true;
        }
    });

    // 💡 만약 차량 목록에 없다면? 새로 만들어줍니다!
    if (!carFound) {
        const newCarChip = document.createElement('div');
        newCarChip.className = 'chip active'; // 만들자마자 활성화
        newCarChip.innerText = s.car;
        newCarChip.onclick = function() { this.classList.toggle('active'); };
        carContainer.appendChild(newCarChip);
    }
}

    // 5. 시간 자동 세팅
    if(s.shift === '야') {
        document.getElementById('start').value = "18:00";
        document.getElementById('end').value = "05:00";
    } else {
        document.getElementById('start').value = "08:00";
        document.getElementById('end').value = "17:00";
    }

    showPage('log-page');
    window.scrollTo(0, 0);
}


function togglePast() {
    showPast = !showPast;
    renderSchedulePage();
}



// 💡 4. 주소 클릭 시 범용 복사 함수 호출
function copyAddr(text) {
    copyToClipboard(text);
}



