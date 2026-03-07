const APP_VERSION = "2.0"; // 👈 기능 수정할 때마다 이 숫자를 1.6, 1.7로 올리세요!

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



const GAS_URL = "https://script.google.com/macros/s/AKfycbw1uZmBvRnbuR9Dgv2a0qu9Ko2kzYi3QWoaK4E-qiNrwPsy3JbP8gf90zYBAzX4J628/exec";

var globalTitanData = globalTitanData || {}; // 👈 변수가 없으면 빈 박스라도 만들어라!


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
    car: ["봉고", "스타렉스", "스타리아"],
    material: ["2.5sq 전선", "4sq 전선", "CD관", "난연관", "복스"],
    payer: ["서영", "기원", "조환"]
};

function saveListsToStorage() {
    localStorage.setItem('titan_custom_lists', JSON.stringify(lists));
}

// 📝 아이콘 클릭 시 데이터를 안전하게 해독해서 일보 작성으로 넘겨주는 다리 함수
function copyScheduleToLogSafe(safeData) {
    try {
        // Base64로 암호화된 데이터를 다시 풀어서 JSON 객체로 만듭니다.
        const s = JSON.parse(decodeURIComponent(atob(safeData)));
        copyScheduleToLog(s); // 실제 일보 작성 로직 실행
    } catch (e) {
        console.error("데이터 복구 에러:", e);
        alert("일정 정보를 불러오지 못했습니다.");
    }
}

