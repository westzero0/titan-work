const GAS_URL = "https://script.google.com/macros/s/AKfycbyxRsSKc9OPvbQaZ9KqlF6fw6bd_UmR4ZQE70EBuYj0vkTPlMyv-0a84regiTpk6Her/exec"; 


let currentSelectedClient = "";
let clientSiteMap = {}; // { "거래처": [{name: "현장1", status: "진행중"}, ...] }

// 페이지 로드 시 데이터 가져오기
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('date').valueAsDate = new Date();
    await fetchClientMapping();
});

async function fetchClientMapping() {
    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "getClientMapping" })
        });
        clientSiteMap = await res.json();
        renderClientChips();
    } catch (e) { console.error("데이터 로드 실패"); }
}

// 현장 칩 및 검색 목록 렌더링
function renderSiteChips() {
    const siteBox = document.getElementById('site-chips');
    const dataList = document.getElementById('site-options');
    const showFinished = document.getElementById('showFinished').checked;
    
    siteBox.innerHTML = "";
    dataList.innerHTML = ""; // 검색 목록 초기화
    
    if (!currentSelectedClient) return;

    const sites = clientSiteMap[currentSelectedClient] || [];
    
    sites.forEach(siteObj => {
        const isFinished = siteObj.status === "완료";
        
        // 검색 목록(datalist)에는 모든 현장 추가
        const option = document.createElement('option');
        option.value = siteObj.name;
        if (isFinished) option.label = "(완료)";
        dataList.appendChild(option);

        // 칩(Quick Select)은 조건에 따라 표시
        if (showFinished || !isFinished) {
            const div = document.createElement('div');
            div.className = 'chip';
            if (isFinished) {
                div.style.backgroundColor = "#e2e8f0";
                div.style.color = "#94a3b8";
                div.innerText = "[AS] " + siteObj.name;
            } else {
                div.innerText = siteObj.name;
            }

            div.onclick = () => {
                document.getElementById('site-input').value = siteObj.name;
                updateActiveChip('#site-chips', div);
            };
            siteBox.appendChild(div);
        }
    });
}

// 입력창에 직접 타이핑할 때 칩 상태 동기화
function syncSiteSelection() {
    const val = document.getElementById('site-input').value;
    const chips = document.querySelectorAll('#site-chips .chip');
    chips.forEach(chip => {
        if (chip.innerText.includes(val) && val !== "") {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });
}

function updateActiveChip(containerId, target) {
    document.querySelectorAll(`${containerId} .chip`).forEach(c => c.classList.remove('active'));
    target.classList.add('active');
}

// 전송 함수에서 현장명 수집
async function send() {
    // ... 기존 코드 중략 ...
    const selectedSite = document.getElementById('site-input').value;
    
    if (!selectedSite) return alert("🏗️ 현장명을 입력하거나 선택해 주세요!");
    
    // payload 구성 시 selectedSite 사용
    // ... 나머지 전송 로직 동일
}


let lists = {
    member: ["기원", "창재", "비비", "서호"],
    car: ["봉고", "포터", "스타렉스", "창재차"],
    material: ["hfix2.5sq", "hfix4sq 전선", "22CD", "16CD", "전산볼트"]
};

let delMode = { member: false, car: false, material: false };

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('date').valueAsDate = new Date();
    renderAllChips();
});

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

function toggleDelMode(type) {
    delMode[type] = !delMode[type];
    const label = document.querySelector(`.chip-header span[onclick*="${type}"]`);
    label.innerText = delMode[type] ? "✅ 완료" : "🗑️ 삭제모드";
    renderChips(type);
}

function addItem(type) {
    const input = document.getElementById(`add-${type}-input`);
    const val = input.value.trim();
    if (!val || lists[type].includes(val)) return;
    lists[type].push(val); renderChips(type); input.value = "";
}

const fileTo64 = (f) => new Promise((res) => {
    const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.readAsDataURL(f);
});

async function send() {
    const btn = document.getElementById('sBtn');
    const site = document.getElementById('site').value;
    if (!site) return alert("🏗️ 현장명을 입력해주세요!");

    const getSelected = (id) => Array.from(document.querySelectorAll(`${id} .chip.active`)).map(c => c.innerText).join(', ');

    btn.disabled = true; btn.innerText = "⏳ 사진 처리 및 전송 중...";
    
    // 다중 파일 처리
    const receiptFiles = document.getElementById('receipt').files;
    let filesArray = [];
    if (receiptFiles.length > 0) {
        filesArray = await Promise.all(Array.from(receiptFiles).map(async (file) => ({
            content: await fileTo64(file),
            name: file.name,
            type: file.type
        })));
    }

    const payload = {
        action: "saveLog",
        data: {
            date: document.getElementById('date').value,
            client: document.getElementById('client').value,
            site: site,
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
            alert(`✅ 저장 완료! (영수증 ${filesArray.length}장)`);
            const msg = `[타이탄 일보]\n📅 ${payload.data.date}\n🏗️ 현장: ${payload.data.site}\n🛠️ 작업: ${payload.data.work}\n📦 자재: ${payload.data.materials}\n👥 인원: ${payload.data.members}\n🧾 영수증: ${filesArray.length}장 첨부`;
            if (navigator.share) navigator.share({ title: '타이탄 일보', text: msg });
            else alert("복사되었습니다:\n" + msg);
        }
    } catch (e) { alert("⚠️ 오류 발생!"); }
    finally { btn.disabled = false; btn.innerText = "🚀 저장 및 카톡 공유"; }
}