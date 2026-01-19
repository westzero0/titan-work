const GAS_URL = "https://script.google.com/macros/s/AKfycbxz5rnAO2riYxVgVdT7I9WTZdp_0R--egdkuqHu1PVXUKKnau_6Ffkf_kUUsRxMAGfh/exec"; 

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