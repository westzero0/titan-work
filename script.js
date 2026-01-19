const GAS_URL = "https://script.google.com/macros/s/AKfycbyPao29x11IGt196CXBijsyxZQ4mxqHnbBc-e1WKDhTYL-x3Rc5zddu4BGPAK84OgXm/exec"; 



/**
 * 1. 초기 실행 (페이지 로드 시)
 */
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('date').valueAsDate = new Date();
    generateTimeOptions(); // 30분 단위 생성 (이건 내부 로직이라 즉시 실행됨)
    
    // ⚡ [최적화] 서버를 부르기 전에 저장된 데이터가 있는지 먼저 확인해서 즉시 그려줍니다.
    const cached = localStorage.getItem('titan_client_map');
    if (cached) {
        clientSiteMap = JSON.parse(cached);
        renderClientChips(); 
        console.log("⚡ 캐시 데이터로 즉시 로딩 완료");
    } else {
        // 캐시가 없을 때만 화면에 '로딩 중' 표시
        document.getElementById('client-chips').innerHTML = "<p style='font-size:0.8rem; color:#94a3b8;'>🔄 데이터를 불러오는 중...</p>";
    }

    // 화면은 띄워둔 채로, 배경에서 최신 데이터를 가져옵니다.
    fetchClientMapping(); 
    renderAllChips();
});

/**
 * 2. 배경에서 몰래 데이터 가져오기
 */
async function fetchClientMapping() {
    try {
        const res = await fetch(GAS_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: "getClientMapping" }) 
        });
        const newData = await res.json();
        
        // 데이터가 이전과 다를 때만 화면을 다시 그립니다.
        if (JSON.stringify(newData) !== localStorage.getItem('titan_client_map')) {
            localStorage.setItem('titan_client_map', JSON.stringify(newData));
            clientSiteMap = newData;
            renderClientChips();
            console.log("✅ 최신 데이터 업데이트 완료");
        }
    } catch (e) { 
        console.error("데이터 업데이트 실패 (오프라인 상태일 수 있음)"); 
    }
}



let clientSiteMap = {}; 
let currentClient = "";
let lists = {
    member: ["기원", "창재", "비비", "서호"],
    car: ["봉고", "포터", "스타렉스", "창재차"],
    material: ["2.5sq 전선", "4sq 전선", "CD관", "난연관", "복스"]
};
let delMode = { member: false, car: false, material: false };

/**
 * 1. 초기 실행 (페이지 로드 시)
 */
document.addEventListener('DOMContentLoaded', async () => {
    // 날짜 초기화
    document.getElementById('date').valueAsDate = new Date();
    
    // 🕒 30분 단위 시간 드롭다운 생성
    generateTimeOptions();
    
    // ⚡ 로컬 저장소에서 데이터 즉시 로드 (로딩 속도 개선)
    const cached = localStorage.getItem('titan_client_map');
    if (cached) {
        clientSiteMap = JSON.parse(cached);
        renderClientChips();
    }

    // 배경에서 최신 데이터 업데이트
    await fetchClientMapping(); 
    renderAllChips();
});

/**
 * 2. 30분 단위 시간 옵션 생성
 */
function generateTimeOptions() {
    const startSelect = document.getElementById('start');
    const endSelect = document.getElementById('end');
    
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) {
            const hh = String(h).padStart(2, '0');
            const mm = String(m).padStart(2, '0');
            const timeStr = `${hh}:${mm}`;
            
            startSelect.add(new Option(timeStr, timeStr));
            endSelect.add(new Option(timeStr, timeStr));
        }
    }
    // 기본 작업 시간 설정
    startSelect.value = "08:00";
    endSelect.value = "17:00";
}

/**
 * 3. 데이터 로딩 및 칩 렌더링
 */
async function fetchClientMapping() {
    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: "getClientMapping" }) });
        const newData = await res.json();
        localStorage.setItem('titan_client_map', JSON.stringify(newData));
        clientSiteMap = newData;
        renderClientChips();
    } catch (e) { console.error("데이터 로드 실패"); }
}

function renderClientChips() {
    const box = document.getElementById('client-chips');
    box.innerHTML = "";
    Object.keys(clientSiteMap).forEach(client => {
        const div = document.createElement('div');
        div.className = 'chip';
        div.innerText = client;
        div.onclick = () => selectClient(client, div);
        box.appendChild(div);
    });
}

function selectClient(client, element) {
    document.querySelectorAll('#client-chips .chip').forEach(c => c.classList.remove('active'));
    element.classList.add('active');
    currentClient = client;
    renderSiteChips();
}

