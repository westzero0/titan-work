const GAS_URL = "https://script.google.com/macros/s/AKfycbzWvSifWq5Gm0zgb5_paLZoHgvWnwkFp8ZfTwt8pKcmYH7YkR-qvCzo5z6if_BiTic/exec"; 

let currentClient = "";
let lists = {
    member: ["기원", "창재", "비비", "서호"],
    car: ["봉고", "포터", "스타렉스", "창재차"],
    material: ["2.5sq 전선", "4sq 전선", "CD관", "난연관", "복스"],
    payer: ["비비", "기원", "창재"]
};
let delMode = { member: false, car: false, material: false, payer: false };

document.addEventListener('DOMContentLoaded', async () => {
    let myName = localStorage.getItem('titan_user_name');
    if (!myName) {
        myName = prompt("이름을 입력해주세요. (최초 1회)");
        if (myName) localStorage.setItem('titan_user_name', myName);
    }
    document.getElementById('submitter').value = myName || "미지정";
    document.getElementById('date').valueAsDate = new Date();
    generateTimeOptions();
    renderAllChips();
    await fetchClientsOnly(); // 💡 최적화: 가볍게 시작
});

async function fetchClientsOnly() {
    const chipBox = document.getElementById('client-chips');
    try {
        const res = await fetch(GAS_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: "getClients" }) 
        });
        const clientList = await res.json();
        renderClientChips(clientList);
    } catch (e) { chipBox.innerHTML = "거래처 로드 실패"; }
}

function renderClientChips(clients) {
    const box = document.getElementById('client-chips');
    box.innerHTML = "";
    clients.forEach(client => {
        const div = document.createElement('div');
        div.className = 'chip';
        div.innerText = client;
        div.onclick = async () => {
            document.querySelectorAll('#client-chips .chip').forEach(c => c.classList.remove('active'));
            div.classList.add('active');
            currentClient = client;

            const siteBox = document.getElementById('site-chips');
            siteBox.innerHTML = "<span class='loading-text'>현장 로드 중...</span>";
            
            const res = await fetch(GAS_URL, { 
                method: 'POST', 
                body: JSON.stringify({ action: "getSites", client: client }) 
            });
            const sites = await res.json();
            renderSiteChips(sites);
        };
        box.appendChild(div);
    });
}

function renderSiteChips(sites) {
    const box = document.getElementById('site-chips');
    const dl = document.getElementById('site-options');
    const showAll = document.getElementById('showFinished').checked;
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

// ... (renderChips, addItem, toggleDelMode, generateTimeOptions 등 UI 함수 유지) ...
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
            if (delMode[type]) { lists[type] = lists[type].filter(i => i !== name); renderChips(type); }
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
    s.innerHTML = ""; e.innerHTML = "";
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) {
            const t = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            s.add(new Option(t, t)); e.add(new Option(t, t));
        }
    }
    s.value = "08:00"; e.value = "17:00";
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
    
    if (!client || !site || !work) return alert("⚠️ 필수 정보를 입력해주세요.");

    btn.disabled = true; btn.innerText = "⏳ 전송 중...";

    const getSel = (id) => Array.from(document.querySelectorAll(`${id} .chip.active`)).map(c => c.innerText).join(' ');
    const expAmt = document.getElementById('expAmount').value;
    const expDet = document.getElementById('expDetail').value.trim();
    let expLine = (expAmt && expAmt > 0) ? `\n경비금액 :${Number(expAmt).toLocaleString()}원 (${expDet})` : "";

    const msg = `날짜 :${(new Date(document.getElementById('date').value).getMonth()+1)}.${(new Date(document.getElementById('date').value).getDate())}
거래처 :${client}
현장명 :${site}
작업내용 :${work}
작업시간 :${document.getElementById('start').value.replace(':',' ')}~${document.getElementById('end').value.replace(':',' ')}
작업인원 :${getSel('#member-chips')}
차량 : ${getSel('#car-chips')}
석식여부 : ${document.getElementById('dinner').value.toLowerCase()}
사용자재 :
${getSel('#material-chips')}\n${document.getElementById('materialExtra').value}${expLine}`;

    const files = document.getElementById('receipt').files;
    let fileArray = [];
    if (files.length > 0) {
        fileArray = await Promise.all(Array.from(files).map(async f => ({ content: await fileTo64(f), name: f.name, type: f.type })));
    }

    const payload = {
        action: "saveLog",
        data: {
            date: document.getElementById('date').value, client, site, work,
            start: document.getElementById('start').value, end: document.getElementById('end').value,
            members: getSel('#member-chips'), car: getSel('#car-chips'),
            materials: getSel('#material-chips') + "\n" + document.getElementById('materialExtra').value,
            dinner: document.getElementById('dinner').value,
            expAmount: expAmt || "0", expDetail: expDet || "없음",
            expPayer: getSel('#payer-chips') || "없음", submitter, files: fileArray
        }
    };

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        if (await res.text() === "SUCCESS") {
            alert("✅ 저장 성공!");
            if (navigator.share) await navigator.share({ title: '작업일보', text: msg });
        }
    } catch (e) { alert("⚠️ 오류 발생"); }
    finally { btn.disabled = false; btn.innerText = "🚀 저장 및 카톡 공유"; }
}