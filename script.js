const GAS_URL = "https://script.google.com/macros/s/AKfycbx6Kw0va7chL7OYgYZrvuFFTg-LSi65qfRYFGq7A-FuB1uG4Zt74JgdIMmOB_BTbS9v/exec";



let currentSites = []; 
let lists = {
    member: ["기원", "창재", "조환", "서호"],
    car: ["봉고", "포터", "스타렉스", "창재차"],
    material: ["2.5sq 전선", "4sq 전선", "CD관", "난연관", "복스"],
    payer: ["서영", "기원", "창재"]
};
let delMode = { member: false, car: false, material: false, payer: false };

// [1. 초기 로드]
document.addEventListener('DOMContentLoaded', () => {
    // 1) 사용자 이름 확인 및 설정
    let myName = localStorage.getItem('titan_user_name');
    if (!myName) {
        myName = prompt("이름을 입력해주세요.");
        if (myName) localStorage.setItem('titan_user_name', myName);
    }
    document.getElementById('submitter').value = myName || "미지정";
    
    // 2) 날짜 및 시간 옵션 초기화
    document.getElementById('date').valueAsDate = new Date();
    generateTimeOptions();
    
    // 3) 정적 칩(인원, 차량 등) 렌더링
    renderAllChips();
    
    // 💡 에러 해결 포인트: 아래 정의된 함수 이름과 똑같이 맞췄습니다.
   loadTitanDataWithBackgroundSync();

    // 4) 현장 검색 이벤트 리스너
    document.getElementById('siteSearch').addEventListener('input', (e) => {
        const term = e.target.value.trim();
        const filtered = currentSites.filter(s => s.name.includes(term));
        renderSiteChips(filtered, term);
    });
});


// [2. 데이터 로딩 - 백그라운드 동기화 방식]
async function loadTitanDataWithBackgroundSync() {
    // 💡 1단계: 메모리에서 전체 매핑 데이터 즉시 불러오기
    const cachedMap = localStorage.getItem('titan_full_data_cache');
    if (cachedMap) {
        const fullData = JSON.parse(cachedMap);
        renderClientChips(Object.keys(fullData)); 
    }

    // 💡 2단계: 백그라운드에서 전체 데이터(거래처+현장) 최신화
    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getAllData' })
        });
        const fullData = await res.json();
        
        localStorage.setItem('titan_full_data_cache', JSON.stringify(fullData));
        
        // 데이터가 처음이거나 변경되었다면 거래처 칩 다시 그리기
        if (!cachedMap) renderClientChips(Object.keys(fullData));
    } catch (e) {
        console.log("오프라인 모드: 기존 캐시 데이터를 사용합니다.");
    }
}

// 💡 수정된 fetchSites: 이제 서버에 물어보지 않고 메모리에서 바로 꺼내옵니다!
function fetchSites(clientName) {
    const box = document.getElementById('site-chips');
    const cachedMap = localStorage.getItem('titan_full_data_cache');
    
    if (cachedMap) {
        const fullData = JSON.parse(cachedMap);
        const sites = fullData[clientName] || [];
        currentSites = sites; // 검색 기능을 위해 전역 변수 업데이트
        renderSiteChips(sites);
    } else {
        box.innerHTML = "⚠️ 먼저 데이터를 불러와야 합니다.";
    }
}


// [3. UI 렌더링]
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
            await fetchSites(name);
        };
        box.appendChild(div);
    });
}