async function loadTitanDataWithBackgroundSync() {
    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getTitanData' })
        });
        const rawData = await res.json();
        const fullData = rawData.titanData || rawData.result || rawData;

        if (fullData && typeof fullData === 'object') {
            // 🔴 [수정] 박스 이름을 'window.globalTitanData'로 통일해서 어디서든 보이게 함
            window.globalTitanData = fullData; 
            localStorage.setItem('titan_full_data_cache', JSON.stringify(fullData));
            
            console.log("📍 주소 박스 채우기 완료. 현재 들어있는 거래처:", Object.keys(window.globalTitanData));


            // 🔴 [복구 완료] 일보 작성 탭에 거래처 버튼(칩)을 화면에 뿌려줍니다!
            const clientNames = Object.keys(fullData).filter(k => !['status','message','result'].includes(k));
            if (typeof renderClientChips === 'function') renderClientChips(clientNames);

            
            // 🔴 박스가 채워졌으니 즉시 화면을 다시 그립니다.
            if (typeof renderCards === 'function') renderCards();
        }
    } catch (e) {
        console.log("연결 실패: 캐시 사용");
        const cached = localStorage.getItem('titan_full_data_cache');
        if (cached) window.globalTitanData = JSON.parse(cached);
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
        alert("✅ 저장되었습니다!\n아래 [카톡 공유] 버튼을 눌러주세요.");

            // ★★★ 핵심: 버튼 잠금 해제 (이거 없으면 클릭 안됨) ★★★
            btn.disabled = false;

            
            // 카톡 공유 메시지 만들기
         let msg = `⚡ [타이탄 작업일보]\n`;
            msg += `📅 날짜: ${payload.data.date}\n`;
            msg += `🏢 거래처: ${client}\n`;
            msg += `🏗️ 현장명: ${site}\n`;
            msg += `🛠️ 작업내용: ${work}\n`;
            msg += `⏰ 시간: ${payload.data.start} ~ ${payload.data.end}\n`;
            msg += `👥 인원: ${payload.data.members}\n`;
            msg += `🚗 차량: ${payload.data.car || "없음"}\n`;
            msg += `🍱 석식: ${dinnerValue}\n`; // X면 X라고 나옵니다
            msg += `📦 자재: ${finalMaterialString}`;
            
            // 경비가 있을 때만 표시
            if(payload.data.expAmount > 0) {
                 msg += `\n💰 경비: ${Number(payload.data.expAmount).toLocaleString()}원 (${payload.data.expDetail}/${payload.data.expPayer})`;
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
        alert("🚨 실패: " + e.message);
        btn.innerText = "🚀 다시 시도";
        btn.disabled = false; // 에러나면 버튼 다시 풀어줘야 함
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

async function loadSchedules() {
    const container = document.getElementById('schedule-container');
    container.innerHTML = '<p style="text-align:center; padding:20px;">🔌 서버 연결 중...</p>';

    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getScheduleList' }) // 또는 'getScheduleData'
        });

        const result = await res.json();
        
        // 🔴 [수정] 서버가 주는 모양이 배열이면 그대로 사용합니다.
        allSchedules = Array.isArray(result) ? result : (result.schedules || []);

        const select = document.getElementById('worker-select');
        select.innerHTML = '<option value="전체">👤 전체 보기</option>';
        let workerSet = new Set();
        
        allSchedules.forEach(s => {
            // workers가 배열일 수도, 문자열일 수도 있어서 안전하게 처리
            const wList = Array.isArray(s.workers) ? s.workers : (s.workers || "").split(',');
            wList.forEach(w => { if(w.trim()) workerSet.add(w.trim()); });
        });
        
        Array.from(workerSet).sort().forEach(w => select.add(new Option(w, w)));
        renderView();

    } catch (e) {
        console.error("로드 에러:", e);
        container.innerHTML = '<p style="text-align:center; color:red; padding:20px;">⚠️ 일정 로드 실패</p>';
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
    
    const todayStr = new Date().toISOString().split('T')[0]; 

    for (let i = 0; i < 14; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        // 해당 날짜의 일정 필터링
        let dayJobs = allSchedules.filter(j => 
            j.date === dateStr && (worker === "전체" || (j.workers && j.workers.includes(worker)))
        );

        const col = document.createElement('div');
        col.className = `time-col ${dateStr === todayStr ? 'today' : ''}`;
        col.innerHTML = `
            <div style="font-size:0.75rem; text-align:center; margin-bottom:5px; font-weight:bold;">${dateStr === todayStr ? '🌟' : (date.getMonth()+1)+'/'+date.getDate()}</div>
            <div style="display:flex; flex-direction:column; gap:4px;">
                ${dayJobs.map(j => {
                    // 🔴 1. 인원수 계산 (쉼표로 쪼개서 정확히 카운트)
                    const wCount = (j.workers || "").toString().split(',').filter(n => n.trim() !== "").length;
                    const displayTitle = `${j.site}(${wCount})`;

                    // 🔴 2. 주/야 색상 판별
                    const isNight = (j.shift || "").toString().includes('야');
                    const bgColor = isNight ? '#475569' : '#2563eb';

                    // 🔴 3. 줄바꿈 및 흰색 글씨 적용
                    return `<div class="job-bar" 
                                 onclick="scrollToCard('${j.date}', '${j.site}')"
                                 style="background-color: ${bgColor}; 
                                        color: white !important; 
                                        font-weight: bold; 
                                        font-size: 0.65rem; 
                                        padding: 4px 2px; 
                                        border-radius: 4px; 
                                        text-align: center;
                                        white-space: normal;    /* 👈 줄바꿈 허용 */
                                        word-break: break-all;  /* 👈 좁으면 글자단위로 쪼갬 */
                                        line-height: 1.1;       /* 👈 줄간격 좁게 */
                                        min-height: 1.5rem;     /* 👈 최소 높이 확보 */
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        cursor: pointer;">
                                 ${displayTitle}
                            </div>`;
                }).join('')}
            </div>
        `;
        grid.appendChild(col);
    }
}

