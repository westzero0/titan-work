const GAS_URL = "https://script.google.com/macros/s/AKfycbwgiy5wVIcut1t7gFGkYZmC4GD3GmCuynz12pRzjkB2F1atSGlaFaz1plsHPRF6xmRV/exec"; 

let clientSiteMap = {}; // 거래처-현장 매칭 데이터
let currentClient = "";
let lists = {
    member: ["기원", "창재", "비비", "서호"],
    car: ["봉고", "포터", "스타렉스", "창재차"],
    material: ["2.5sq 전선", "4sq 전선", "CD관", "난연관", "복스"],
    site: [] // 동적 생성
};
let delMode = { member: false, car: false, material: false };

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('date').valueAsDate = new Date();
    await fetchClientMapping(); // 시트에서 거래처 정보 로드
    renderAllChips();
});

// 1. 거래처-현장 매칭 데이터 가져오기
async function fetchClientMapping() {
    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "getClientMapping" })
        });
        clientSiteMap = await res.json();
        renderClientChips();
    } catch (e) { console.error("거래처 로드 실패"); }
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
    renderSiteChips(); // 선택된 거래처에 맞는 현장 칩 생성
}

function renderSiteChips() {
    const box = document.getElementById('site-chips');
    const showFinished = document.getElementById('showFinished').checked;
    box.innerHTML = "";
    if (!currentClient) return;

    const sites = clientSiteMap[currentClient] || [];
    sites.forEach(siteObj => {
        const isFinished = siteObj.status === "완료";
        if (showFinished || !isFinished) {
            const div = document.createElement('div');
            div.className = `chip ${isFinished ? 'finished' : ''}`;
            div.innerText = isFinished ? `[AS] ${siteObj.name}` : siteObj.name;
            div.onclick = () => {
                document.querySelectorAll('#site-chips .chip').forEach(c => c.classList.remove('active'));
                div.classList.add('active');
            };
            box.appendChild(div);
        }
    });
}

// 2. 칩 관리 및 전송 로직
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
    if (type === 'site') {
        const box = document.getElementById('site-chips');
        const div = document.createElement('div');
        div.className = 'chip active';
        div.innerText = val;
        div.onclick = () => div.classList.toggle('active');
        box.appendChild(div);
    } else {
        if (!lists[type].includes(val)) { lists[type].push(val); renderChips(type); }
    }
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

async function send() {
    const btn = document.getElementById('sBtn');
    const selectedClient = document.querySelector('#client-chips .chip.active')?.innerText;
    const selectedSite = document.querySelector('#site-chips .chip.active')?.innerText || document.getElementById('add-site-input').value;

    if (!selectedClient || !selectedSite) return alert("🏢 거래처와 현장명을 모두 선택해 주세요!");

    const getSelected = (id) => Array.from(document.querySelectorAll(`${id} .chip.active`)).map(c => c.innerText).join(', ');

    btn.disabled = true; btn.innerText = "⏳ 처리 중...";
    const receiptFiles = document.getElementById('receipt').files;
    let filesArray = [];
    if (receiptFiles.length > 0) {
        filesArray = await Promise.all(Array.from(receiptFiles).map(async (file) => ({
            content: await fileTo64(file), name: file.name, type: file.type
        })));
    }

    const payload = {
        action: "saveLog",
        data: {
            date: document.getElementById('date').value,
            client: selectedClient,
            site: selectedSite,
            work: document.getElementById('work').value,
            materials: getSelected('#material-chips'),
            start: document.getElementById('start').value,
            end: document.getElementById('end').value,
            members: getSelected('#member-chips'),
            car: getSelected('#car-chips'),
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
            const msg = `[타이탄 일보]\n📅 ${payload.data.date}\n🏢 ${payload.data.client}\n🏗️ ${payload.data.site}\n🛠️ ${payload.data.work}\n👥 ${payload.data.members}`;
            if (navigator.share) navigator.share({ title: '타이탄 일보', text: msg });
        }
    } catch (e) { alert("⚠️ 전송 오류"); }
    finally { btn.disabled = false; btn.innerText = "🚀 저장 및 카톡 공유"; }
}