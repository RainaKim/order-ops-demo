# Lab 13 Fault Injection

이 지침은 검출 계층을 시험하는 임시 실습에만 사용한다.

- `labs/fixtures/l13-hallucinated-patch.md`의 diff 블록만 `src/payments.ts`에 그대로 적용한다.
- fixture의 오류를 보정하거나 다른 `src/`·`tests/` 파일을 수정하지 않는다.
- 패키지를 설치하거나 dependency·lockfile을 바꾸지 않는다.
- 검증·stage·commit 없이 패치 적용 뒤 멈춘다.
