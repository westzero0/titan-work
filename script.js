const GAS_URL = "https://script.google.com/macros/s/AKfycbzlxVOWKIOyMIC2NQ7q4uAyCTNUGuBTA0hR3p7E4ut2t0ZaigQzndVNavxuZwp9j0pM/exec"; 
let currentSites = []; 
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
    
    // 💡 최적화: 캐시를 사용하는 함수로 교체하여 호출
    const data = await fetchClientsWithCache();
    // 데이터 로드 후 처리 로직 (거래처 칩 생성 등)을 여기에 추가하세요.

    document.getElementById('siteSearch').addEventListener('input', (e) => {
        const term = e.target.value.trim();
        const filtered = currentSites.filter(s => s.name.includes(term));
        renderSiteChips(filtered, term);
    });
});

// [데이터 로딩 최적화: 캐싱]
async function fetchClientsWithCache() {
    const cachedData = localStorage.getItem('titan_client_cache');
    const cacheTime = localStorage.getItem('titan_cache_time');
    const now = new Date().getTime();

    if (cachedData && cacheTime && (now - cacheTime < 10 * 60 * 1000)) {
        console.log("⚡ 캐시된 데이터를 사용합니다.");
        return JSON.parse(cachedData);
    }

    const res = await fetch(GAS_URL + "?action=getClients"); 
    const data = await res.json();
    localStorage.setItem('titan_client_cache', JSON.stringify(data));
    localStorage.setItem('titan_cache_time', now.toString());
    return data;
}

// [현장 칩 렌더링]
function renderSiteChips(sites, term = "") {
    const box = document.getElementById('site-chips');
    box.innerHTML = ""; 
    // (datalist 부분은 수기 입력을 위해 생략하거나 유지 가능)

    sites.forEach(s => {
        const isFin = s.status === "완료";
        const div = document.createElement('div');
        div.className = `chip ${isFin ? 'finished' : ''}`;
        div.innerText = isFin ? `[완료] ${s.name}` : s.name;
        div.onclick = () => {
            document.getElementById('siteSearch').value = s.name;
            document.querySelectorAll('#site-chips .chip').forEach(c => c.classList.remove('active'));
            div.classList.add('active');
        };
        box.appendChild(div);
    });
}

// [전송 후 초기화]
function resetForm() {
    document.getElementById('work').value = "";
    document.getElementById('siteSearch').value = "";
    document.getElementById('materialExtra').value = "";
    document.getElementById('expAmount').value = "";
    document.getElementById('expDetail').value = "";
    document.getElementById('receipt').value = "";
    document.getElementById('date').valueAsDate = new Date();
    document.getElementById('start').value = "08:00";
    document.getElementById('end').value = "17:00";
    document.getElementById('dinner').value = "no";
    document.querySelectorAll('.chip.active').forEach(c => c.classList.remove('active'));
    document.getElementById('site-chips').innerHTML = "";
    currentSites = [];
    console.log("✅ 초기화 완료");
}

// [메인 전송 함수]
async function send() {
    const btn = document.getElementById('sBtn');
    const submitter = document.getElementById('submitter').value;
    const work = document.getElementById('work').value.trim();
    const client = document.querySelector('#client-chips .chip.active')?.innerText;
    
    // 💡 현장명: 칩 선택 우선, 없으면 수기 입력값 사용
    const siteInput = document.getElementById('siteSearch').value.trim();
    const activeSiteChip = document.querySelector('#site-chips .chip.active')?.innerText;
    const site = activeSiteChip || siteInput; 

    if (!client || !site || !work) return alert("⚠️ 필수 정보를 입력해주세요.");

    btn.disabled = true; 
    btn.innerText = "⏳ 전송 중...";

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
사용자재 :
${getSel('#material-chips')}\n${document.getElementById('materialExtra').value}${expLine}`;

    const files = document.getElementById('receipt').files;
    let fileArray = [];
    if (files.length > 0) {
        fileArray = await Promise.all(Array.from(files).map(async f => ({ 
            content: await fileTo64(f), 
            name: f.name, 
            type: f.type 
        })));
    }

    const payload = {
        action: "saveLog",
        data: {
            date: document.getElementById('date').value, 
            client, 
            site, 
            work,
            start: document.getElementById('start').value, 
            end: document.getElementById('end').value,
            members: getSel('#member-chips'), 
            car: getSel('#car-chips'),
            materials: getSel('#material-chips') + "\n" + document.getElementById('materialExtra').value,
            dinner: document.getElementById('dinner').value,
            expAmount: expAmt || "0", 
            expDetail: expDet || "없음",
            expPayer: getSel('#payer-chips') || "없음", 
            submitter, 
            files: fileArray,
            isNewSite: !activeSiteChip // 💡 신규 현장 여부
        }
    };

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        if (await res.text() === "SUCCESS") {
            alert("✅ 저장 성공!");
            localStorage.removeItem('titan_client_cache'); // 💡 새 현장 반영을 위해 캐시 삭제
            if (navigator.share) {
                await navigator.share({ title: '작업일보', text: msg });
            }
            resetForm(); 
        }
    } catch (e) { 
        alert("⚠️ 오류 발생"); 
    } finally { 
        btn.disabled = false; 
        btn.innerText = "🚀 저장 및 카톡 공유"; 
    }
}

// 기타 UI 보조 함수들 (renderChips, toggleDelMode 등)은 기존 로직 유지
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
function toggleDelMode(type) {
    delMode[type] = !delMode[type];
    const btn = document.getElementById(`del-btn-${type}`);
    if (btn) btn.innerText = delMode[type] ? "✅ 완료" : "🗑️ 삭제";
    renderChips(type);
}
// ... (generateTimeOptions, fileTo64 등 나머지 함수) ...