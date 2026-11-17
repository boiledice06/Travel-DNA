const http = require('http');
const base = { session_id: 'polish-mock', turn: 0, assistant_message: '먼저 취향을 알려 주세요.', chips: [] };
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8084');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const items = Array.from({ length: 5 }, (_, i) => ({ id: `q${i}`, statement_ko: `테스트 문항 ${i + 1}`, scale: [1,2,3,4,5].map(value => ({value,label_ko: String(value)})) }));
  let response;
  if (req.url === '/api/trip-profile') response = {id: 'mock-profile'};
  else if (req.url === '/api/dna-chat/start') response = {...base, phase:'likert', likert_items:items};
  else if (req.url === '/api/dna-chat/likert') response = {...base, phase:'asking'};
  else if (req.url === '/api/dna-chat/message') response = {...base, phase:'asking', turn:1, assistant_message:'모의 응답: 어떤 미술 전시를 좋아하시나요?', chips:[]};
  else { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(response));
}).listen(8767,'127.0.0.1');
