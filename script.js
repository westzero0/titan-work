const GAS_URL = "https://script.google.com/macros/s/AKfycbzUTLQ6fm-aR5nyxFNCt5_s2X5gLMucmQLAPZF2h8p_4cGzECWqNab3FUsSXPcEYcVk/exec"; 


// 초기 리스트 (사용자 요약 기반)
let lists = {
    member: ["기원", "창재", "비비", "서호"],
    car: ["봉고", "포터", "스타렉스", "창재차"]
};

let delMode = { member: false, car: false };

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('date').valueAsDate = new Date();
    renderAllChips();
});

function renderAllChips() {
    renderChips('member');
    renderChips('car');
}

function renderChips(type) {
    const box = document.getElementById(`${type}-chips`);
    box.innerHTML = "";
    lists[type].forEach(name => {
        const div = document.createElement('div');
        div.className = `chip ${delMode[type] ? 'delete-target' : ''}`;
        div.innerText = name;
        div.onclick = () => handleChipClick(type, name, div);
        box.appendChild(div);
    });
}

function handleChipClick(type, name, element) {
    if (delMode[type]) {
        // 삭제 모드일 때
        lists[type] = lists[type].filter(i => i !== name);
        renderChips(type);
    } else {
        // 선택 모드일 때
        element.classList.toggle('active');
    }
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
    if (!val) return;
    if (lists[type].includes(val)) return alert("이미 존재합니다.");
    
    lists[type].push(val);
    renderChips(type);
    input.value = "";
}

// 파일 변환 보조
const fileTo64 = (f) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.readAsDataURL(f);
});

async function send() {
    const btn = document.getElementById('sBtn');
    const site = document.getElementById('site').value;
    if (!site) return alert("🏗️ 현장명을 입력해주세요!");

    const selectedMembers = Array.from(document.querySelectorAll('#member-chips .chip.active')).map(c => c.innerText).join(', ');
    const selectedCars = Array.from(document.querySelectorAll('#car-chips .chip.active')).map(c => c.innerText).join(', ');

    btn.disabled = true;
    btn.innerText = "⏳ 전송 중...";

    const receiptFile = document.getElementById('receipt').files[0];
    let fileData = null;
    if (receiptFile) fileData = await fileTo64(receiptFile);

    const payload = {
        action: "saveLog",
        data: {
            date: document.getElementById('date').value,
            client: document.getElementById('client').value,
            site: site,
            work: document.getElementById('work').value,
            start: document.getElementById('start').value,
            end: document.getElementById('end').value,
            members: selectedMembers,
            car: selectedCars,
            dinner: document.getElementById('dinner').value,
            expAmount: document.getElementById('expAmount').value || "0",
            expDetail: document.getElementById('expDetail').value || "없음",
            fileContent: fileData,
            fileName: receiptFile ? receiptFile.name : null,
            fileType: receiptFile ? receiptFile.type : null
        }
    };

    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) });
        if (await res.text() === "SUCCESS") {
            alert("✅ 저장 완료!");
            shareNative(payload.data);
        }
    } catch (e) { alert("⚠️ 오류 발생!"); }
    finally {
        btn.disabled = false;
        btn.innerText = "🚀 저장 및 카톡 공유";
    }
}

function shareNative(d) {
    const msg = `[타이탄 일보]\n📅 날짜: ${d.date}\n🏢 거래처: ${d.client}\n🏗️ 현장: ${d.site}\n🛠️ 작업: ${d.work}\n⏰ 시간: ${d.start}~${d.end}\n👥 인원: ${d.members}\n🚛 차량: ${d.car}\n💰 경비: ${d.expDetail}(${d.expAmount}원)`;
    if (navigator.share) {
        navigator.share({ title: '타이탄 일보', text: msg });
    } else {
        alert("복사되었습니다: \n" + msg);
    }
}