const APP_VERSION = "1.6"; // 👈 기능 수정할 때마다 이 숫자를 1.6, 1.7로 올리세요!

document.addEventListener('DOMContentLoaded', () => {
    const savedVer = localStorage.getItem('titan_app_version');

    // 버전이 바뀌었으면 옛날 캐시 데이터 삭제 (로그인 정보는 유지)
    if (savedVer !== APP_VERSION) {
        console.log("새 버전 감지! 데이터 초기화 중...");
        
        // 1. 자재 데이터, 현장 데이터 등 꼬일 수 있는 것들 삭제
        localStorage.removeItem('titan_full_data_cache'); 
        localStorage.removeItem('titan_custom_lists'); // 목록도 초기화 필요하면 삭제
        
        // 2. 새 버전 번호 저장
        localStorage.setItem('titan_app_version', APP_VERSION);
        
        // 3. 안내 메시지 (선택 사항)
        alert(`⚡ 타이탄 앱이 업데이트되었습니다! (v${APP_VERSION})\n새로운 기능을 불러옵니다.`);
        
        // 4. 페이지 새로고침하여 새 코드 적용
        location.reload();
        return; 
    }
});



const GAS_URL = "https://script.google.com/macros/s/AKfycbzWAeRfYuibRkaElDGYhYMmahT-kYbE3_uZ8wGj-3tEK32YOWfiZ64niPZrqAncetN2/exec";


// 💡 1. 통합 초기 로드 로직
document.addEventListener('DOMContentLoaded', async () => {
    // 스플래시 화면 제어
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => { splash.style.display = 'none'; }, 500);
        }
    }, 2000);

    // 로그인 상태 확인
    const savedName = localStorage.getItem('titan_user_name');
    
    if (!savedName) {
        showLoginScreen();
    } else {
        const isActive = await checkAuth(savedName);
        if (isActive) {
            initApp(savedName); 
        }
    }
});


/**
 * 💡 로그인 화면 제어
 */
async function showLoginScreen() {
    const screen = document.getElementById('login-screen');
    const select = document.getElementById('login-name-select');
    
    // 메인 페이지와 내비바 숨기기
    document.querySelector('.container').style.display = 'none';
    document.querySelector('.bottom-nav').style.display = 'none';
    screen.style.display = 'flex';

    try {
// 💡 fetch 옵션에서 'mode'는 제거하고 'redirect'를 추가합니다.
const res = await fetch(GAS_URL, {
    method: 'POST',
    // mode: 'cors' 혹은 'no-cors'가 있다면 지우세요! (기본값으로 두는게 안전함)
    redirect: 'follow',  // ★ 이 줄을 꼭 추가하세요! (서버가 가라는 곳으로 따라가라는 뜻)
    body: JSON.stringify({ action: "getWorkerList" }),
    
    // 🔑 구글 서버의 리다이렉션을 따라가도록 만드는 핵심 옵션
    redirect: 'follow' 
});

// 💡 응답을 텍스트로 먼저 받은 후 JSON으로 파싱 (CORS 에러 완화 전략)
const text = await res.text();
const workers = JSON.parse(text);
        workers.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.innerText = name;
            select.appendChild(opt);
        });
    } catch (e) {
        alert("명단을 불러오지 못했습니다. 인터넷을 확인하세요.");
    }
}

/**
 * 💡 로그인 실행
 */
async function handleLogin() {
    const name = document.getElementById('login-name-select').value;
    const pw = document.getElementById('login-pw-input').value;
    const btn = document.getElementById('login-btn');

    if (!name || !pw) return alert("이름과 비밀번호를 입력하세요.");

    btn.disabled = true;
    btn.innerText = "⏳ 확인 중...";

    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "loginCheck", userName: name, password: pw })
        });
        const result = await res.json();

        if (result.res === "SUCCESS") {
            localStorage.setItem('titan_user_name', name);
            alert(`${name}님, 환영합니다!`);
            location.reload(); // 새로고침하여 메인 진입
        } else {
            alert(result.msg);
            btn.disabled = false;
            btn.innerText = "로그인";
        }
    } catch (e) {
        alert("로그인 중 오류 발생");
        btn.disabled = false;
        btn.innerText = "로그인";
    }
}

/**
 * 💡 퇴사 여부 실시간 체크
 */
async function checkAuth(userName) {
    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "loginCheck", userName: userName, password: "SKIP_PASSWORD" })
        });
        const result = await res.json();
        
        if (result.msg === "퇴사 처리된 계정입니다.") {
            localStorage.removeItem('titan_user_name');
            alert("접근 권한이 취소되었습니다. 관리자에게 문의하세요.");
            location.reload();
            return false;
        }
        return true;
    } catch (e) {
        return true; // 에러 시 서비스 연속성을 위해 일단 허용
    }
}


/**
 * 💡 앱 초기화 (로그인 성공 후)
 */
function initApp(name) {
    // 1. UI 전환
    document.getElementById('login-screen').style.display = 'none';
    document.querySelector('.container').style.display = 'block';
    document.querySelector('.bottom-nav').style.display = 'flex';

    // 2. 데이터 세팅
    const subEl = document.getElementById('submitter');
    if (subEl) subEl.value = name;
    
    const dateEl = document.getElementById('date');
    if (dateEl) dateEl.valueAsDate = new Date();
    
    // 3. 필수 함수 실행
    generateTimeOptions(); // 시간 옵션 생성
    renderAllChips();      // 로컬 리스트 칩 렌더링
    loadTitanDataWithBackgroundSync(); // 👈 여기서 거래처/현장을 서버에서 가져옵니다!

    // 4. 검색 이벤트 리스너 등록
    const searchEl = document.getElementById('siteSearch');
    if (searchEl) {
        searchEl.addEventListener('input', (e) => {
            const term = e.target.value.trim();
            const filtered = currentSites.filter(s => s.name.includes(term));
            renderSiteChips(filtered, term);
        });
    }
}

