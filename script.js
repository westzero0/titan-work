const GAS_URL = "https://script.google.com/macros/s/AKfycbzUTLQ6fm-aR5nyxFNCt5_s2X5gLMucmQLAPZF2h8p_4cGzECWqNab3FUsSXPcEYcVk/exec"; 
const staff = ["기원", "창재", "비비", "서호"]; 

document.addEventListener('DOMContentLoaded', () => {
    const box = document.getElementById('member-chips');
    staff.forEach(name => {
        const div = document.createElement('div');
        div.className = 'chip';
        div.innerText = name;
        div.onclick = () => div.classList.toggle('active');
        box.appendChild(div);
    });
    document.getElementById('date').valueAsDate = new Date();
});

// 파일을 Base64 문자열로 변환하는 함수
const fileTo64 = (file) => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result.split(',')[1]);
    reader.onerror = rej;
    reader.readAsDataURL(file);
});

async function shareContent(data) {
    // 카톡 메시지에 경비와 금액 추가
    const message = `[타이탄 일보]\n📅 날짜: ${data.date}\n🏗️ 현장: ${data.site}\n🛠️ 작업: ${data.work}\n💰 경비: ${data.expDetail} (${data.expAmount}원)\n⏰ 시간: ${data.start} ~ ${data.end}\n👥 인원: ${data.members}\n🍱 석식: ${data.dinner}\n🧾 영수증: ${data.hasFile}`;

    if (navigator.share) {
        try { await navigator.share({ title: '타이탄 업무일보', text: message }); } 
        catch (err) { console.log('공유 취소'); }
    } else {
        alert("내용이 복사되었습니다. 카톡에 붙여넣으세요!\n\n" + message);
    }
}

async function send() {
    const btn = document.getElementById('sBtn');
    const site = document.getElementById('site').value;
    const work = document.getElementById('work').value || "내용 없음";
    const expDetail = document.getElementById('expDetail').value || "없음";
    const expAmount = document.getElementById('expAmount').value || "0";
    const start = document.getElementById('start').value;
    const end = document.getElementById('end').value;
    const dinner = document.getElementById('dinner').value;
    const date = document.getElementById('date').value;
    const receiptFile = document.getElementById('receipt').files[0];
    
    const selected = Array.from(document.querySelectorAll('.chip.active')).map(c => c.innerText).join(', ');

    if (!site) return alert("🏗️ 현장명을 입력해주세요!");
    if (!selected) return alert("👥 작업 인원을 선택해주세요!");

    btn.disabled = true;
    btn.innerText = "⏳ 서버 전송 중...";

    let fileData = null;
    if (receiptFile) {
        fileData = await fileTo64(receiptFile); // 사진 파일을 데이터로 변환
    }

    const payload = {
        action: "saveLog",
        data: {
            date: date,
            site: site,
            work: work,
            expDetail: expDetail, // 경비 내역
            expAmount: expAmount, // 금액
            start: start,
            end: end,
            members: selected,
            dinner: dinner,
            fileName: receiptFile ? receiptFile.name : null,
            fileType: receiptFile ? receiptFile.type : null,
            fileContent: fileData, // 사진 데이터
            hasFile: receiptFile ? "첨부됨" : "없음"
        }
    };

    try {
        const response = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        const result = await response.text();
        
        if (result === "SUCCESS") {
            alert("✅ 저장 완료!");
            await shareContent(payload.data);
        } else {
            alert("❌ 저장 실패: " + result);
        }
    } catch (e) {
        alert("⚠️ 전송 오류!");
    } finally {
        btn.disabled = false;
        btn.innerText = "🚀 저장 및 카톡 공유";
    }
}