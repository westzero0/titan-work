const GAS_URL = "https://script.google.com/macros/s/AKfycbx6Kw0va7chL7OYgYZrvuFFTg-LSi65qfRYFGq7A-FuB1uG4Zt74JgdIMmOB_BTbS9v/exec";

let currentSites = []; 

// 1. [데이터 초기화] 저장된 리스트가 있으면 불러오고, 없으면 기본값 사용
const savedLists = localStorage.getItem('titan_custom_lists');
let lists = savedLists ? JSON.parse(savedLists) : {
    member: ["기원", "창재", "조환", "서호"],
    car: ["봉고", "포터", "스타렉스", "창재차"],
    material: ["2.5sq 전선", "4sq 전선", "CD관", "난연관", "복스"],
    payer: ["서영", "기원", "창재"]
};

// 2. [데이터 저장] 리스트가 변경될 때마다 핸드폰에 저장하는 함수
function saveListsToStorage() {
    localStorage.setItem('titan_custom_lists', JSON.stringify(lists));
}

let delMode = { member: false, car: false, material: false, payer: false };

// 3. [초기 로드] 앱 실행 시 실행되는 로직
document.addEventListener('DOMContentLoaded', () => {
    // 사용자 이름 로드
    let myName = localStorage.getItem('titan_user_name');
    if (!myName) {
        myName = prompt("이름을 입력해주세요.");
        if (myName) localStorage.setItem('titan_user_name', myName);
    }
    document.getElementById('submitter').value = myName || "미지정";
    document.getElementById('date').valueAsDate = new Date();
    
    generateTimeOptions();
    renderAllChips(); // 저장된 리스트로 칩 생성
    
    // 거래처/현장 데이터 동기화
    loadTitanDataWithBackgroundSync();

    // 현장 검색 리스너
    document.getElementById('siteSearch').addEventListener('input', (e) => {
        const term = e.target.value.trim();
        const filtered = currentSites.filter(s => s.name.includes(term));
        renderSiteChips(filtered, term);
    });
});

// 3. [데이터 동기화 및 스플래시 화면 제어]
async function loadTitanDataWithBackgroundSync() {

    // 💡 시작 시간을 기록합니다.
    const startTime = Date.now();
    
    const cachedMap = localStorage.getItem('titan_full_data_cache');
    if (cachedMap) { renderClientChips(Object.keys(JSON.parse(cachedMap))); }

    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getAllData' })
        });
        const fullData = await res.json();
        localStorage.setItem('titan_full_data_cache', JSON.stringify(fullData));
        if (!cachedMap) renderClientChips(Object.keys(fullData));
    } catch (e) {
        console.log("오프라인 모드: 캐시 사용");
    } finally {
        // 💡 핵심: 현재 시간과 시작 시간의 차이를 계산합니다.
        const elapsedTime = Date.now() - startTime;
        const minimumDisplayTime = 2000; // 2초 (2000ms)

        // 💡 2초보다 빨리 끝났다면 부족한 시간만큼 기다렸다가 숨깁니다.
        const remainingTime = Math.max(0, minimumDisplayTime - elapsedTime);
        
        setTimeout(() => {
            hideSplashScreen();
        }, remainingTime);
    }
}



function hideSplashScreen() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.style.display = 'none';
        }, 500);
    }
}

function fetchSites(clientName) {
    const cachedMap = localStorage.getItem('titan_full_data_cache');
    if (cachedMap) {
        const fullData = JSON.parse(cachedMap);
        const sites = fullData[clientName] || [];
        currentSites = sites;
        renderSiteChips(sites);
    }
}

// 5. [UI 렌더링] 칩 생성 및 관리 로직
function renderClientChips(clients) {
    const box = document.getElementById('client-chips');
    if (!box) return;
    box.innerHTML = "";
    clients.forEach(name => {
        const div = document.createElement('div');
        div.className = 'chip';
        div.innerText = name;
        div.onclick = async () => {
            document.querySelectorAll('#client-chips .chip').forEach(c => c.classList.remove('active'));
            div.classList.add('active');
            fetchSites(name);
        };
        box.appendChild(div);
    });
}