// 현장 검색 핸들러 (분리해서 관리하는 것이 깔끔합니다)
function siteSearchHandler(e) {
    const term = e.target.value.trim();
    const filtered = currentSites.filter(s => s.name.includes(term));
    renderSiteChips(filtered, term);
}


let currentSites = []; 
let allSchedules = [];
let showPast = false;
let currentView = 'list';
let viewDate = new Date();
let delMode = { member: false, car: false, material: false, payer: false };

// 1. [데이터 초기화]
const savedLists = localStorage.getItem('titan_custom_lists');
let lists = savedLists ? JSON.parse(savedLists) : {
    member: ["기원", "창재", "조환", "서호"],
    car: ["봉고", "포터", "스타렉스", "창재차"],
    material: ["2.5sq 전선", "4sq 전선", "CD관", "난연관", "복스"],
    payer: ["서영", "기원", "창재"]
};

function saveListsToStorage() {
    localStorage.setItem('titan_custom_lists', JSON.stringify(lists));
}



// 3. [데이터 동기화] (무한로딩 방지 안전장치 포함)
async function loadTitanDataWithBackgroundSync() {
    const startTime = Date.now();
    const safetyTimeout = setTimeout(() => hideSplashScreen(), 5000); 

    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getAllData' })
        });
        const fullData = await res.json();
        
        // 데이터가 정상적인 객체인지 확인
        if (fullData && typeof fullData === 'object' && !fullData.status) {
            localStorage.setItem('titan_full_data_cache', JSON.stringify(fullData));
            
            // 칩 렌더링 함수 실행
            const clientNames = Object.keys(fullData);
            renderClientChips(clientNames);
        }
    } catch (e) {
        console.log("연결 실패: 캐시 데이터 사용");
        const cached = localStorage.getItem('titan_full_data_cache');
        if (cached) renderClientChips(Object.keys(JSON.parse(cached)));
    } finally {
        clearTimeout(safetyTimeout); 
        const remainingTime = Math.max(0, 1500 - (Date.now() - startTime));
        setTimeout(() => hideSplashScreen(), remainingTime);
    }
}

function hideSplashScreen() {
    const splash = document.getElementById('splash-screen');
    if (splash && splash.style.display !== 'none') {
        splash.style.opacity = '0';
        setTimeout(() => { splash.style.display = 'none'; }, 500);
    }
}

function fetchSites(clientName) {
    const cached = localStorage.getItem('titan_full_data_cache');
    if (cached) {
        const fullData = JSON.parse(cached);
        currentSites = fullData[clientName] || [];
        renderSiteChips(currentSites);
    }
}

// 4. [UI 렌더링]
// 💡 거래처 칩 렌더링 함수 (비우기 로직 강화 버전)
function renderClientChips(clients) {
    const box = document.getElementById('client-chips');
    if (!box) return;
    
    // 1. 기존 내용(글자, 로딩 메시지 등)을 완전히 깨끗하게 삭제
    box.innerHTML = ""; 

    if (!clients || clients.length === 0) {
        box.innerHTML = "<span class='loading-text' style='color:#ef4444;'>등록된 거래처가 없습니다.</span>";
        return;
    }

    // 2. 서버에서 받은 이름들을 가나다 순으로 정렬해서 칩 생성
    clients.sort().forEach(name => {
        if (!name) return; 
        const div = document.createElement('div');
        div.className = 'chip';
        div.innerText = name;
        div.onclick = () => {
            // 다른 칩의 파란색(active)을 끄고 클릭한 것만 켬
            document.querySelectorAll('#client-chips .chip').forEach(c => c.classList.remove('active'));
            div.classList.add('active');
            fetchSites(name); // 해당 거래처의 현장 목록 불러오기
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
            if(term === "" || s.name.includes(term)) {
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
        }
    });
}


/**
 * 💡 현장 검색창 입력 시 칩 선택 상태를 동기화하는 함수
 */
function syncSiteSelection() {
    const searchTerm = document.getElementById('siteSearch').value.trim();
    const chips = document.querySelectorAll('#site-chips .chip');
    
    // 모든 칩의 활성화 상태를 일단 해제
    chips.forEach(chip => chip.classList.remove('active'));

    // 입력한 글자와 정확히 일치하는 칩이 있다면 파란색(active)으로 변경
    if (searchTerm !== "") {
        chips.forEach(chip => {
            // [완료] 표시가 붙은 경우도 고려하여 체크
            const chipName = chip.innerText.replace('[완료] ', '').trim();
            if (chipName === searchTerm) {
                chip.classList.add('active');
            }
        });
    }
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
                saveListsToStorage(); 
                renderChips(type); 
            } else {
                if (type === 'payer') document.querySelectorAll('#payer-chips .chip').forEach(c => c.classList.remove('active'));
                div.classList.toggle('active');
            }
        };
        box.appendChild(div);
    });
}