// 🔴 [복구] 작업일보 전용 달력 렌더링 함수
function renderCalendar() {
    const container = document.getElementById('schedule-container');
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    // 🔴 [추가] 오늘 날짜 구하기 (한국 시간 기준 정확한 날짜)
    const now = new Date();
    const todayStrLocal = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

    
    // 현재 필터링된 직원 선택값
    const selectedWorker = document.getElementById('worker-select').value;
    
    let html = `<div class="card calendar-card" style="padding:10px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
            <button onclick="changeMonth(-1)">◀</button> <b>${year}.${month+1}</b> <button onclick="changeMonth(1)">▶</button>
        </div>
        <div style="display:grid; grid-template-columns:repeat(7, minmax(0, 1fr)); gap:1px; background:#ddd;">
            ${['일','월','화','수','목','금','토'].map(d=>`<div style="background:#f8f9fa; text-align:center; font-size:0.8rem; padding:5px;">${d}</div>`).join('')}
    `;
    
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    
    for(let i=0; i<firstDay; i++) html += `<div style="background:white; min-height:80px;"></div>`;
    
    for(let d=1; d<=lastDate; d++) {
        const dStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        
   // 🔴 [추가] 오늘 날짜 문자열 만들기 (yyyy-MM-dd)
        const now = new Date();
        const todayStrLocal = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

        // 날짜와 직원에 맞는 일정 필터링
        const jobs = allSchedules.filter(s => {
            const isSameDate = s.date === dStr;
            const isWorkerMatched = (selectedWorker === "전체" || (s.workers && s.workers.includes(selectedWorker)));
            return isSameDate && isWorkerMatched;
        });
        
        // 🔴 [핵심] 오늘 날짜인지 확인해서 배경색/동그라미 스타일 세팅
        const isToday = (dStr === todayStrLocal);
        const cellBg = isToday ? '#eff6ff' : 'white'; // 오늘이면 연한 파란색 배경
        const dateStyle = isToday 
            ? 'font-size:0.8rem; font-weight:bold; background:#2563eb; color:white; border-radius:50%; display:inline-block; width:22px; height:22px; text-align:center; line-height:22px;' 
            : 'font-size:0.8rem; font-weight:bold;';

        // ⬇️ 아래 일정 블록(jobs.map)은 대표님 코드 100% 그대로입니다! ⬇️
        html += `<div class="calendar-day-cell" style="background:${cellBg}; min-height:80px; padding:2px; border:1px solid #eee;">
            <span style="${dateStyle}">${d}</span>
            ${jobs.map(j => {
                // 인원수 계산 (글자 쪼개서 숫자 세기)
                const workerCount = (j.workers || "").toString().split(',').filter(n => n.trim() !== "").length;
                
                // 🔴 [색상] 1글자 주/야/조 완벽 대응
                const sType = (j.shift || "").toString().trim();
                let bgColor = '#2563eb'; // 기본 주간 (파란색)
                if (sType === '야') bgColor = '#475569'; // 야간 (진회색)
                else if (sType === '조') bgColor = '#f59e0b'; // 조출 (주황색)

                // 🔴 [줄바꿈] white-space: normal 로 설정해서 아래로 내려가게 함
                return `<div onclick="jumpToCard('${j.date}','${j.site}')" 
                             style="background:${bgColor}; color:white !important; font-size:0.65rem; line-height:1.2; padding:3px; margin-top:2px; border-radius:3px; 
                                    white-space:normal; word-break:keep-all; cursor:pointer; font-weight:bold;">
                             ${j.site}(${workerCount})
                        </div>`;
            }).join('')}
        </div>`;
    }
    html += `</div></div>`;
    container.innerHTML = html;
}

