/**
 * common.js — 새 화면(quote.html, hub.html 등)이 함께 쓰는 서버 연결 파일
 *
 * - 서버(Apps Script 웹앱) 주소는 이 파일 한 곳에만 둔다.
 * - 서버 요청은 반드시 sendToGas()만 거친다. (나중에 로그인·토큰을 붙일 때 이 파일만 고치면 된다)
 * - 사용법: 페이지에서 <script src="common.js"></script> 를 먼저 불러온 뒤 sendToGas('동작이름', {값}) 호출
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbysyoS6gXSfkSCFYFykxzlTOQkDwRJOaE5g7OkNvSZy8xVvesKdi95coOu33bgeRdqs/exec";

/**
 * 🔐 [보안 자리] 나중에 로그인/토큰을 붙일 때 이 함수만 채운다.
 * 지금은 null을 돌려줘서 요청에 아무것도 붙지 않는다 (기존 서버 동작과 똑같이 동작).
 * 예) return sessionStorage.getItem('titan_token');
 */
function getAuthToken() {
  return null;
}

/**
 * 서버에 동작을 요청하고 JSON 결과를 돌려준다.
 * @param {string} action 서버 동작 이름 (예: 'getQuoteList')
 * @param {object} data   동작에 넘길 값
 * @returns {Promise<any>} 서버가 돌려준 JSON
 * @throws 서버가 JSON이 아닌 응답(로그인 페이지 등)을 주면 Error
 *
 * ⚠️ 헤더(Content-Type 등)를 추가하지 말 것: 헤더를 붙이면 브라우저가 사전검사(CORS preflight)를
 *    먼저 보내는데 Apps Script 웹앱은 이를 처리하지 못해 요청이 실패한다.
 */
async function sendToGas(action, data) {
  const payload = { action, data };

  const token = getAuthToken();
  if (token) payload.token = token; // 토큰이 있을 때만 붙임

  const res = await fetch(GAS_URL, {
    method: "POST",
    body: JSON.stringify(payload),
    redirect: "follow"
  });
  const text = await res.text();

  let result;
  try {
    result = JSON.parse(text);
  } catch (e) {
    // JSON이 아닌 응답(로그인 페이지 HTML 등)이 오면 여기로 옴 - 원인 파악용으로 앞부분을 그대로 보여줌
    throw new Error("서버 응답이 JSON이 아닙니다. 배포 권한 설정을 확인해주세요. (응답 앞부분: " + text.substring(0, 80) + ")");
  }

  // 🔐 [보안 자리] 나중에 서버가 '로그인 필요' 같은 응답을 주면 여기서 공통으로 처리한다.
  //    예) if (result && result.status === 'AUTH_REQUIRED') { 로그인 화면으로 이동; }

  return result;
}