// 💡 통합된 추가 함수 (버튼 클릭 & 컴퓨터 자동 추가 공용)
function addItem(type, val = null) {
    // 1. 직접 입력(val 없음)이면 입력창에서 가져오고, 자동추가(val 있음)면 그 값을 씀
    const input = document.getElementById(`add-${type}-input`);
    const finalVal = (val !== null) ? val.trim() : input.value.trim();

    if (finalVal && !lists[type].includes(finalVal)) {
        lists[type].push(finalVal);
        saveListsToStorage();
        renderChips(type);
    }

    // 2. 입력창을 통해 추가했을 때만 칸을 비워줌
    if (input && val === null) input.value = "";

    // 3. 자동 추가 시에는 해당 칩을 파란색(active)으로 바로 켜줌
    if (val !== null) {
        setTimeout(() => {
            const chips = document.querySelectorAll(`#${type}-chips .chip`);
            chips.forEach(c => { if(c.innerText === finalVal) c.classList.add('active'); });
        }, 50);
    }
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

// 6. [전송 및 공유] 통합 완성본 (사진압축 + 서버저장 + 카톡공유)
async function send() {
    const btn = document.getElementById('sBtn');
    
    // --- 1. 입력값 가져오기 ---
    const work = document.getElementById('work').value.trim();
    // 석식 여부
    const dinnerValue = document.getElementById('dinner-yn').checked ? "O" : "X"; 
    
    const client = document.querySelector('#client-chips .chip.active')?.innerText;
    let site = document.querySelector('#site-chips .chip.active')?.innerText;
    if (!site) site = document.getElementById('siteSearch').value.trim();
    
    // 필수값 체크
    if (!client || !site || !work) return alert("⚠️ 필수 정보(거래처, 현장, 작업내용)를 입력해주세요.");

    btn.disabled = true; 

    // --- 2. 자재 텍스트 정리 (카톡 공유용) ---
    // 기존 텍스트 자재
    const matText = document.getElementById('materialExtra')?.value.trim();
    // 신규 선택 자재 (수량 있는 것만)
    const matList = Object.values(selectedMaterials).filter(m => m.qty > 0);
    // "품명(3개)" 형식으로 변환
    const matListTxt = matList.map(m => `${m.name}(${m.qty}${m.unit})`).join(', ');
    
    // 두 가지 방식 합치기
    const finalMaterialString = [matText, matListTxt].filter(t => t).join(', ') || "없음";


    // --- 3. 사진 압축 및 처리 (이 부분이 복구되었습니다!) ---
    const receiptInput = document.getElementById('receipt');
    let filesData = [];
    
    if (receiptInput.files.length > 0) {
        for (let i = 0; i < receiptInput.files.length; i++) {
            btn.innerText = `📸 사진 압축 중 (${i + 1}/${receiptInput.files.length})`;
            try {
                // compressImage 함수는 script.js 어딘가에 있어야 합니다!
                const data = await compressImage(receiptInput.files[i]); 
                filesData.push({ content: data.base64, type: data.mimeType, name: data.name });
            } catch (e) {
                console.error("사진 압축 실패:", e);
                alert("일부 사진 압축에 실패했습니다. 제외하고 진행합니다.");
            }
        }
    }

    btn.innerText = "⏳ 서버 전송 중...";

    // --- 4. 데이터 포장 (Payload) ---
    const getSel = (id) => Array.from(document.querySelectorAll(`${id} .chip.active`)).map(c => c.innerText).join(', ');
    
    const payload = {
        action: "saveLog",
        data: {
            date: document.getElementById('date').value,
            client: client,
            site: site,
            work: work,
            start: document.getElementById('start').value,
            end: document.getElementById('end').value,
            members: getSel('#member-chips'),
            car: getSel('#car-chips'),
            dinner: dinnerValue,
            materials: matText || "없음", // 기존 텍스트 방식
            selectedMaterials: matList, // 신규 방식 (객체 배열)
            expAmount: document.getElementById('expAmount')?.value || 0,
            expDetail: document.getElementById('expDetail')?.value || "",
            expPayer: getSel('#payer-chips'),
            files: filesData, // ★ 압축된 사진 데이터
            submitter: document.getElementById('submitter').value
        }
    };

    try {
        // --- 5. 서버 전송 (redirect: follow 필수!) ---
        const res = await fetch(GAS_URL, {
            method: 'POST',
            redirect: 'follow', // ★ 중요: 서버 응답 따라가기
            body: JSON.stringify(payload)
        });

        const textResult = await res.text();
        
        // JSON 파싱 확인
        let jsonResult;
        try {
            jsonResult = JSON.parse(textResult);
        } catch (e) {
            throw new Error("서버 응답 오류 (HTML 반환됨)");
        }

        // --- 6. 성공 처리 ---
        if (jsonResult === "SUCCESS" || jsonResult.result === "SUCCESS" || jsonResult.res === "SUCCESS") {
            
            alert("✅ 저장되었습니다!");

            // 카톡 공유 메시지 만들기
            let msg = `[${payload.data.date}] 작업일보\n`;
            msg += `🏢 ${client} / ${site}\n`;
            msg += `🛠 ${work}\n`;
            msg += `👥 ${payload.data.members}\n`;
            if(dinnerValue === "O") msg += `🍚 석식: O\n`;
            if(finalMaterialString !== "없음") msg += `📦 자재: ${finalMaterialString}\n`;
            if(payload.data.car) msg += `🚗 차량: ${payload.data.car}\n`;
            
            // 경비가 있을 때만 표시
            if(payload.data.expAmount > 0) {
                 msg += `💰 경비: ${Number(payload.data.expAmount).toLocaleString()}원 (${payload.data.expDetail}/${payload.data.expPayer})`;
            }

            // 버튼 UI 변경
            btn.innerText = "💬 카톡 공유하기";
            btn.style.backgroundColor = "#FEE500"; 
            btn.style.color = "#000000";
            
         // ★ 핵심: 공유 로직 (네이티브 공유 -> 실패시 클립보드)
            btn.onclick = async () => {
                try {
                    // 1. 모바일 공유창 띄우기 시도
                    if (navigator.share) {
                        await navigator.share({
                            title: '타이탄 작업일보',
                            text: msg
                        });
                    } else {
                        // PC 등 지원 안 하면 에러 발생시켜서 catch로 보냄
                        throw new Error("공유 미지원");
                    }
                } catch (err) {
                    // 2. 공유 실패(또는 취소) 시 클립보드 복사로 전환
                    try {
                        await navigator.clipboard.writeText(msg);
                        alert("📋 내용이 복사되었습니다.\n카톡방에 '붙여넣기' 하세요.");
                    } catch (clipErr) {
                        prompt("복사 실패. 아래 텍스트를 직접 복사하세요:", msg);
                    }
                }
                
                // 3. 잠시 후 초기화
                setTimeout(resetFormFull, 1000);
            };

            // 입력창만 비우기 (연속 입력 대기)
            resetFormOnlyInputs();

        } else {
            throw new Error(jsonResult.message || "저장 실패");
        }

    } catch (e) {
        alert("🚨 에러 발생:\n" + e.message);
        btn.innerText = "🚀 저장 및 카톡 공유";
        btn.disabled = false;
    }
}


// 💡 사진을 초경량으로 압축해서 서버로 보낼 수 있게 만드는 함수 (수정본)
async function compressImage(file) {
    return new Promise((resolve, reject) => {
        const blob = file.slice(0, file.size, file.type);
        const blobUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.src = blobUrl;

        img.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            reject(new Error("사진 로딩 실패"));
        };

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 가로폭을 600px로 압축 (현장에서 가장 잘 전송되는 크기)
            let width = img.width;
            let height = img.height;
            const max_size = 600; 

            if (width > height) {
                if (width > max_size) { height *= max_size / width; width = max_size; }
            } else {
                if (height > max_size) { width *= max_size / height; height = max_size; }
            }

            canvas.width = width;
            canvas.height = height;
            
            // 품질을 0.3까지 낮춰 전송 속도 3배 향상
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.3);
            
            URL.revokeObjectURL(blobUrl);

            resolve({
                base64: dataUrl.split(',')[1],
                mimeType: 'image/jpeg',
                name: file.name.split('.')[0] + '.jpg'
            });
        };
    });
}