function renderSiteChips() {
    const box = document.getElementById('site-chips');
    const dataList = document.getElementById('site-options');
    const showFinished = document.getElementById('showFinished').checked;
    box.innerHTML = ""; dataList.innerHTML = "";
    if (!currentClient) return;

    const sites = clientSiteMap[currentClient] || [];
    let finishedCount = 0;

    sites.forEach(siteObj => {
        const isFinished = siteObj.status === "완료";
        const option = document.createElement('option');
        option.value = siteObj.name;
        dataList.appendChild(option);

        // 완료 현장은 최대 5개까지만 노출
        if (!isFinished || (showFinished && finishedCount < 5)) {
            const div = document.createElement('div');
            div.className = `chip ${isFinished ? 'finished' : ''}`;
            div.innerText = isFinished ? `[AS] ${siteObj.name}` : siteObj.name;
            if (isFinished) finishedCount++;
            div.onclick = () => {
                document.getElementById('siteSearch').value = siteObj.name;
                document.querySelectorAll('#site-chips .chip').forEach(c => c.classList.remove('active'));
                div.classList.add('active');
            };
            box.appendChild(div);
        }
    });
}

function syncSiteSelection() {
    const val = document.getElementById('siteSearch').value;
    document.querySelectorAll('#site-chips .chip').forEach(chip => {
        chip.classList.toggle('active', chip.innerText.replace('[AS] ', '') === val);
    });
}

/**
 * 4. 기타 항목 관리 (인원, 차량, 자재)
 */
function renderAllChips() {
    renderChips('member'); renderChips('car'); renderChips('material');
}

function renderChips(type) {
    const box = document.getElementById(`${type}-chips`);
    box.innerHTML = "";
    lists[type].forEach(name => {
        const div = document.createElement('div');
        div.className = `chip ${delMode[type] ? 'delete-target' : ''}`;
        div.innerText = name;
        div.onclick = () => {
            if (delMode[type]) { lists[type] = lists[type].filter(i => i !== name); renderChips(type); }
            else { div.classList.toggle('active'); }
        };
        box.appendChild(div);
    });
}

function addItem(type) {
    const input = document.getElementById(`add-${type}-input`);
    const val = input.value.trim();
    if (!val) return;
    if (!lists[type].includes(val)) { lists[type].push(val); renderChips(type); }
    input.value = "";
}

function toggleDelMode(type) {
    delMode[type] = !delMode[type];
    const label = document.querySelector(`.chip-header span[onclick*="${type}"]`);
    label.innerText = delMode[type] ? "✅ 완료" : "🗑️ 삭제모드";
    renderChips(type);
}

const fileTo64 = (f) => new Promise((res) => {
    const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.readAsDataURL(f);
});

/**
 * 5. 최종 데이터 전송
 */
async function send() {
    const btn = document.getElementById('sBtn');
    
    const selectedClient = document.querySelector('#client-chips .chip.active')?.innerText;
    const selectedSite = document.getElementById('siteSearch').value || 
                         document.querySelector('#site-chips .chip.active')?.innerText;
    const work = document.getElementById('work').value.trim();

    const getSelected = (id) => Array.from(document.querySelectorAll(`${id} .chip.active`)).map(c => c.innerText).join(', ');
    const members = getSelected('#member-chips');
    const cars = getSelected('#car-chips');
    const materialChips = getSelected('#material-chips');
    const materialText = document.getElementById('materialExtra').value.trim();

    // 🚨 필수 항목 검증 강화
    if (!selectedClient || !selectedSite) return alert("🏢 거래처와 현장명을 모두 선택해 주세요!");
    if (!work) return alert("🛠️ 작업내용(필수)을 입력해 주세요!");
    if (!members) return alert("👥 작업 인원을 최소 한 명 이상 선택해야 합니다!");
    if (!cars) return alert("🚛 사용된 차량을 최소 하나 이상 선택해야 합니다!");

    btn.disabled = true; btn.innerText = "⏳ 전송 중...";
    const receiptFiles = document.getElementById('receipt').files;
    let filesArray = [];
    if (receiptFiles.length > 0) {
        filesArray = await Promise.all(Array.from(receiptFiles).map(async (f) => ({
            content: await fileTo64(f), name: f.name, type: f.type
        })));
    }

    const payload = {
        action: "saveLog",
        data: {
            date: document.getElementById('date').value,
            client: selectedClient,
            site: selectedSite,
            work: work,
            materials: materialText ? `${materialChips}\n[상세]\n${materialText}` : materialChips,
            start: document.getElementById('start').value,
            end: document.getElementById('end').value,
            members: members,
            car: cars,
            dinner: document.getElementById('dinner').value,
            expAmount: document.getElementById('expAmount').value || "0",
            expDetail: document.getElementById('expDetail').value || "없음",
            files: filesArray
        }
    };

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        if (await res.text() === "SUCCESS") {
            alert(`✅ 저장 완료!`);
            const msg = `[타이탄 일보]\n📅 ${payload.data.date}\n🏗️ ${payload.data.site}\n🛠️ ${payload.data.work}\n👥 ${payload.data.members}`;
            if (navigator.share) navigator.share({ title: '타이탄 일보', text: msg });
        }
    } catch (e) { alert("⚠️ 전송 오류 발생"); }
    finally { btn.disabled = false; btn.innerText = "🚀 저장 및 카톡 공유"; }
}
