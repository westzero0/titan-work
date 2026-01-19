// 1. ✅ 여기에 본인의 구글 웹 앱 URL을 붙여넣으세요!
const GAS_URL = "https://script.google.com/macros/s/AKfycbyg8uyAvpBZcBLVLYKzH_-5wvBlqjH5Cziz8LQR9zrLYD--mYFUgM0mC0fnNeh_c6dm/exec"; 

// 2. 직원 명단 설정
const staff = ["기원", "창재", "조환", "서호"]; 

// 3. 화면이 로드될 때 실행되는 초기화 작업
document.addEventListener('DOMContentLoaded', () => {
    // 인원 칩 생성 로직
    const box = document.getElementById('member-chips');
    if (box) {
        staff.forEach(name => {
            const div = document.createElement('div');
            div.className = 'chip';
            div.innerText = name;
            // 클릭 시 활성화/비활성화 토글
            div.onclick = () => div.classList.toggle('active');
            box.appendChild(div);
        });
    }

    // 오늘 날짜 자동 설정
    const dateInput = document.getElementById('date');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }
});

/**
 * 4. 데이터를 구글 시트로 전송하고 저장하는 함수
 */
async function send() {
    const btn = document.getElementById('sBtn');
    const siteInput = document.getElementById('site');

    // 필수 입력 체크
    if (!siteInput.value) {
        alert("현장명을 입력해주세요!");
        return;
    }

    btn.disabled = true;
    btn.innerText = "저장 중...";

    // 활성화된 인원 칩 찾기
    const selectedMembers = Array.from(document.querySelectorAll('.chip.active'))
                                .map(c => c.innerText)
                                .join(', ');

    const payload = {
        action: "saveLog",
        data: {
            date: document.getElementById('date').value,
            site: siteInput.value,
            client: document.getElementById('client').value || "",
            work: document.getElementById('work').value || "",
            start: document.getElementById('start').value,
            end: document.getElementById('end').value,
            members: selectedMembers,
            dinner: document.getElementById('dinner').value,
            materials: document.getElementById('materials').value || "",
            expense_amt: document.getElementById('exp_amt').value || 0,
            expense_txt: document.getElementById('exp_txt').value || "",
            receipt_url: "" // 영수증 업로드 로직 추가 시 여기에 URL 삽입
        }
    };

    try {
        // 🟢 fetch를 사용하여 구글 시트 API와 통신
        const response = await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        const result = await response.text();
        
        if (result === "SUCCESS") {
            alert("✅ 저장 완료! 구글 시트를 확인하세요.");
            // 카카오톡 공유 등 후속 작업 가능
        } else {
            alert("❌ 저장 실패: " + result);
        }
    } catch (err) {
        console.error(err);
        alert("⚠️ 연결 오류: 웹앱 URL이나 권한 설정을 확인하세요.");
    } finally {
        btn.disabled = false;
        btn.innerText = "🚀 저장 및 카톡 공유";
    }
}

// 버튼 클릭 이벤트 연결
document.getElementById('sBtn').onclick = send;