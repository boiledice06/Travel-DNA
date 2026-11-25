import { origin, reset } from './runtime.mjs';
await reset();
console.log('발표 상태가 초기화됐습니다. 인트로를 열거나 새로고침하세요.');
console.log(origin);