function renderCards() {
    const container = document.getElementById('schedule-container');
    if (!container) return;

    const worker = document.getElementById('worker-select').value;
    const today = new Date().toISOString().split('T')[0];
    
    // 관리자 패널과 동일한 데이터 주머니 사용
    const masterData = window.globalTitanData || JSON.parse(localStorage.getItem('titan_full_data_cache') || "{}");

    const filtered = allSchedules.filter(s => {
        const wList = (s.workers || "").toString().split(',').map(name => name.trim());
        return (worker === "전체" || wList.includes(worker)) && (showPast ? s.date < today : s.date >= today);
    });

    filtered.sort((a, b) => showPast ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));

    let html = `<button class="past-btn" onclick="togglePast()">${showPast ? '⬆️ 예정 일정' : '⬇️ 지난 일정'}</button>`;
    
    if (filtered.length === 0) {
        html += `<p style="text-align:center; padding:20px;">일정이 없습니다.</p>`;
    } else {

        // 1. 요일 배열 만들기
const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
        
        html += filtered.map(s => {
const dateObj = new Date(s.date);
    const dayName = weekDays[dateObj.getDay()];
            
            let siteAddr = "";
            let siteNote = ""; // 👈 1. 현장 고정 특이사항(E열) 변수 추가

            let dayColor = "#64748b"; // 기본 회색
    if (dateObj.getDay() === 0) dayColor = "#ef4444"; // 일요일
    if (dateObj.getDay() === 6) dayColor = "#3b82f6"; // 토요일

            
            const clientName = (s.client || "").toString().trim();
            const siteName = (s.site || "").toString().trim();
            
            let clientKey = Object.keys(masterData).find(k => k.trim() === clientName || clientName.includes(k.trim()));

            if (clientKey && masterData[clientKey]) {
                const found = masterData[clientKey].find(item => (item.name || "").toString().trim() === siteName);
                if (found) {
                    // 주소 찾기 로직
                    const allKeys = Object.keys(found);
                    const addrKey = allKeys.find(k => k.trim().includes('주소') || k.toLowerCase().includes('addr'));
                    if (addrKey) siteAddr = found[addrKey];
                    
                    // 👈 2. [추가] 고정 특이사항 데이터 꺼내기 (E열)
                    siteNote = found.note || found.특이사항 || found.비고 || "";
                }
            }

            const safeData = btoa(encodeURIComponent(JSON.stringify({ ...s, foundAddr: siteAddr })));
            const sType = (s.shift || "").toString().trim();
            const borderColor = sType.includes('야') ? '#475569' : (sType.includes('조') ? '#f59e0b' : '#2563eb');

            const hasMaterials = s.materials && s.materials.trim() !== "";

            

       return `
    <div class="card schedule-card-item" 
         data-date="${s.date}" data-site="${s.site}" 
         style="position:relative; margin-bottom:15px; padding:15px; border-left:5px solid ${borderColor}; background:white; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.05);"> 

         <div onclick="openMaterialCheckModal('${safeData}')" 
             style="position:absolute; top:12px; right:60px; font-size:1.4rem; cursor:pointer; 
                    background:${hasMaterials ? '#ecfdf5' : '#f8fafc'}; 
                    width:42px; height:42px; display:flex; align-items:center; justify-content:center; 
                    border-radius:50%; border:1px solid ${hasMaterials ? '#10b981' : '#e2e8f0'}; z-index:5;">
            📦${hasMaterials ? '<span style="position:absolute; top:-2px; right:-2px; font-size:0.7rem;">✅</span>' : ''}
        </div>
                    <div onclick="copyScheduleToLogSafe('${safeData}')" 
                         style="position:absolute; top:12px; right:12px; font-size:1.4rem; cursor:pointer; background:#f8fafc; width:42px; height:42px; display:flex; align-items:center; justify-content:center; border-radius:50%; border:1px solid #e2e8f0; z-index:5;">📝</div>

              
                    
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                        <div style="width: calc(100% - 50px);">
                           <div style="font-weight:bold; font-size:0.85rem; color:#64748b;">
                    📅 ${s.date} <span style="color:${dayColor}">(${dayName})</span> (${sType || '주간'})
                </div>
                            <div style="font-size:1.15rem; font-weight:800; color:#1e293b; margin:2px 0;">${s.site}</div>
                            <div style="font-size:0.85rem; color:#64748b;">🏢 ${s.client}</div>
                            
                            ${siteAddr ? `
                            <div class="site-addr-box" onclick="event.stopPropagation(); copyAddr('${siteAddr.replace(/'/g, "\\'")}')" 
                                 style="margin-top:10px; color:#2563eb; font-size:0.85rem; cursor:pointer; background:#eff6ff; padding:8px 12px; border-radius:8px; border:1px solid #dbeafe; font-weight:500; display:block; width:fit-content; line-height:1.4;">
                                📍 ${siteAddr} <span style="font-size:0.7rem; color:#94a3b8; margin-left:5px;">(복사)</span>
                            </div>` : `<div style="font-size:0.75rem; color:#94a3b8; margin-top:8px; background:#f8fafc; padding:4px 8px; border-radius:4px; display:block; width:fit-content;">📍 주소 정보 없음</div>`}
                        </div>
                    </div>

                    ${siteNote ? `
                    <div style="background:#fef3c7; padding:10px 12px; border-radius:10px; font-size:0.85rem; color:#92400e; border:1px solid #fde68a; margin-top:10px; line-height:1.5;">
                        📢 <b>현장 안내:</b> ${siteNote}
                    </div>` : ''}

                    <div style="background:#f1f5f9; padding:10px 12px; border-radius:10px; font-size:0.9rem; color:#1e40af; font-weight:bold; margin-top:12px; margin-bottom:${s.note ? '8px' : '12px'}; border:1px solid #e2e8f0;">
                        🛠️ ${s.content || s.workContent || '작업내용 없음'}
                    </div>

                    ${s.note ? `
                    <div style="background:#fffbeb; padding:10px 12px; border-radius:10px; font-size:0.85rem; color:#b45309; border:1px solid #fef3c7; margin-bottom:12px; line-height:1.4;">
                        💡 <b>전달 사항:</b> ${s.note}
                    </div>` : ''}

                 

                    <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                        <div style="display:flex; flex-wrap:wrap; gap:6px; flex:1;">
                            ${(s.workers || "").toString().split(',').filter(n => n.trim() !== "").map(w => 
                                `<span style="background:#fff; border:1px solid #cbd5e1; padding:3px 10px; border-radius:15px; font-size:0.8rem; color:#334155;">${w.trim()}</span>`
                            ).join('')}
                        </div>
                        
                        ${s.car ? `
                        <div style="font-size:0.9rem; font-weight:bold; color:#1e293b; background:#f8fafc; padding:5px 12px; border-radius:8px; border:1px solid #e2e8f0; white-space: nowrap; margin-left: 10px;">
                            🚛 ${s.car}
                        </div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }
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
    const today = new Date().toISOString().split('T')[0];
    const isTargetPast = (d < today);

    // 1. 만약 찾으려는 날짜가 현재 보고 있는 리스트 모드(showPast)와 다르면 모드 변경
    if (showPast !== isTargetPast) {
        showPast = isTargetPast;
        renderView(); // 리스트 새로 그리기 (지난 ↔ 예정)
    }

    // 2. 리스트가 그려질 시간을 0.1초 주고 해당 위치로 점프!
    setTimeout(() => {
        const el = document.querySelector(`.schedule-card-item[data-date="${d}"][data-site="${s}"]`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // 💡 센스: 찾은 카드를 1초간 노란색으로 반짝여서 알려주기
            el.style.transition = "background 0.5s";
            el.style.backgroundColor = "#fffde7"; 
            setTimeout(() => { el.style.backgroundColor = "white"; }, 1000);
        } else {
            console.warn("해당 카드를 찾을 수 없습니다:", d, s);
        }
    }, 100);
}