// 💡 입력창만 비우는 함수 (send 함수에서 호출함)
function resetFormOnlyInputs() {
    // 지울 항목들 리스트
    const targetIds = ['work', 'siteSearch', 'materialExtra', 'expAmount', 'expDetail'];
    
    targetIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = ""; // 글자 입력칸 비우기
    });

    // 영수증 파일 칸 비우기
    const receipt = document.getElementById('receipt');
    if (receipt) receipt.value = "";

    // 선택된 칩들(파란색) 전부 해제
    document.querySelectorAll('.chip.active').forEach(chip => {
        chip.classList.remove('active');
    });
    // 💡 추가: 신규 자재 데이터 초기화
    selectedMaterials = {}; 
    const matListContainer = document.getElementById('material-list');
    if (matListContainer) matListContainer.innerHTML = "<p style='text-align: center; color: #94a3b8; font-size: 0.8rem; padding: 20px;'>대분류를 선택하면 자재 목록이 나옵니다.</p>";
}

const dinnerCheck = document.getElementById('dinner-yn');
    if (dinnerCheck) dinnerCheck.checked = false;


// 💡 공유까지 끝난 후 완전 초기화하는 함수
function resetFormFull() {
    resetFormOnlyInputs(); // 일단 입력칸 다 비우고
    
    // 시간만 기본값으로 복구
    const startTime = document.getElementById('start');
    const endTime = document.getElementById('end');
    if (startTime) startTime.value = "08:00";
    if (endTime) endTime.value = "17:00";

    // 날짜는 오늘로 다시 세팅
    const dateEl = document.getElementById('date');
    if (dateEl) dateEl.valueAsDate = new Date();

    // 전송 버튼 원래대로 복구
    const btn = document.getElementById('sBtn');
    if (btn) {
        btn.style.backgroundColor = ""; 
        btn.style.color = ""; 
        btn.innerText = "🚀 저장 및 카톡 공유";
        btn.onclick = send; // 다시 저장 기능으로 연결
        btn.disabled = false;
    }
}



function copyAddr(text) {
    navigator.clipboard.writeText(text);
    alert("복사되었습니다: " + text);
}

// 6. [일정 관리 로직]
async function loadSchedules() {
    const container = document.getElementById('schedule-container');
    container.innerHTML = '<p style="text-align:center;">🔌 서버 연결 중...</p>';

    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getScheduleData' })
        });
        const result = await res.json();
        allSchedules = result.schedules;
        
        const select = document.getElementById('worker-select');
        select.innerHTML = '<option value="전체">👤 전체 보기</option>';
        let workerSet = new Set();
        allSchedules.forEach(s => s.workers.forEach(w => workerSet.add(w)));
        Array.from(workerSet).sort().forEach(w => select.add(new Option(w, w)));
        
        renderView();
    } catch (e) {
        container.innerHTML = '<p style="text-align:center; color:red;">⚠️ 일정 로드 실패</p>';
    }
}

function renderView() {
    const timeline = document.getElementById('timeline-grid');
    if (currentView === 'calendar') {
        if (timeline) timeline.style.display = 'none';
        renderCalendar(); 
    } else {
        if (timeline) timeline.style.display = 'flex';
        renderCards();    
        setTimeout(() => renderTimeline(), 100);
    }
}

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if(id === 'log-page') document.getElementById('tab-log').classList.add('active');
    else {
        document.getElementById('tab-sched').classList.add('active');
        if(allSchedules.length === 0) loadSchedules();
        else renderView();
    }
}

