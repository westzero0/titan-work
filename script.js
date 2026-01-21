const GAS_URL = "https://script.google.com/macros/s/AKfycbzWvSifWq5Gm0zgb5_paLZoHgvWnwkFp8ZfTwt8pKcmYH7YkR-qvCzo5z6if_BiTic/exec"; 

let currentSites = []; // 💡 현재 선택된 거래처의 전체 현장 목록 저장
let lists = {
    member: ["기원", "창재", "비비", "서호"],
    car: ["봉고", "포터", "스타렉스", "창재차"],
    material: ["2.5sq 전선", "4sq 전선", "CD관", "난연관", "복스"],
    payer: ["비비", "기원", "창재"]
};
let delMode = { member: false, car: false, material: false, payer: false };

document.addEventListener('DOMContentLoaded', async () => {
    // 사용자 이름 설정
    let myName = localStorage.getItem('titan_user_name');
    if (!myName) {
        myName = prompt("이름을 입력해주세요. (최초 1회)");
        if (myName) localStorage.setItem('titan_user_name', myName);
    }
    document.getElementById('submitter').value = myName || "미지정";
    
    // 날짜 및 초기 옵션 렌더링
    document.getElementById('date').valueAsDate = new Date();
    generateTimeOptions();
    renderAllChips();
    await fetchClientsOnly(); // 거래처 목록 로드 (기존 함수 유지)

    // 💡 현장 검색 실시간 필터링 이벤트 추가
    document.getElementById('siteSearch').addEventListener('input', (e) => {
        const term = e.target.value.trim();
        const filtered = currentSites.filter(s => s.name.includes(term));
        renderSiteChips(filtered, term);
    });
});

// 💡 현장명 검색 및 신규 추가 버튼 렌더링
function renderSiteChips(sites, term = "") {
    const box = document.getElementById('site-chips');
    const dl = document.getElementById('site-options');
    const showAll = document.getElementById('showFinished').checked;
    box.innerHTML = ""; 
    dl.innerHTML = "";

    // 검색 결과가 없고 검색어가 입력된 경우 '신규 추가' 버튼 생성
    if (sites.length === 0 && term.length > 0) {
        const addBtn = document.createElement('div');
        addBtn.className = "chip add-chip";
        addBtn.innerText = `➕ '${term}' 신규 등록`;
        addBtn.onclick = () => {
            document.getElementById('siteSearch').value = term;
            document.querySelectorAll('#site-chips .chip').forEach(c => c.classList.remove('active'));
            addBtn.classList.add('active');
        };
        box.appendChild(addBtn);
    }

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

// 💡 폼 초기화 (전송 성공 후 호출)
function resetForm() {
    // 텍스트/숫자 입력창 초기화
    document.getElementById('work').value = "";
    document.getElementById('siteSearch').value = "";
    document.getElementById('materialExtra').value = "";
    document.getElementById('expAmount').value = "";
    document.getElementById('expDetail').value = "";
    document.getElementById('receipt').value = "";
    
    // 시간 및 날짜 리셋
    document.getElementById('date').valueAsDate = new Date();
    document.getElementById('start').value = "08:00";
    document.getElementById('end').value = "17:00";
    document.getElementById('dinner').value = "no";

    // 칩 활성화 해제
    document.querySelectorAll('.chip.active').forEach(c => c.classList.remove('active'));
    
    // 현장 칩 박스 초기화 (거래처 재선택 유도)
    document.getElementById('site-chips').innerHTML = "";
    currentSites = [];

    console.log("작업 일보가 초기화되었습니다.");
}

// 저장 및 공유 메인 함수
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
            // 💡 공유 완료 후 초기화 실행
            if (navigator.share) {
                await navigator.share({ title: '작업일보', text: msg });
            }
            resetForm(); 
        }
    } catch (e) { 
        alert("⚠️ 오류 발생"); 
    } finally { 
        btn.disabled = false; btn.innerText = "🚀 저장 및 카톡 공유"; 
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