function copyScheduleToLog(s) {
    if(!confirm("📝 선택한 일정 내용으로 일보 작성을 시작할까요?")) return;

    // 1. 기본 정보 입력
    document.getElementById('date').value = s.date;
    document.getElementById('siteSearch').value = s.site;
    
    // 작업내용 입력 (content 또는 workContent 모두 대응)
    const workInput = document.getElementById('work');
    if(workInput) workInput.value = s.content || s.workContent || "";

    // 2. 거래처 칩 강제 클릭 (현장 칩을 불러오기 위함)
    const clientChips = document.querySelectorAll('#client-chips .chip');
    clientChips.forEach(c => { 
        if(c.innerText.trim() === s.client.trim()) c.click(); 
    });

    // 3. 주간/야간 시간 자동 세팅
    if(s.shift === '야' || s.shift === '야간') {
        document.getElementById('start').value = "18:00";
        document.getElementById('end').value = "05:00";
    } else {
        document.getElementById('start').value = "08:00";
        document.getElementById('end').value = "17:00";
    }

    // 4. 🔴 [핵심 수리] 인원 및 차량 칩 자동 선택 (0.5초 대기 후 실행)
    setTimeout(() => {
        // [인원 데이터 정리] 글자로 오든 배열로 오든 무조건 명단(배열)으로 만듦
        const workerArray = Array.isArray(s.workers) ? s.workers : (s.workers || "").split(',').map(w => w.trim()).filter(x => x);
        
        // 모든 인원 칩 초기화 후 다시 선택
        const memChips = document.querySelectorAll('#member-chips .chip');
        memChips.forEach(c => c.classList.remove('active'));

        workerArray.forEach(workerName => {
            let found = false;
            memChips.forEach(chip => {
                if(chip.innerText.trim() === workerName) {
                    chip.classList.add('active');
                    found = true;
                }
            });
            // 만약 칩 목록에 없는 사람이라면 새로 만들어서 선택함
            if(!found) addItem('member', workerName);
        });

        // [차량 칩 선택]
        const carArray = (s.car || "").split(',').map(c => c.trim()).filter(x => x);
        const carChips = document.querySelectorAll('#car-chips .chip');
        carChips.forEach(c => c.classList.remove('active'));

        carArray.forEach(carName => {
            let found = false;
            carChips.forEach(chip => {
                if(chip.innerText.trim() === carName) {
                    chip.classList.add('active');
                    found = true;
                }
            });
            if(!found) addItem('car', carName);
        });

        // [현장 칩 선택 강조]
        const siteChips = document.querySelectorAll('#site-chips .chip');
        siteChips.forEach(c => {
            if(c.innerText.includes(s.site)) c.classList.add('active');
        });

    }, 500); // 칩이 그려질 시간을 0.5초 줍니다.

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


let currentEditItem = null; // 현재 선택된 일정 데이터를 담을 변수

// [1. 자재 모달 열기]
function openMaterialCheckModal(safeData) {
    const s = JSON.parse(decodeURIComponent(atob(safeData)));
    currentEditItem = s; 

    // 1. 일단 상자를 찾아봅니다.
    let modal = document.getElementById('mat-check-modal');

    // 2. [강력한 보강] 만약 상자가 없으면? 자바스크립트가 직접 HTML을 생성합니다!
    if (!modal) {
        console.warn("HTML에서 모달을 못 찾아서 직접 생성합니다.");
        modal = document.createElement('div');
        modal.id = 'mat-check-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h3 id="mat-modal-title" style="margin:0;">📦 자재 체크리스트</h3>
                    <span onclick="closeMatModal()" style="cursor:pointer; font-size:1.5rem;">&times;</span>
                </div>
                <div id="mat-modal-body"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // 3. 내용물을 채우고 화면에 띄웁니다.
    showMatChecklist();
    modal.style.display = 'flex';
}

// [2. 모드 1: 체크리스트 화면 (기존 서식 유지)]
function showMatChecklist() {
    const body = document.getElementById('mat-modal-body');
    if (!body) return;

    const mats = (currentEditItem.materials || "").split(',').filter(m => m.trim() !== "");

    body.innerHTML = `
        <div style="max-height:300px; overflow-y:auto; margin-bottom:20px; border:1px solid #f1f5f9; border-radius:10px;">
            ${mats.length > 0 ? mats.map((m, idx) => `
                <div onclick="this.querySelector('input').click()" 
                     style="display:flex; align-items:center; gap:12px; padding:15px; border-bottom:1px solid #f1f5f9; cursor:pointer; background:white;">
                    <input type="checkbox" id="chk-${idx}" style="width:20px; height:20px; cursor:pointer;" onclick="event.stopPropagation()">
                    <label style="font-size:1.05rem; color:#1e293b; cursor:pointer;">${m.trim()}</label>
                </div>
            `).join('') : '<p style="text-align:center; color:#94a3b8; padding:40px; background:#f8fafc;">등록된 자재가 없습니다.<br><small>수정 버튼을 눌러 입력하세요.</small></p>'}
        </div>
        <div style="display:flex; gap:10px;">
            <button onclick="showMatInput()" style="background:#f1f5f9; color:#475569; border:1px solid #ddd; flex:1; height:48px; border-radius:10px; font-weight:bold;">✏️ 목록 수정</button>
            <button onclick="closeMatModal()" style="background:#2563eb; color:white; flex:1; height:48px; border-radius:10px; font-weight:bold;">닫기</button>
        </div>
    `;
}

// [3. 모드 2: 자재 입력/수정 화면 (기존 서식 유지)]
function showMatInput() {
    const body = document.getElementById('mat-modal-body');
    body.innerHTML = `
        <p style="font-size:0.85rem; color:#64748b; margin-bottom:10px;">자재명을 쉼표(,)로 구분해서 적어주세요.</p>
        <textarea id="mat-edit-area" 
                  style="width:100%; height:160px; padding:15px; border:1px solid #ddd; border-radius:12px; font-size:1rem; box-sizing:border-box; line-height:1.5; outline:none; border-color:#2563eb;">${currentEditItem.materials || ""}</textarea>
        <div style="display:flex; gap:10px; margin-top:20px;">
            <button onclick="showMatChecklist()" style="flex:1; background:#94a3b8; color:white; height:48px; border-radius:10px;">취소</button>
            <button onclick="submitMaterialUpdate()" style="flex:2; background:#2563eb; color:white; height:48px; border-radius:10px; font-weight:bold;">저장하기</button>
        </div>
    `;
    document.getElementById('mat-edit-area').focus(); // 바로 입력 가능하게 커서 이동
}

// [4. 서버로 데이터 전송]
async function submitMaterialUpdate() {
    const newVal = document.getElementById('mat-edit-area').value;
    const btn = event.target;
    
    if (!currentEditItem || !currentEditItem.rowId) {
        alert("일정 정보를 찾을 수 없습니다.");
        return;
    }

    btn.disabled = true;
    btn.innerText = "⏳ 저장 중...";

    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'updateScheduleMaterials',
                rowId: currentEditItem.rowId,
                materials: newVal
            })
        });
        
        const result = await res.json();
        
        if (result.status === 'SUCCESS') {
            // 🔴 [핵심] 새로고침 대신 로컬 데이터를 즉시 업데이트합니다.
            // 1. 전체 데이터(allSchedules)에서 현재 수정 중인 항목을 찾아 자재 내용 갱신
            const targetIdx = allSchedules.findIndex(s => s.rowId === currentEditItem.rowId);
            if (targetIdx !== -1) {
                allSchedules[targetIdx].materials = newVal;
            }

            // 2. 팝업 닫기
            closeMatModal();
            
            // 3. 카드 화면만 다시 그리기 (선택된 직원/날짜 필터 유지됨)
            renderCards(); 
            
            alert("✅ 자재 정보가 저장되었습니다.");
        } else {
            alert("❌ 저장 실패: " + result.message);
            btn.disabled = false;
            btn.innerText = "저장하기";
        }
    } catch (e) {
        alert("🚨 통신 에러가 발생했습니다.");
        btn.disabled = false;
        btn.innerText = "저장하기";
    }
}

// [5. 모달 닫기]
function closeMatModal() {
    const modal = document.getElementById('mat-check-modal');
    if (modal) modal.style.display = 'none';
}