function renderTimeline() {
    const grid = document.getElementById('timeline-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const worker = document.getElementById('worker-select').value;
    
    // 💡 오늘 날짜를 비교하기 위해 이 줄이 반드시 필요합니다.
    const todayStr = new Date().toISOString().split('T')[0]; 

    for (let i = 0; i < 14; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        let dayJobs = allSchedules.filter(j => 
            j.date === dateStr && (worker === "전체" || j.workers.includes(worker))
        );

        const col = document.createElement('div');
        // 💡 여기서 todayStr을 사용합니다.
        col.className = `time-col ${dateStr === todayStr ? 'today' : ''}`;
        col.innerHTML = `
            <div style="font-size:0.75rem; text-align:center; margin-bottom:5px; font-weight:bold;">${dateStr === todayStr ? '🌟' : (date.getMonth()+1)+'/'+date.getDate()}</div>
            <div style="display:flex; flex-direction:column; gap:4px;">
                ${dayJobs.map(j => `<div class="job-bar ${j.shift === '야' ? 'bar-night' : 'bar-day'}" onclick="scrollToCard('${j.date}', '${j.site}')">${j.site}</div>`).join('')}
            </div>
        `;
        grid.appendChild(col);
    }
}

function renderCards() {
    const container = document.getElementById('schedule-container');
    const worker = document.getElementById('worker-select').value;
    const today = new Date().toISOString().split('T')[0];

    const filtered = allSchedules.filter(s => 
        (worker === "전체" || s.workers.includes(worker)) && (showPast ? s.date < today : s.date >= today)
    );

    filtered.sort((a, b) => showPast ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));

    let html = `<button class="past-btn" onclick="togglePast()">${showPast ? '⬆️ 예정 일정' : '⬇️ 지난 일정'}</button>`;
    
    if (filtered.length === 0) html += `<p style="text-align:center; padding:20px;">일정이 없습니다.</p>`;
    else {
        html += filtered.map(s => `
            <div class="card schedule-card-item" data-date="${s.date}" data-site="${s.site}" style="border-left: 5px solid ${s.shift==='야'?'#1e293b':'#2563eb'}; padding:15px; position:relative;">
                <div onclick='copyScheduleToLog(${JSON.stringify(s)})' style="position:absolute; top:10px; right:10px; font-size:1.5rem;">📝</div>
                <div><b>${s.date}</b> (${s.shift})</div>
                <div style="color:#666; font-size:0.9rem;">${s.client}</div>
                <div style="font-size:1.2rem; font-weight:bold;">${s.site}</div>
                <div style="margin-top:5px;">${s.workers.map(w=>`<span class="worker-chip">${w}</span>`).join('')}</div>
                ${s.address ? `<div onclick="copyAddr('${s.address}')" style="margin-top:5px; color:blue; cursor:pointer;">📍 ${s.address}</div>` : ''}
            </div>
        `).join('');
    }
    container.innerHTML = html;
}

function renderCalendar() {
    const container = document.getElementById('schedule-container');
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    
    let html = `<div class="card calendar-card" style="padding:10px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
            <button onclick="changeMonth(-1)">◀</button> <b>${year}.${month+1}</b> <button onclick="changeMonth(1)">▶</button>
        </div>
        <div style="display:grid; grid-template-columns:repeat(7,1fr); gap:1px; background:#ddd;">
            ${['일','월','화','수','목','금','토'].map(d=>`<div style="background:#f8f9fa; text-align:center; font-size:0.8rem; padding:5px;">${d}</div>`).join('')}
    `;
    
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    
    for(let i=0; i<firstDay; i++) html += `<div style="background:white; min-height:80px;"></div>`;
    
    for(let d=1; d<=lastDate; d++) {
        const dStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const jobs = allSchedules.filter(s => s.date === dStr);
        html += `<div style="background:white; min-height:80px; padding:2px; border:1px solid #eee;">
            <span style="font-size:0.8rem; font-weight:bold;">${d}</span>
       ${jobs.map(j => {
                // 💡 인원수 계산 (workers 배열의 길이를 가져옴)
                const workerCount = (j.workers && Array.isArray(j.workers)) ? j.workers.length : 0;
                
                // 💡 표시 텍스트 조립: 현장이름(인원수)
                const displayTitle = `${j.site}(${workerCount})`;

                return `<div onclick="jumpToCard('${j.date}','${j.site}')" 
                             style="background:${j.shift==='야'?'#333':'#007bff'}; color:white; font-size:0.6rem; padding:2px; margin-top:2px; border-radius:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                             ${displayTitle}
                        </div>`;
            }).join('')}
        </div>`;
    }
    html += `</div></div>`;
    container.innerHTML = html;
}

function toggleView() {
    currentView = (currentView === 'list') ? 'calendar' : 'list';
    document.getElementById('view-toggle').innerText = (currentView === 'list') ? '📅' : '📋';
    renderView();
}

function togglePast() { showPast = !showPast; renderView(); }
function changeMonth(v) { viewDate.setMonth(viewDate.getMonth()+v); renderCalendar(); }
function jumpToCard(d, s) { 
    showPast = (d < new Date().toISOString().split('T')[0]);
    currentView = 'list'; 
    document.getElementById('view-toggle').innerText = '📅';
    renderView();
    setTimeout(() => scrollToCard(d, s), 200);
}
function scrollToCard(d, s) {
    const el = document.querySelector(`.schedule-card-item[data-date="${d}"][data-site="${s}"]`);
    if(el) el.scrollIntoView({behavior:'smooth', block:'center'});
}