function renderSiteChips(sites = currentSites, term = "") {
    const box = document.getElementById('site-chips');
    const showAll = document.getElementById('showFinished').checked;
    if (!sites || !Array.isArray(sites)) return;
    box.innerHTML = "";
    sites.forEach(s => {
        const isFin = s.status === "완료";
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
            if (delMode[type]) { 
                lists[type] = lists[type].filter(i => i !== name); 
                saveListsToStorage(); // 💡 삭제 시 즉시 저장
                renderChips(type); 
            } else {
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
    if (val && !lists[type].includes(val)) { 
        lists[type].push(val); 
        saveListsToStorage(); // 💡 추가 시 즉시 저장
        renderChips(type); 
    }
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

// 6. [전송 및 공유] 데이터 서버 저장 및 카톡 전송
async function send() {
    const btn = document.getElementById('sBtn');
    const work = document.getElementById('work').value.trim();
    const client = document.querySelector('#client-chips .chip.active')?.innerText;
    const site = document.querySelector('#site-chips .chip.active')?.innerText || document.getElementById('siteSearch').value.trim();

    if (!client || !site || !work) return alert("⚠️ 필수 정보를 입력해주세요.");

    btn.disabled = true; btn.innerText = "⏳ 데이터 수집 중...";
    const getSel = (id) => Array.from(document.querySelectorAll(`${id} .chip.active`)).map(c => c.innerText).join(', ');
    
    const startTime = document.getElementById('start').value;
    const endTime = document.getElementById('end').value;
    const members = getSel('#member-chips') || "없음";
    const car = getSel('#car-chips') || "없음";
    const dinner = document.getElementById('dinner').value === "O" ? "O" : "X";
    const materials = [getSel('#material-chips'), document.getElementById('materialExtra').value.trim()].filter(Boolean).join(', ') || "없음";

    const expAmount = Number(document.getElementById('expAmount').value) || 0; 
    const expDetail = document.getElementById('expDetail').value.trim();
    const expPayer = getSel('#payer-chips') || "없음";

    let expenseLine = expAmount > 0 ? `\n💰 경비: ${expAmount.toLocaleString()}원${expDetail ? ` (${expDetail})` : ''}` : "";

    // 📸 [영수증 처리]
    const receiptInput = document.getElementById('receipt');
    const files = receiptInput.files;
    let filesData = [];

    if (files.length > 0) {
        try {
            for (let i = 0; i < files.length; i++) {
                btn.innerText = `📸 압축 중 (${i + 1}/${files.length})`; 
                const data = await compressImage(files[i]); 
                filesData.push({ content: data.base64, type: data.mimeType, name: data.name });
            }
        } catch (err) {
            alert("사진 압축 오류: " + err.message);
            btn.disabled = false; btn.innerText = "🚀 다시 시도";
            return;
        }
    }

    const msg = `⚡ [타이탄 작업일보]\n📅 날짜: ${document.getElementById('date').value}\n🏢 거래처: ${client}\n🏗️ 현장명: ${site}\n🛠️ 작업내용: ${work}\n⏰ 시간: ${startTime} ~ ${endTime}\n👥 인원: ${members}\n🚗 차량: ${car}\n🍱 석식: ${dinner}\n📦 자재: ${materials}${expenseLine}`;

    try {
        btn.innerText = "🚀 서버 전송 중..."; 
        const payload = {
            action: "saveLog",
            data: {
                date: document.getElementById('date').value, client, site, work,
                start: startTime, end: endTime, members, car, materials, dinner,
                expAmount, expDetail, expPayer, files: filesData,
                submitter: document.getElementById('submitter').value
            }
        };

     // 서버 전송 실행 (한 번만!)
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        const resultText = await res.text();

        if (resultText === "SUCCESS") {
            const tempMsg = msg; // 공유 메시지 백업
            resetFormOnlyInputs(); // 즉시 입력칸 비우기

            btn.disabled = false;
            btn.style.setProperty("background-color", "#fee500", "important");
            btn.style.setProperty("color", "#3c1e1e", "important");
            btn.innerText = "➡️ 지금 카톡으로 공유하기";

            btn.onclick = async () => {
                try {
                    if (navigator.share) {
                        await navigator.share({ text: tempMsg });
                    } else {
                        await copyToClipboard(tempMsg);
                    }
                    resetFormFull(); // 공유 후 버튼까지 리셋
                } catch (err) {
                    console.log("공유 취소");
                    resetFormFull();
                }
            };
            alert("✅ 저장 성공! 노란색 버튼을 눌러 공유하세요.");
        }
    } catch (e) {
        alert("⚠️ 전송 오류: " + e.message);
        btn.disabled = false; btn.innerText = "🚀 다시 시도";
    }
}

// 4. [리셋 함수 분리]
function resetFormOnlyInputs() {
    ['work', 'siteSearch', 'materialExtra', 'expAmount', 'expDetail'].forEach(id => {
        const el = document.getElementById(id); if(el) el.value = "";
    });
    const receipt = document.getElementById('receipt'); if(receipt) receipt.value = "";
    document.querySelectorAll('.chip.active').forEach(chip => chip.classList.remove('active'));
}

function resetFormFull() {
    resetFormOnlyInputs();
    // 1. 💡 시간 선택 상자를 다시 08:00와 17:00로 돌려놓습니다.
    const startTime = document.getElementById('start');
    const endTime = document.getElementById('end');
    if (startTime) startTime.value = "08:00";
    if (endTime) endTime.value = "17:00";

    // 2. 석식 여부도 다시 'X'로 초기화
    const dinner = document.getElementById('dinner');
    if (dinner) dinner.value = "X";

    // 3. 날짜를 오늘로 다시 설정
    document.getElementById('date').valueAsDate = new Date();
    
    const btn = document.getElementById('sBtn');
    btn.style.backgroundColor = ""; btn.style.color = ""; btn.style.fontWeight = "normal";
    btn.innerText = "🚀 저장 및 카톡 공유";
    btn.onclick = send; // 전송 함수 다시 연결
    document.getElementById('date').valueAsDate = new Date();
}


// 📋 메시지 복사 함수
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        alert("메시지가 복사되었습니다.");
    } catch (err) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert("메시지가 복사되었습니다.");
    }
}

async function compressImage(file) {
    return new Promise((resolve, reject) => {
        // 💡 1단계: 파일을 아주 작은 덩어리(Blob)로 복제해서 권한을 고정합니다.
        const blob = file.slice(0, file.size, file.type);
        const blobUrl = URL.createObjectURL(blob);
        const img = new Image();

        img.src = blobUrl;

        img.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            reject(new Error("사진 로딩 실패: 사진 용량이 너무 커서 브라우저가 읽지 못합니다. (다른 앱을 닫고 다시 시도해 주세요)"));
        };

        img.onload = () => {
            try {
                // 💡 2단계: 캔버스 크기를 600px로 더 줄여서 메모리 과부하를 원천 차단합니다.
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                let width = img.width;
                let height = img.height;
                const max_size = 600; // 800에서 600으로 더 하향

                if (width > height) {
                    if (width > max_size) { height *= max_size / width; width = max_size; }
                } else {
                    if (height > max_size) { width *= max_size / height; height = max_size; }
                }

                canvas.width = width;
                canvas.height = height;
                
                // 💡 3단계: 이미지를 캔버스에 그릴 때 품질 손실을 감수하고서라도 메모리를 아낍니다.
                ctx.imageSmoothingEnabled = false; 
                ctx.drawImage(img, 0, 0, width, height);

                // 💡 4단계: 품질을 0.3까지 낮춰 전송 성공률을 99%까지 끌어올립니다.
                const dataUrl = canvas.toDataURL('image/jpeg', 0.3);
                URL.revokeObjectURL(blobUrl);

                if (dataUrl.length < 100) throw new Error("압축 데이터 생성 실패");

                resolve({
                    base64: dataUrl.split(',')[1],
                    mimeType: 'image/jpeg',
                    name: file.name.split('.')[0] + '.jpg'
                });
            } catch (e) {
                URL.revokeObjectURL(blobUrl);
                reject(new Error("메모리 부족: 실행 중인 다른 앱들을 종료하고 다시 시도해 주세요."));
            }
        };
    });
}
