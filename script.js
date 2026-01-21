
const GAS_URL = "https://script.google.com/macros/s/AKfycbwAA4lE4pDsCk_MArw_8vWbOw8HkeE0fdbtruPKgQmi3GVXN15_K3apbMjVCIl38ngZ/exec"; 

let clientSiteMap = {};
let currentClient = "";
let lists = {
    member: ["기원", "창재", "비비", "서호"],
    car: ["봉고", "포터", "스타렉스", "창재차"],
    material: ["2.5sq 전선", "4sq 전선", "CD관", "난연관"],
    payer: ["비비", "기원", "창재"]
};
let delMode = { member: false, car: false, material: false, payer: false };

document.addEventListener('DOMContentLoaded', async () => {
    // 1. 작성자 이름 처리 (팝업으로 묻고 저장)
    let myName = localStorage.getItem('titan_user_name');
    if (!myName) {
        myName = prompt("일보 작성을 위해 본인 이름을 입력해주세요. (최초 1회)");
        if (myName) localStorage.setItem('titan_user_name', myName);
    }
    document.getElementById('submitter').value = myName || "미지정";

    // 2. 기본 설정
    document.getElementById('date').valueAsDate = new Date();
    generateTimeOptions();
    
    // 3. 칩 렌더링 및 데이터 로드 시작
    renderAllChips();
    await fetchClientMapping(); // 거래처 데이터를 먼저 확실히 가져옵니다.
});

async function fetchClientMapping() {
    const chipBox = document.getElementById('client-chips');
    try {
        const res = await fetch(GAS_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: "getClientMapping" }) 
        });
        clientSiteMap = await res.json();
        
        // 데이터가 비어있지 않다면 칩 렌더링
        if (Object.keys(clientSiteMap).length > 0) {
            renderClientChips();
        } else {
            chipBox.innerHTML = "<span class='loading-text' style='color:#ef4444;'>거래처 데이터가 비어있습니다.</span>";
        }
    } catch (e) { 
        console.error("서버 데이터 로드 실패", e); 
        chipBox.innerHTML = "<span class='loading-text' style='color:#ef4444;'>연결 실패 (URL 또는 인터넷 확인)</span>";
    }
}

function generateTimeOptions() {
    const s = document.getElementById('start'), e = document.getElementById('end');
    s.innerHTML = ""; e.innerHTML = "";
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) {
            const t = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            s.add(new Option(t, t)); e.add(new Option(t, t));
        }
    }
    s.value = "08:00"; e.value = "17:00";
}

// 칩 렌더링 (인원, 차량 등)
function renderAllChips() {
    ['member', 'car', 'material', 'payer'].forEach(type => renderChips(type));
}

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
                renderChips(type);
            } else {
                if (type === 'payer') {
                    document.querySelectorAll('#payer-chips .chip').forEach(c => c.classList.remove('active'));
                }
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
        renderChips(type);
    }
    input.value = "";
}

function toggleDelMode(type) {
    delMode[type] = !delMode[type];
    const btn = document.getElementById(`del-btn-${type}`);
    btn.innerText = delMode[type] ? "✅ 완료" : "🗑️ 삭제";
    renderChips(type);
}

// 거래처 칩 렌더링
function renderClientChips() {
    const box = document.getElementById('client-chips');
    box.innerHTML = "";
    Object.keys(clientSiteMap).forEach(client => {
        const div = document.createElement('div');
        div.className = 'chip';
        div.innerText = client;
        div.onclick = () => {
            document.querySelectorAll('#client-chips .chip').forEach(c => c.classList.remove('active'));
            div.classList.add('active');
            currentClient = client;
            renderSiteChips();
        };
        box.appendChild(div);
    });
}

function renderSiteChips() {
    const box = document.getElementById('site-chips');
    const dl = document.getElementById('site-options');
    const showAll = document.getElementById('showFinished').checked;
    box.innerHTML = ""; dl.innerHTML = "";
    if (!currentClient) return;

    (clientSiteMap[currentClient] || []).forEach(s => {
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

function syncSiteSelection() {
    const val = document.getElementById('siteSearch').value;
    document.querySelectorAll('#site-chips .chip').forEach(c => {
        c.classList.toggle('active', c.innerText.replace('[완료] ', '') === val);
    });
}

const fileTo64 = (f) => new Promise((res) => {
    const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.readAsDataURL(f);
});

async function send() {
    const btn = document.getElementById('sBtn');
    const submitter = document.getElementById('submitter').value;
    const client = document.querySelector('#client-chips .chip.active')?.innerText;
    const site = document.getElementById('siteSearch').value || document.querySelector('#site-chips .chip.active')?.innerText;
    const work = document.getElementById('work').value.trim();
    
    if (!client || !site || !work) return alert("⚠️ 필수 정보(거래처, 현장, 내용)를 입력해주세요.");

    btn.disabled = true; btn.innerText = "⏳ 전송 중...";

    const getSel = (id) => Array.from(document.querySelectorAll(`${id} .chip.active`)).map(c => c.innerText).join(' ');
    const files = document.getElementById('receipt').files;
    let fileArray = [];
    if (files.length > 0) {
        fileArray = await Promise.all(Array.from(files).map(async f => ({
            content: await fileTo64(f), name: f.name, type: f.type
        })));
    }

    const payload = {
        action: "saveLog",
        data: {
            date: document.getElementById('date').value,
            client, site, work,
            start: document.getElementById('start').value,
            end: document.getElementById('end').value,
            members: getSel('#member-chips'),
            car: getSel('#car-chips'),
            materials: getSel('#material-chips') + "\n" + document.getElementById('materialExtra').value,
            dinner: document.getElementById('dinner').value,
            expAmount: document.getElementById('expAmount').value || "0",
            expDetail: document.getElementById('expDetail').value || "없음",
            expPayer: getSel('#payer-chips') || "없음",
            submitter: submitter,
            files: fileArray
        }
    };

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        if (await res.text() === "SUCCESS") {
            alert("✅ 저장 성공!");
            // (카톡 공유 로직 추가 가능)
        }
    } catch (e) { alert("⚠️ 오류 발생: 인터넷 연결을 확인하세요."); }
    finally { btn.disabled = false; btn.innerText = "🚀 저장 및 카톡 공유"; }
}