function copyScheduleToLog(s) {
    if(!confirm("📝 선택한 일정 내용으로 일보 작성을 시작할까요?")) return;

    // 1. 날짜, 현장명, 작업내용 기본 입력
    document.getElementById('date').value = s.date;
    document.getElementById('siteSearch').value = s.site;
    document.getElementById('work').value = s.workContent || "";
    
    // 2. 거래처 칩 먼저 선택 (현장 칩을 불러오기 위함)
    const clientChips = document.querySelectorAll('#client-chips .chip');
    clientChips.forEach(c => { if(c.innerText === s.client) c.click(); });

    // 3. 시간 설정 (주간/야간)
    if(s.shift === '야') {
        document.getElementById('start').value = "18:00";
        document.getElementById('end').value = "05:00";
    } else {
        document.getElementById('start').value = "08:00";
        document.getElementById('end').value = "17:00";
    }

    // 💡 4. 핵심 수리: 0.5초 대기 후 인원/차량/현장 칩 자동 선택
    // (칩들이 화면에 다 그려질 시간을 주는 겁니다)
    setTimeout(() => {
        // [현장 칩 선택]
        const siteInput = document.getElementById('siteSearch');
        if(siteInput) { siteInput.dispatchEvent(new Event('input')); }
        const siteChips = document.querySelectorAll('#site-chips .chip');
        siteChips.forEach(c => {
            if(c.innerText.includes(s.site)) c.classList.add('active');
        });

        // [인원 칩 선택]
        const memChips = document.querySelectorAll('#member-chips .chip');
        memChips.forEach(c => c.classList.remove('active')); // 초기화
        if (s.workers && Array.isArray(s.workers)) {
            s.workers.forEach(w => {
                let found = false;
                memChips.forEach(c => {
                    if(c.innerText === w.trim()) { c.classList.add('active'); found = true; }
                });
                // 목록에 없는 사람이라면 새로 만들어서 선택
                if(!found && w.trim()){
                     addItem('member', w.trim());
                }
            });
        }

        // [차량 칩 선택]
        const carChips = document.querySelectorAll('#car-chips .chip');
        carChips.forEach(c => c.classList.remove('active')); // 초기화
        if(s.car){
            let found = false;
            carChips.forEach(c => {
                if(c.innerText === s.car.trim()){ c.classList.add('active'); found = true; }
            });
            // 목록에 없는 차량이라면 새로 만들어서 선택
            if(!found) addItem('car', s.car.trim());
        }
    }, 500);

    showPage('log-page');
    window.scrollTo(0, 0);
}

// ==========================================
// 3. 자재 관리 시스템 (서버 데이터 & UID 사용)
// ==========================================

let allMaterials = {}; // 서버에서 받아올 객체
let selectedMaterials = {}; // 사용자 선택 저장 (Key: UID)
let currentCategory = "";
let currentSubCategory = "ALL"; // 현재 중분류
let isMatLoaded = false;

// 자재창 열기/닫기
async function toggleMaterialUI() {
    const section = document.getElementById('material-section');
    const btn = document.getElementById('btn-toggle-mat');

    if (section.style.display === 'none') {
        section.style.display = 'block';
        btn.innerText = '창 닫기';

        // 💡 [추가] 검색창 초기화
        const searchInput = document.getElementById('mat-search-input');
        if(searchInput) searchInput.value = "";
        
        // 💡 [추가] 칩 다시 보이기 (혹시 숨겨져 있었다면)
        const subChipContainer = document.getElementById('sub-category-chips');
        if(subChipContainer) subChipContainer.style.display = 'flex';

        
        // 데이터가 없으면 서버에서 로드
        if (!isMatLoaded) {
            await loadMaterialData();
        } else {
            renderCategoryTabs();
        }
    } else {
        section.style.display = 'none';
        btn.innerText = '자재창 열기';
    }
}

// 서버에서 자재 데이터 로드 (fetch)
async function loadMaterialData() {
    const listContainer = document.getElementById('material-list');
    const tabContainer = document.getElementById('category-tabs');

    tabContainer.innerHTML = "<span style='font-size:0.8rem; padding:10px;'>⏳ 분류 로딩 중...</span>";
    listContainer.innerHTML = "<p style='text-align:center; padding:20px;'>⏳ 서버에서 자재 목록을 불러오고 있습니다...</p>";

    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "getMaterialData" })
        });
        
        const text = await res.text();
        allMaterials = JSON.parse(text); // 서버에서 온 { "배관": [...], "전선": [...] }
        
        isMatLoaded = true;
        renderCategoryTabs(); 
        
        document.getElementById('sub-category-chips').innerHTML = 
            "<span style='font-size:0.8rem; color:#94a3b8; padding:5px;'>상단 대분류를 선택하세요.</span>";
        listContainer.innerHTML = "<p style='text-align:center; padding:20px; color:#94a3b8;'>분류를 선택해주세요.</p>";

    } catch (e) {
        console.error(e);
        listContainer.innerHTML = "<p style='text-align:center; color:red;'>⚠️ 데이터 로드 실패. 새로고침 해주세요.</p>";
        tabContainer.innerHTML = "";
    }
}

// 대분류 탭 생성
function renderCategoryTabs() {
    const cats = Object.keys(allMaterials);
    const container = document.getElementById('category-tabs');
    
    if(!container) return;

    container.innerHTML = cats.map(cat => `
        <div class="cat-tab" onclick="filterMaterial('${cat}', this)" 
             style="padding:8px 15px; margin-right:5px; background:#e2e8f0; border-radius:20px; font-weight:bold; white-space:nowrap; cursor:pointer;">
            ${cat}
        </div>
    `).join('');

    // 첫 번째 탭 자동 선택
    if(cats.length > 0 && !currentCategory) {
        const firstTab = container.querySelector('.cat-tab');
        if (firstTab) filterMaterial(cats[0], firstTab);
    }
}

