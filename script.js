const GAS_URL = "https://script.google.com/macros/s/AKfycbx6Kw0va7chL7OYgYZrvuFFTg-LSi65qfRYFGq7A-FuB1uG4Zt74JgdIMmOB_BTbS9v/exec";

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
    const materialChips = getSel('#material-chips');
    const materialExtra = document.getElementById('materialExtra').value.trim();
    const materials = [materialChips, materialExtra].filter(Boolean).join(', ') || "없음";

    const expAmountRaw = document.getElementById('expAmount').value;
    const expAmount = Number(expAmountRaw) || 0; 
    const expDetail = document.getElementById('expDetail').value.trim();
    const expPayer = getSel('#payer-chips') || "없음";

    let expenseLine = "";
    if (expAmount > 0) {
        expenseLine = `\n💰 경비: ${expAmount.toLocaleString()}원`;
        if (expDetail) expenseLine += ` (${expDetail})`;
    }

    // 📸 [영수증 파일 처리 - 압축 로직만 남기고 중복 제거]
    const receiptInput = document.getElementById('receipt');
    const files = receiptInput.files;
    let receiptData = [];

    if (files.length > 0) {
        btn.innerText = "📸 이미지 압축 중..."; 
        for (let file of files) {
            // 💡 이 부분에서 이미 압축과 변환이 모두 끝납니다!
            const data = await compressImage(file); 
            receiptData.push(data);
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
                expAmount, expDetail, expPayer,
                receipt: receiptData, 
                submitter: document.getElementById('submitter').value
            }
        };

        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        const resultText = await res.text();

        if (resultText === "SUCCESS") {
            btn.disabled = false;
            btn.style.setProperty("background-color", "#fee500", "important");
            btn.style.setProperty("color", "#3c1e1e", "important");
            btn.style.fontWeight = "bold";
            btn.innerText = "➡️ 지금 카톡으로 공유하기";
            
            btn.onclick = async () => {
                try {
                    if (navigator.share) await navigator.share({ text: msg });
                    else await copyToClipboard(msg);
                    resetForm();
                } catch (err) { console.error("공유 실패:", err); resetForm(); }
            };
            alert("✅ 저장 성공! 노란색 버튼을 눌러 공유하세요.");
        }
    } catch (e) {
        alert("⚠️ 오류 발생: " + e.message);
        btn.disabled = false; btn.innerText = "🚀 다시 시도";
    }
}

// 💡 [추가] 입력창 초기화 함수
function resetForm() {
    // 텍스트 영역 초기화
    ['work', 'siteSearch', 'materialExtra', 'expAmount', 'expDetail'].forEach(id => {
        document.getElementById(id).value = "";
    });
    // 선택된 칩 해제
    document.querySelectorAll('.chip.active').forEach(chip => chip.classList.remove('active'));
    // 날짜 및 시간 기본값
    document.getElementById('date').valueAsDate = new Date();
    document.getElementById('start').value = "08:00";
    document.getElementById('end').value = "17:00";
    document.getElementById('dinner').value = "X";
    // 버튼 원복
    const btn = document.getElementById('sBtn');
    btn.style.backgroundColor = ""; 
    btn.style.color = "";
    btn.innerText = "🚀 저장 및 카톡 공유";
    btn.onclick = send;
}



async function copyToClipboard(text) {
    try { await navigator.clipboard.writeText(text); alert("복사되었습니다."); }
    catch (err) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert("메시지가 복사되었습니다.");
    }
}

function syncSiteSelection() {
    const term = document.getElementById('siteSearch').value.trim();
    if (currentSites && Array.isArray(currentSites)) {
        const filtered = currentSites.filter(s => s.name.includes(term));
        renderSiteChips(filtered, term);
    }
}


function fetchSites(clientName) {
    const cachedMap = localStorage.getItem('titan_full_data_cache');
    if (cachedMap) {
        const fullData = JSON.parse(cachedMap);
        currentSites = fullData[clientName] || [];
        renderSiteChips(currentSites);
    }
}

function renderClientChips(clients) {
    const box = document.getElementById('client-chips');
    if (!box) return; box.innerHTML = "";
    clients.forEach(name => {
        const div = document.createElement('div');
        div.className = 'chip'; div.innerText = name;
        div.onclick = () => {
            document.querySelectorAll('#client-chips .chip').forEach(c => c.classList.remove('active'));
            div.classList.add('active'); fetchSites(name);
        };
        box.appendChild(div);
    });
}

function renderSiteChips(sites = currentSites) {
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
    if (!box) return; box.innerHTML = "";
    lists[type].forEach(name => {
        const div = document.createElement('div');
        div.className = `chip ${delMode[type] ? 'delete-target' : ''}`;
        div.innerText = name;
        div.onclick = () => {
            if (delMode[type]) { lists[type] = lists[type].filter(i => i !== name); saveListsToStorage(); renderChips(type); } 
            else {
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
    if (val && !lists[type].includes(val)) { lists[type].push(val); saveListsToStorage(); renderChips(type); }
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
    if(!s || !e) return; s.innerHTML = ""; e.innerHTML = "";
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) {
            const t = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            s.add(new Option(t, t)); e.add(new Option(t, t));
        }
    }
    s.value = "08:00"; e.value = "17:00";
}

async function copyToClipboard(text) {
    try { await navigator.clipboard.writeText(text); } catch (err) {
        const t = document.createElement("textarea"); t.value = text;
        document.body.appendChild(t); t.select(); document.execCommand('copy');
        document.body.removeChild(t);
    }
}


// 💡 이미지 용량을 줄여주는 함수 (가로 1024px 기준)
function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const max_size = 1024; // 💡 가로 최대 1024px로 조절

                if (width > height) { if (width > max_size) { height *= max_size / width; width = max_size; } }
                else { if (height > max_size) { width *= max_size / height; height = max_size; } }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // 💡 품질을 0.7(70%)로 낮춰서 용량을 대폭 줄임
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve({
                    base64: dataUrl.split(',')[1],
                    mimeType: 'image/jpeg',
                    name: file.name.split('.')[0] + '.jpg'
                });
            };
        };
    });
}