function renderSiteChips(sites = currentSites, term = "") {
    const box = document.getElementById('site-chips');
    const dl = document.getElementById('site-options');
    const showAll = document.getElementById('showFinished').checked;
    if (!sites || !Array.isArray(sites)) return;
    box.innerHTML = ""; dl.innerHTML = "";
    sites.forEach(s => {
        const isFin = s.status === "완료";
        dl.appendChild(new Option(s.name, s.name));
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
                lists[type] = lists[type].filter(i => i !== name); renderChips(type); 
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
    if (val && !lists[type].includes(val)) { lists[type].push(val); renderChips(type); }
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

// [4. 핵심 전송 및 카톡 공유 로직]
async function send() {
    const btn = document.getElementById('sBtn');
    const work = document.getElementById('work').value.trim();
    const client = document.querySelector('#client-chips .chip.active')?.innerText;
    const siteInput = document.getElementById('siteSearch').value.trim();
    const activeSiteChip = document.querySelector('#site-chips .chip.active')?.innerText;
    const site = activeSiteChip || siteInput; 

    if (!client || !site || !work) return alert("⚠️ 필수 정보를 입력해주세요.");

    btn.disabled = true; btn.innerText = "⏳ 전송 중...";
    const getSel = (id) => Array.from(document.querySelectorAll(`${id} .chip.active`)).map(c => c.innerText).join(', ');
    
    const startTime = document.getElementById('start').value;
    const endTime = document.getElementById('end').value;
    const members = getSel('#member-chips') || "없음";
    const car = getSel('#car-chips') || "없음";
    const dinner = document.getElementById('dinner').value === "O" ? "O" : "X";
    const materialChips = getSel('#material-chips');
    const materialExtra = document.getElementById('materialExtra').value.trim();
    const materials = (materialChips + (materialExtra ? " / " + materialExtra : "")).trim() || "없음";

    // 경비 금액 추가 로직
    const expAmount = document.getElementById('expAmount').value;
    const expDetail = document.getElementById('expDetail').value.trim();
    let expLine = "";
    if (expAmount && parseFloat(expAmount) > 0) {
        expLine = `\n💰 경비: ${Number(expAmount).toLocaleString()}원 (${expDetail || '내역 없음'})`;
    }

    const msg = `⚡ [타이탄 작업일보]\n📅 날짜: ${document.getElementById('date').value}\n🏢 거래처: ${client}\n🏗️ 현장명: ${site}\n🛠️ 작업내용: ${work}\n⏰ 작업시간: ${startTime} ~ ${endTime}\n👥 작업인원: ${members}\n🚗 차량: ${car}\n🍱 석식여부: ${dinner}\n📦 사용자재: ${materials}${expLine}`;

    try {
        const files = document.getElementById('receipt').files;
        let fileArray = [];
        if (files.length > 0) {
            fileArray = await Promise.all(Array.from(files).map(async f => ({ content: await fileTo64(f), name: f.name, type: f.type })));
        }

        const payload = {
            action: "saveLog",
            data: {
                date: document.getElementById('date').value, client, site, work,
                start: startTime, end: endTime, members, car, materials,
                dinner: document.getElementById('dinner').value,
                expAmount: expAmount || "0", expDetail: expDetail || "없음",
                expPayer: getSel('#payer-chips') || "없음",
                submitter: document.getElementById('submitter').value,
                files: fileArray, isNewSite: !activeSiteChip
            }
        };

        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        const resultText = await res.text();

        if (resultText === "SUCCESS") {
            btn.disabled = false;
            btn.style.backgroundColor = "#fee500"; btn.style.color = "#3c1e1e";
            btn.style.fontWeight = "bold";
            btn.innerText = "➡️ 지금 카톡으로 공유하기";
            
            btn.onclick = async () => {
                try {
                    if (navigator.share) {
                        await navigator.share({ title: '', text: msg });
                        alert("공유 완료!");
                        resetForm();
                    } else { throw new Error("공유 미지원"); }
                } catch (err) {
                    await copyToClipboard(msg);
                    alert("메시지가 복사되었습니다. 카톡에 붙여넣어 주세요!");
                    resetForm();
                }
            };
            alert("✅ 저장 성공! 노란색 버튼을 눌러 카톡으로 보내세요.");
        }
    } catch (e) {
        alert("⚠️ 오류 발생: " + e.message);
        btn.disabled = false; btn.innerText = "🚀 다시 시도";
    }
}

const fileTo64 = (f) => new Promise((res) => {
    const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.readAsDataURL(f);
});

async function copyToClipboard(text) {
    try { await navigator.clipboard.writeText(text); } catch (err) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }
}

function resetForm() {
    ['work', 'siteSearch', 'materialExtra', 'expAmount', 'expDetail', 'receipt'].forEach(id => {
        const el = document.getElementById(id); if(el) el.value = "";
    });
    document.getElementById('date').valueAsDate = new Date();
    document.getElementById('start').value = "08:00"; document.getElementById('end').value = "17:00";
    document.getElementById('dinner').value = "X";
    document.querySelectorAll('.chip.active').forEach(c => c.classList.remove('active'));
    document.getElementById('site-chips').innerHTML = "";
    currentSites = [];
    const btn = document.getElementById('sBtn');
    btn.style.backgroundColor = "#2563eb"; btn.style.color = "#fff";
    btn.innerText = "🚀 저장 및 카톡 공유";
    btn.onclick = send; 
}

/**
 * 🔍 현장 검색창 입력 시 칩 목록을 필터링하는 함수
 * HTML의 oninput="syncSiteSelection()" 호출에 대응합니다.
 */
function syncSiteSelection() {
    const term = document.getElementById('siteSearch').value.trim();
    
    // currentSites는 거래처 선택 시 업데이트되는 전역 변수입니다.
    if (currentSites && Array.isArray(currentSites)) {
        const filtered = currentSites.filter(s => s.name.includes(term));
        renderSiteChips(filtered, term);
    }
}