// 대분류 선택 -> 중분류 칩 생성
function filterMaterial(cat, el) {
    currentCategory = cat;
    
    document.querySelectorAll('.cat-tab').forEach(t => { 
        if(t && t.style) { t.style.background = '#e2e8f0'; t.style.color = '#475569'; }
    });

    if(el && el.style) { 
        el.style.background = '#2563eb'; el.style.color = 'white'; 
    }

    if (!allMaterials[cat]) return;

    const items = allMaterials[cat];
    
    // [중요] 중분류 추출 (빈값/undefined는 '기타'로 처리됨)
    // 서버에서 이미 처리가 되어 오지만, 한 번 더 안전장치
    const subCats = [...new Set(items.map(i => i.subCat || "기타"))].sort();
    
    const subContainer = document.getElementById('sub-category-chips');
    
    let html = `<div class="sub-chip active" onclick="filterSubCat('ALL', this)">전체</div>`;
    html += subCats.map(sub => 
        `<div class="sub-chip" onclick="filterSubCat('${sub}', this)">${sub}</div>`
    ).join('');
    
    subContainer.innerHTML = html;
    
    // 전체 리스트 표시
    renderMaterialTable(items);
}

// 📍 [Updated] Filter Sub-Category (Remember state securely!)
function filterSubCat(subCat, el) {
    // 1. Save the currently selected sub-category to variable (Important!)
    currentSubCategory = subCat;

    // 2. If el is missing (called from code), find the chip with matching text
    if (!el) {
        const chips = document.querySelectorAll('.sub-chip');
        chips.forEach(c => {
            if (c.innerText === subCat || (subCat === "ALL" && c.innerText === "All")) el = c;
        });
    }

    // 3. Change chip color
    document.querySelectorAll('.sub-chip').forEach(c => {
        c.classList.remove('active');
        c.style.background = 'white'; c.style.color = '#64748b';
    });
    
    if (el) {
        el.classList.add('active');
        el.style.background = '#2563eb'; el.style.color = 'white'; 
    }

    // 4. Filter list
    const items = allMaterials[currentCategory];
    if (subCat === 'ALL') renderMaterialTable(items);
    else renderMaterialTable(items.filter(i => i.subCat === subCat));
}

