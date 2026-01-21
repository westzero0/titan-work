const GAS_URL = "https://script.google.com/macros/s/AKfycbxegvNbdLfBN4A6Qo6ApDTj9p4PPvnfLcbzI9aiLrjS4VxqmjlWhLsxaSbSjUDys_65/exec"; 

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
    document.getElementById('date').valueAsDate = new Date();
    generateTimeOptions();
    
    // 💾 로컬 스토리지에서 '작성자' 기억된 이름 불러오기
    const savedSubmitter = localStorage.getItem('titan_submitter');
    if (savedSubmitter) {
        const subEl = document.getElementById('submitter');
        if (subEl) subEl.value = savedSubmitter;
    }

    // ✅ 경비 결제자는 자동 저장하지 않고 '없음'으로 초기화
    const payerEl = document.getElementById('expPayer');
    if (payerEl) payerEl.value = "없음";

    // 로컬 캐시 우선 로드
    const cached = localStorage.getItem('titan_client_map');
    if (cached) {
        clientSiteMap = JSON.parse(cached);
        renderClientChips();
    }

    // 서버 데이터 업데이트 및 칩 렌더링
    fetchClientMapping(); 
    renderAllChips();
});

/**
 * 2. 데이터 동기화 로직
 */
async function fetchClientMapping() {
    try {
        const res = await fetch(GAS_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: "getClientMapping" }) 
        });
        const newData = await res.json();
        if (JSON.stringify(newData) !== localStorage.getItem('titan_client_map')) {
            localStorage.setItem('titan_client_map', JSON.stringify(newData));
            clientSiteMap = newData;
            renderClientChips();
        }
    } catch (e) { console.error("데이터 업데이트 실패"); }
}

function generateTimeOptions() {
    const startSelect = document.getElementById('start');
    const endSelect = document.getElementById('end');
    startSelect.innerHTML = ""; endSelect.innerHTML = "";
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) {
            const hh = String(h).padStart(2, '0');
            const mm = String(m).padStart(2, '0');
            const timeStr = `${hh}:${mm}`;
            startSelect.add(new Option(timeStr, timeStr));
            endSelect.add(new Option(timeStr, timeStr));
        }
    }
    startSelect.value = "08:00"; endSelect.value = "17:00";
}

/**
 * 3. 칩(Chips) 및 UI 관련 로직
 */
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
        dataList.appendChild(new Option(siteObj.name, siteObj.name));
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
 * 4. 최종 데이터 전송 (작성자/결제자/정산 데이터 통합)
 */
async function send() {
    const btn = document.getElementById('sBtn');
    
    // 1. 필수 선택 데이터 수집
    const client = document.querySelector('#client-chips .chip.active')?.innerText;
    const site = document.getElementById('siteSearch').value || document.querySelector('#site-chips .chip.active')?.innerText;
    const work = document.getElementById('work').value.trim();
    const startDate = document.getElementById('start').value;
    const endDate = document.getElementById('end').value;
    const dateVal = document.getElementById('date').value;

    const getSelected = (id) => Array.from(document.querySelectorAll(`${id} .chip.active`)).map(c => c.innerText).join(' ');
    const members = getSelected('#member-chips');
    const cars = getSelected('#car-chips');
    const matChips = getSelected('#material-chips');
    const matText = document.getElementById('materialExtra').value.trim();
    const dinner = document.getElementById('dinner')?.value || "x";

    // 2. 작성자 및 결제자 데이터 수집
    const submitter = document.getElementById('submitter').value; // 일보 작성자
    const expPayer = document.getElementById('expPayer').value;   // 경비 결제자

    // 💾 작성자 이름 다음번을 위해 기억하기
    localStorage.setItem('titan_submitter', submitter);

    if (!client || !site || !work || !members || !cars) return alert("⚠️ 필수 항목을 확인해 주세요!");

    btn.disabled = true; btn.innerText = "⏳ 전송 중...";

    // 3. 카톡 공유용 메시지 가공
    const dateObj = new Date(dateVal);
    const formattedDate = `${dateObj.getMonth() + 1}.${dateObj.getDate()}`;
    const formattedStart = startDate.replace(':', ' ');
    const formattedEnd = endDate.replace(':', ' ');
    const finalMaterials = matText ? `${matChips}\n${matText}` : matChips;

    const msg = `날짜 :${formattedDate}
거래처 :${client}
현장명 :${site}
작업내용 :${work}
작업시간 :${formattedStart}~${formattedEnd}
작업인원 :${members}
차량 : ${cars}
석식여부 : ${dinner.toLowerCase()}
사용자재 :
${finalMaterials}`;

    // 4. 파일 처리
    const receiptFiles = document.getElementById('receipt').files;
    let filesArray = [];
    if (receiptFiles.length > 0) {
        filesArray = await Promise.all(Array.from(receiptFiles).map(async (f) => ({
            content: await fileTo64(f), name: f.name, type: f.type
        })));
    }

    // 5. 서버 페이로드 (GAS에서 경비 정산을 위해 필드 추가)
    const payload = {
        action: "saveLog",
        data: {
            date: dateVal, client, site, work,
            materials: finalMaterials, start: startDate, end: endDate,
            members, car: cars, dinner,
            expAmount: document.getElementById('expAmount').value || "0",
            expDetail: document.getElementById('expDetail').value || "없음",
            expPayer: expPayer,   // 누가 결제했는가? [cite: 2026-01-21]
            submitter: submitter, // 누가 작성했는가?
            files: filesArray
        }
    };

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        if (await res.text() === "SUCCESS") {
            alert(`✅ 저장 완료!`);
            if (navigator.share) {
                await navigator.share({ title: '작업일보', text: msg });
            }
        }
    } catch (e) { alert("⚠️ 전송 오류"); }
    finally { btn.disabled = false; btn.innerText = "🚀 저장 및 카톡 공유"; }
}