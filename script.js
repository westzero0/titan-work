// 1. ✅ 구글 웹 앱 URL (사용자 제공 주소 유지)
const GAS_URL = "https://script.google.com/macros/s/AKfycbyg8uyAvpBZcBLVLYKzH_-5wvBlqjH5Cziz8LQR9zrLYD--mYFUgM0mC0fnNeh_c6dm/exec"; 

// 2. 인원 명단
const staff = ["기원", "창재", "비비", "서호"]; 

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    const box = document.getElementById('member-chips');
    staff.forEach(name => {
        const div = document.createElement('div');
        div.className = 'chip';
        div.innerText = name;
        div.onclick = () => div.classList.toggle('active');
        box.appendChild(div);
    });
    // 오늘 날짜 기본 설정
    document.getElementById('date').valueAsDate = new Date();
});

// 📱 스마트폰 통합 공유 함수 (카톡 포함)
async function shareContent(data) {
    const message = `[타이탄 일보]\n📅 날짜: ${data.date}\n🏗️ 현장: ${data.site}\n🛠️ 작업: ${data.work}\n⏰ 시간: ${data.start} ~ ${data.end}\n👥 인원: ${data.members}\n🍱 석식: ${data.dinner}`;

    if (navigator.share) {
        try {
            await navigator.share({
                title: '타이탄 업무일보',
                text: message,
            });
        } catch (err) {
            console.log('공유 취소 또는 에러:', err);
        }
    } else {
        // PC 환경 등 Share API 미지원 시 클립보드 복사
        copyToClipboard(message);
    }
}

// 클립보드 복사 보조 함수
function copyToClipboard(text) {
    const t = document.createElement("textarea");
    document.body.appendChild(t);
    t.value = text;
    t.select();
    document.execCommand('copy');
    document.body.removeChild(t);
    alert("공유 기능이 지원되지 않는 환경입니다.\n내용이 복사되었습니다. 카톡에 붙여넣기 해주세요!");
}

// 🚀 데이터 전송 메인 함수
async function send() {
    const btn = document.getElementById('sBtn');
    const site = document.getElementById('site').value;
    const work = document.getElementById('work').value || "내용 없음";
    const start = document.getElementById('start').value;
    const end = document.getElementById('end').value;
    const dinner = document.getElementById('dinner').value;
    const date = document.getElementById('date').value;
    
    // 선택된 인원 추출
    const selected = Array.from(document.querySelectorAll('.chip.active'))
                          .map(c => c.innerText)
                          .join(', ');

    // 필수 항목 체크
    if (!site) return alert("🏗️ 현장명을 입력해주세요!");
    if (!selected) return alert("👥 작업 인원을 선택해주세요!");

    btn.disabled = true;
    btn.innerText = "⏳ 시트 저장 중...";

    const payload = {
        action: "saveLog",
        data: {
            date: date,
            site: site,
            work: work,
            start: start,
            end: end,
            members: selected,
            dinner: dinner
        }
    };

    try {
        // 1. 구글 시트로 전송 (POST)
        const response = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        const result = await response.text();
        
        if (result === "SUCCESS") {
            // 2. 저장 성공 시 공유창 띄우기
            alert("✅ 시트 저장 완료!");
            await shareContent(payload.data);
            
            // 전송 후 입력창 초기화 (선택사항)
            // location.reload(); 
        } else {
            alert("❌ 저장 실패 (GAS 오류): " + result);
        }
    } catch (e) {
        console.error(e);
        alert("⚠️ 연결 오류! 구글 웹앱 설정을 확인하세요.");
    } finally {
        btn.disabled = false;
        btn.innerText = "🚀 저장 및 카톡 공유";
    }
}