// Draw Table (UID based)
function renderMaterialTable(list) {
    const container = document.getElementById('material-list');
    
    let html = `
        <table class="mat-table">
            <colgroup>
                <col style="width: 35%"> 
                <col style="width: 35%"> 
                <col style="width: 30%">
            </colgroup>
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Spec</th>
                    <th>Qty</th>
                </tr>
            </thead>
            <tbody>
    `;

    if (list.length === 0) {
        html += `<tr><td colspan="3" style="text-align:center; padding:20px; color:#94a3b8;">No items found.</td></tr>`;
    }

    list.forEach(m => {
        const currentData = selectedMaterials[m.uid];
        const qty = currentData ? currentData.qty : 0;
        const rowBg = qty > 0 ? 'style="background-color:#eff6ff;"' : ''; 
        const clickEvt = `focusQtyInput('${m.uid}')`;

        html += `
            <tr ${rowBg}>
                <td onclick="${clickEvt}"><span style="font-weight:bold;">${m.name}</span></td>
                <td class="spec-cell" onclick="${clickEvt}">${m.spec}<span class="unit-text">(${m.unit})</span></td>
                <td>
                    <div class="qty-control-box">
                        <input type="number" id="qty-${m.uid}" class="qty-input-box" value="${qty}" 
                               inputmode="numeric" onmousedown="event.stopPropagation();" 
                               ontouchstart="event.stopPropagation();" onclick="event.stopPropagation();" 
                               onfocus="this.select()" oninput="updateQtyDirectly('${m.uid}', this.value)">
                        <div class="qty-btn-col">
                            <button type="button" class="qty-btn-up" onclick="testChangeQty('${m.uid}', 1); event.stopPropagation();">▲</button>
                            <button type="button" class="qty-btn-down" onclick="testChangeQty('${m.uid}', -1); event.stopPropagation();">▼</button>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
}

// Change Quantity (Direct Input)
function updateQtyDirectly(uid, val) {
    const numVal = parseInt(val);
    if (!selectedMaterials[uid]) {
        const item = allMaterials[currentCategory].find(i => i.uid === uid);
        if(item) selectedMaterials[uid] = { ...item, qty: 0, category: currentCategory };
    }
    if (isNaN(numVal) || numVal < 0) selectedMaterials[uid].qty = 0;
    else selectedMaterials[uid].qty = numVal;
}

// Change Quantity (Button)
function testChangeQty(uid, val) {
    if (!selectedMaterials[uid]) {
        const item = allMaterials[currentCategory].find(i => i.uid === uid);
        if(item) {
            selectedMaterials[uid] = { ...item, qty: 0, category: currentCategory };
        }
    }
    
    let newQty = selectedMaterials[uid].qty + val;
    if (newQty < 0) newQty = 0;
    selectedMaterials[uid].qty = newQty;
    
    const input = document.getElementById(`qty-${uid}`);
    if(input) {
        input.value = newQty;
        const row = input.closest('tr');
        if(newQty > 0) row.style.backgroundColor = "#eff6ff";
        else row.style.backgroundColor = "";
    }
}

function focusQtyInput(uid) {
    const input = document.getElementById(`qty-${uid}`);
    if(input) input.focus();
}


// ==========================================
// 📍 [업그레이드] 자재 직접 입력 (팝업창 방식)
// ==========================================

// 1. 팝업창 열기 (기존 addCustomMaterialRow 대체)
function addCustomMaterialRow() {
    if (!currentCategory) return alert("대분류를 먼저 선택해주세요.");

    const modal = document.getElementById('custom-material-modal');
    const catDisplay = document.getElementById('modal-category-display');
    const targetSubCat = (currentSubCategory && currentSubCategory !== "ALL") ? currentSubCategory : "기타";

    // 현재 보고 있는 카테고리 표시
    catDisplay.innerText = `분류: ${currentCategory} > ${targetSubCat}`;
    
    // 입력창 초기화
    document.getElementById('modal-name').value = "";
    document.getElementById('modal-spec').value = "-";
    document.getElementById('modal-unit').value = "개";
    document.getElementById('modal-qty').value = "1";

    // 팝업 보여주기
    modal.style.display = 'flex';
    
    // 품명 입력창에 바로 커서 두기
    setTimeout(() => document.getElementById('modal-name').focus(), 100);
}

// 2. 팝업창 닫기
function closeCustomModal() {
    document.getElementById('custom-material-modal').style.display = 'none';
}

// 3. 추가하기 버튼 눌렀을 때 실행
function confirmCustomMaterial() {
    const name = document.getElementById('modal-name').value.trim();
    const spec = document.getElementById('modal-spec').value.trim();
    const unit = document.getElementById('modal-unit').value.trim();
    const qtyStr = document.getElementById('modal-qty').value;
    const numQty = parseInt(qtyStr);

    if (!name) return alert("품명을 입력해주세요.");
    if (isNaN(numQty) || numQty <= 0) return alert("수량을 확인해주세요.");

    // 보고 있던 중분류 가져오기
    const targetSubCat = (currentSubCategory && currentSubCategory !== "ALL") ? currentSubCategory : "기타";
    const customUid = "CUSTOM_" + Date.now();

    const newItem = {
        uid: customUid,
        category: currentCategory,
        subCat: targetSubCat,
        name: name,
        spec: spec,
        unit: unit,
        price: 0,
        qty: numQty
    };

    // 데이터 저장 (전체 목록 & 선택 목록)
    if (!allMaterials[currentCategory]) allMaterials[currentCategory] = [];
    allMaterials[currentCategory].unshift(newItem); // 맨 앞에 추가
    selectedMaterials[customUid] = newItem;

    // 화면 갱신
    const listContainer = document.getElementById('material-list');
    const scrollPos = listContainer ? listContainer.scrollTop : 0;
    
    filterSubCat(currentSubCategory, null);
    
    if (listContainer) listContainer.scrollTop = scrollPos;

    // 팝업 닫기
    closeCustomModal();
}


// ==========================================
// 🔍 [신규] 자재 전체 검색 기능
// ==========================================
function searchMaterial(keyword) {
    if (!allMaterials) return; // 데이터 로드 전이면 중단

    const val = keyword.trim().toLowerCase();
    const subChipContainer = document.getElementById('sub-category-chips');
    const listContainer = document.getElementById('material-list');
    
    // 1. 검색어가 비어있을 때 -> 원래 카테고리 화면으로 복구
    if (val === "") {
        subChipContainer.style.display = 'flex'; 
        if (currentCategory) {
            filterSubCat(currentSubCategory, null);
        } else {
            listContainer.innerHTML = "<p style='text-align: center; color: #94a3b8; padding: 20px;'>분류를 선택하세요.</p>";
        }
        return;
    }

    // 2. 검색 중에는 중분류 칩 숨기기
    subChipContainer.style.display = 'none';

    let searchResults = [];

    // 3. 모든 대분류를 순회하며 검색 (중요: 여기서 누락되는 데이터가 없도록 함)
    Object.keys(allMaterials).forEach(catName => {
        const items = allMaterials[catName];
        if (Array.isArray(items)) {
            items.forEach(item => {
                const nameMatch = item.name && item.name.toLowerCase().includes(val);
                const specMatch = item.spec && item.spec.toLowerCase().includes(val);
                const subMatch = item.subCat && item.subCat.toLowerCase().includes(val);

                if (nameMatch || specMatch || subMatch) {
                    // 검색 결과임을 알 수 있도록 대분류 정보를 살짝 추가해서 넘김
                    searchResults.push({ ...item, category: catName });
                }
            });
        }
    });

    // 4. 결과 테이블 그리기
    if (searchResults.length > 0) {
        renderMaterialTable(searchResults);
    } else {
        listContainer.innerHTML = `
            <div style="text-align:center; padding:30px; color:#64748b;">
                <p>'${keyword}'에 대한 검색 결과가 없습니다.</p>
                    </div>
        `;
    }
}


function renderAdminWorkerList(workers) {
  const container = document.getElementById('admin-worker-list');
  if (!container) return;

  container.innerHTML = workers.map(w => {
    // 💡 [핵심] 복사할 텍스트를 "이름 + 데이터" 형태로 미리 조립합니다.
    const phoneToCopy = `${w.name} ${w.phone || '번호없음'}`;
    const addressToCopy = `${w.name} ${w.address || '주소없음'}`;

    return `
      <div class="admin-card" style="border-bottom:1px solid #eee; padding:10px 0;">
        <div style="font-weight:bold;">${w.name} <small>(${w.role})</small></div>
        
        <div style="font-size:0.9rem; margin-top:5px; color:#555;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
            <span>📱 ${w.phone || '미등록'}</span>
            <button onclick="copyToClipboard('${phoneToCopy}')" style="padding:2px 8px; font-size:0.75rem;">복사</button>
          </div>
          
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.8rem;">🏠 ${w.address || '미등록'}</span>
            <button onclick="copyToClipboard('${addressWithName}')" style="padding:2px 8px; font-size:0.75rem;">복사</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}
