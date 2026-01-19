const API_URL = "구글_웹앱_URL"; // 4단계에서 환경변수로 숨길 예정

async function sendToSheet(payload) {
    const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    return await response.text();
}