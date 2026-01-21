const GAS_URL = "https://script.google.com/macros/s/AKfycbzWvSifWq5Gm0zgb5_paLZoHgvWnwkFp8ZfTwt8pKcmYH7YkR-qvCzo5z6if_BiTic/exec"; 

let currentSites = []; // 선택된 거래처의 현장 목록 저장
let lists = {
    member: ["기원", "창재", "비비", "서호"],
    car: ["봉고", "포터", "스타렉스", "창재차"],
    material: ["2.5sq 전선", "4sq 전선", "CD관", "난연관", "복스"],
    payer: ["비비", "기원", "창재"]
};
let delMode = { member: false, car: false, material: false, payer: false };

// [1. 초기 로드 및 이벤트 리스너]
document.addEventListener('DOMContentLoaded', async () => {
    let myName = localStorage.getItem('titan_user_name');
    if (!myName) {
        myName = prompt("이름을 입력해주세요. (최초 1회)");
        if (myName) localStorage.setItem('titan_user_name', myName);
    }
    document.getElementById('submitter').value = myName || "미지정";
    document.getElementById('date').valueAsDate = new Date();
    
    // 💡 아래 정의된 함수들을 호출합니다.
    generateTimeOptions();
    renderAllChips();
    
    // 거래처 데이터 로드 (캐시 우선 사용)
    await fetchClientsWithCache(); 

    document.getElementById('siteSearch').addEventListener('input', (e) => {
        const term = e.target.value.trim();
        const filtered = currentSites.filter(s => s.name.includes(term));
        renderSiteChips(filtered, term);
    });
});

// [2. 데이터 로딩 및 캐싱]
async function fetchClientsWithCache() {
    const cachedData = localStorage.getItem('titan_client_cache');
    const cacheTime = localStorage.getItem('titan_cache_time');
    const now = new Date().getTime();

    // 10분 이내 캐시 데이터가 있다면 사용
    if (cachedData && cacheTime && (now - cacheTime < 10 * 60 * 1000)) {
        console.log("⚡ 캐시 데이터를 사용합니다.");
        return JSON.parse(cachedData);
    }

    try {
        const res = await fetch(GAS_URL + "?action=getClients"); 
        const data = await res.json();
        localStorage.setItem('titan_client_cache', JSON.stringify(data));
        localStorage.setItem('titan_cache_time', now.toString());
        return data;
    } catch (e) {
        console.error("데이터 로드 실패:", e);
        return [];
    }
}

// [3. UI 렌더링 및 보조 함수들]
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
                if (type === 'payer') document.querySelectorAll('#payer-chips .chip').forEach(c => c.classList.remove('active'));
                div.classList.toggle('active');
            }
        };
        box.appendChild(div);
    });
}

function renderSiteChips(sites, term = "") {
    const box = document.getElementById('site-chips');
    box.innerHTML = ""; 
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

function toggleDelMode(type) {
    delMode[type] = !delMode[type];
    const btn = document.getElementById(`del-btn-${type}`);
    if (btn) btn.innerText = delMode[type] ? "✅ 완료" : "🗑️ 삭제";
    renderChips(type);
}

// [4. 전송 및 초기화 로직]
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
}

async function send() {
    const btn = document.getElementById('sBtn');
    const submitter = document.getElementById('submitter').value;
    const work = document.getElementById('work').value.trim();
    const client = document.querySelector('#client-chips .chip.active')?.innerText;
    
    // 수기 입력 혹은 칩 선택값 가져오기
    const siteInput = document.getElementById('siteSearch').value.trim();
    const activeSiteChip = document.querySelector('#site-chips .chip.active')?.innerText;
    const site = activeSiteChip || siteInput; 

    if (!client || !site || !work) return alert("⚠️ 필수 정보를 입력해주세요.");

    btn.disabled = true; btn.innerText = "⏳ 전송 중...";

    const getSel = (id) => Array.from(document.querySelectorAll(`${id} .chip.active`)).map(c => c.innerText).join(' ');
    const expAmt = document.getElementById('expAmount').value;
    const expDet = document.getElementById('expDetail').value.trim();
    let expLine = (expAmt && expAmt > 0) ? `\n경비금액 :${Number(expAmt).toLocaleString()}원 (${expDet})` : "";

    const msg = `날짜 :${(new Date(document.getElementById('date').value).getMonth()+1)}.${(new Date(document.getElementById('date').value).getDate())}\n거래처 :${client}\n현장명 :${site}\n작업내용 :${work}\n작업시간 :${document.getElementById('start').value}~${document.getElementById('end').value}\n작업인원 :${getSel('#member-chips')}\n차량 : ${getSel('#car-chips')}\n사용자재 :\n${getSel('#material-chips')}\n${document.getElementById('materialExtra').value}${expLine}`;

    const files = document.getElementById('receipt').files;
    let fileArray = [];
    if (files.length > 0) {
        // 💡 여러 장의 사진을 처리하기 위해 map을 사용합니다.
        fileArray = await Promise.all(Array.from(files).map(async f => ({ 
            content: await fileTo64(f), name: f.name, type: f.type 
        })));
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
            expPayer: getSel('#payer-chips') || "없음", submitter, files: fileArray,
            isNewSite: !activeSiteChip
        }
    };

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        if (await res.text() === "SUCCESS") {
            alert("✅ 저장 성공!");
            localStorage.removeItem('titan_client_cache'); // 새 현장 반영 위해 캐시 삭제
            if (navigator.share) await navigator.share({ title: '작업일보', text: msg });
            resetForm(); 
        }
    } catch (e) { 
        alert("⚠️ 오류 발생"); 
    } finally { 
        btn.disabled = false; btn.innerText = "🚀 저장 및 카톡 공유"; 
    }
}

const fileTo64 = (f) => new Promise((res) => {
    const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.readAsDataURL(f);
});

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
