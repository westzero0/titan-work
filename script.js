const GAS_URL = "https://script.google.com/macros/s/AKfycbxegvNbdLfBN4A6Qo6ApDTj9p4PPvnfLcbzI9aiLrjS4VxqmjlWhLsxaSbSjUDys_65/exec"; 

let clientSiteMap = {}; 
let lists = {
    member: ["기원", "창재", "비비", "서호"],
    car: ["봉고", "포터", "스타렉스", "창재차"],
    payer: ["비비", "기원", "창재"] // 결제자 칩 명단 추가
};
let delMode = { member: false, car: false, payer: false };

/**
 * 1. 초기화
 */
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('date').valueAsDate = new Date();
    generateTimeOptions();
    
    // 💾 작성자 이름 자동 로드
    const savedName = localStorage.getItem('titan_submitter');
    if (savedName) document.getElementById('submitter').value = savedName;

    fetchClientMapping(); 
    renderAllChips();
});

async function fetchClientMapping() {
    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action: "getClientMapping" }) });
        clientSiteMap = await res.json();
        renderClientChips();
    } catch (e) { console.error("데이터 로드 실패"); }
}

function generateTimeOptions() {
    const s = document.getElementById('start'), e = document.getElementById('end');
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 30) {
            const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            s.add(new Option(time, time)); e.add(new Option(time, time));
        }
    }
    s.value = "08:00"; e.value = "17:00";
}

/**
 * 2. 칩 관리 로직
 */
function renderAllChips() {
    renderChips('member'); renderChips('car'); renderChips('payer');
}

function renderChips(type) {
    const box = document.getElementById(`${type}-chips`);
    box.innerHTML = "";
    lists[type].forEach(name => {
        const div = document.createElement('div');
        div.className = `chip ${delMode[type] ? 'delete-target' : ''}`;
        div.innerText = name;
        div.onclick = () => {
            if (delMode[type]) { 
                lists[type] = lists[type].filter(i => i !== name); renderChips(type); 
            } else {
                if(type === 'payer') { // 결제자는 하나만 선택 가능
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
    if (val && !lists[type].includes(val)) { lists[type].push(val); renderChips(type); }
    input.value = "";
}

function toggleDelMode(type) {
    delMode[type] = !delMode[type];
    renderChips(type);
}

/**
 * 3. 데이터 전송
 */
async function send() {
    const submitter = document.getElementById('submitter').value.trim();
    if (!submitter) return alert("⚠️ 작성자 이름을 입력해 주세요!");
    localStorage.setItem('titan_submitter', submitter); // 이름 기억 [cite: 2026-01-21]

    const btn = document.getElementById('sBtn');
    const client = document.querySelector('#client-chips .chip.active')?.innerText;
    const site = document.getElementById('siteSearch').value || document.querySelector('#site-chips .chip.active')?.innerText;
    const work = document.getElementById('work').value.trim();
    const expPayer = document.querySelector('#payer-chips .chip.active')?.innerText || "없음"; [cite: 2026-01-21]

    if (!client || !site || !work) return alert("⚠️ 거래처, 현장, 내용을 확인해 주세요!");

    btn.disabled = true; btn.innerText = "⏳ 저장 중...";

    const payload = {
        action: "saveLog",
        data: {
            date: document.getElementById('date').value,
            client, site, work,
            start: document.getElementById('start').value,
            end: document.getElementById('end').value,
            members: Array.from(document.querySelectorAll('#member-chips .chip.active')).map(c => c.innerText).join(' '),
            car: Array.from(document.querySelectorAll('#car-chips .chip.active')).map(c => c.innerText).join(' '),
            dinner: document.getElementById('dinner').value,
            expAmount: document.getElementById('expAmount').value || "0",
            expDetail: document.getElementById('expDetail').value || "없음",
            expPayer: expPayer,
            submitter: submitter,
            files: [] // 파일 처리 로직(fileTo64)은 기존과 동일하게 추가 가능
        }
    };

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        if (await res.text() === "SUCCESS") alert("✅ 저장 완료!");
    } catch (e) { alert("⚠️ 전송 오류"); }
    finally { btn.disabled = false; btn.innerText = "🚀 저장 및 카톡 공유"; }
}