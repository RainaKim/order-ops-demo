## Summary

- Lab 12–15에서 주문·재고·결제·관리자 조회 흐름과 예기치 못한 예외 처리 경계를 구현하고, 값 중심의 회귀 테스트를 보강한다.
- 범위 승인 근거: [`notes/preflight-run-l16.md`](preflight-run-l16.md)의 Scope 행. 기준선은 [`notes/session-handoff.md`](session-handoff.md)에 기록된 `74e9708`이다.

## Changed Files

이번 PR 포함 후보는 다음 12개 Lab 12–15 산출물이다.

- 앱 코드: `src/admin.ts`, `src/orders.ts`, `src/payments.ts`, `src/store.ts`
- 테스트: `tests/orders.test.ts`
- 계획: [`notes/plans/l12-inventory-after-payment.md`](plans/l12-inventory-after-payment.md), [`notes/plans/l15-unexpected-error-handling.md`](plans/l15-unexpected-error-handling.md)
- 검토 증거: [`notes/assertion-review-l14.md`](assertion-review-l14.md), [`notes/diff-review-l12.md`](diff-review-l12.md), [`notes/error-log-l13.md`](error-log-l13.md), [`notes/session-handoff.md`](session-handoff.md), [`docs/retry-stop-matrix.md`](../docs/retry-stop-matrix.md)

현재 기준선 diff에는 `AGENTS.md`, 공통 checklist·prompt·template, `labs/` 강의 운영 자료, `notes/issue-draft-l08.md`도 있다. 이들은 이번 PR에서 제외한다. preflight 기록 이후 `labs/lecture16/README.md`도 현재 diff에 있으나 강의 운영 자료이므로 제외한다. Lab 16 산출물인 [`notes/preflight-run-l16.md`](preflight-run-l16.md)와 이 초안, PR template은 승인된 구현 PR 범위에 포함하지 않는다.

## Verification

- 실행: `npm test` — 종료 코드 `0`; Vitest는 12개 테스트를 통과로 집계했다. 다만 관리자 상태 정책 불일치 테스트는 승인된 `it.fails` 기대 실패이므로 일반 통과로 판정하지 않는다.
- 실행: `npm run lint` — 종료 코드 `0`.
- 실행: `npm run typecheck` — 종료 코드 `0`.
- 실행: `git diff --check 74e9708..HEAD` — 출력 없이 종료 코드 `0`.
- 미실행: 실제 결제 provider, 네트워크·인프라 재시도, 환불 흐름. 현 테스트는 로컬 의도적 예외와 앱 경로만 다루며, 재시도·환불 관련 정책이 보류되어 있다.

상세 명령 출력과 판정은 [`notes/preflight-run-l16.md`](preflight-run-l16.md)에 있다.

## Review-ready 판정

**Conditional ready — 사람 승인됨.**

- 재실행: `npm test` — 종료 코드 `0`; `tests/orders.test.ts`의 12개 테스트가 통과로 집계되었다. 관리자 상태 테스트는 승인된 `it.fails` 기대 실패이므로 일반 통과가 아니며, 정책 불일치로 계속 남아 있다.
- 재실행: `npm run lint` — 종료 코드 `0`; `eslint src tests`가 완료되었다. 실행 환경의 `rvm:29: operation not permitted: ps` 경고가 출력됐지만 lint 명령은 성공했다.
- 재실행: `npm run typecheck` — 종료 코드 `0`; `tsc --noEmit`가 완료되었다. 실행 환경의 `rvm:29: operation not permitted: ps` 경고가 출력됐지만 typecheck 명령은 성공했다.
- 새 실패: 위 세 명령에서는 관찰되지 않았다.
- 조건: 실제 PR 파일 선택은 승인된 Lab 12–15 산출물 12개로 한정해야 한다. 강의 운영 자료·장기 기준·Lab 16 산출물은 포함하지 않는다.
- 남은 위험: 관리자 상태 정책 불일치와 재시도·결제 시점 재고 부족 응답·환불의 미결 정책은 그대로 보류다.
- 리뷰 순서: 주문·재고·결제의 상태/값 assertion, 예기치 못한 예외 경계, 구현 계획, 정본 정책과 검토 증거, 최종 PR 파일 선택 순으로 검토한다.
- 미실행: 실제 결제 provider, 네트워크·인프라 재시도, 환불 흐름은 실행하지 않았다. 관련 정책이 보류되어 있어 일반 통과로 판정하지 않는다.

## Risk

- 확인됨: 관리자 조회는 정책의 `payment_failed` 대신 현재 `'결제실패'`를 만든다. 관련 테스트는 승인된 기대 실패이며 다음 Lab 처리 대상이다. 정책 근거는 [`docs/order-policy.md`](../docs/order-policy.md), 테스트 근거는 `tests/orders.test.ts`다.
- 확인됨: 결제 provider/인프라 재시도 조건·횟수·식별 방식, 결제 시점 재고 부족의 외부 응답, 환불은 미결 정책이다. 근거는 [`docs/payment-policy.md`](../docs/payment-policy.md)와 [`docs/retry-stop-matrix.md`](../docs/retry-stop-matrix.md)다.
- 근거 없는 추가 위험: 미확인.

## Rollback Note

미확인 — 제공된 계획·정책·검증 기록에는 이 변경 묶음의 rollback 절차가 없다.

## Reviewer Notes

- 구현 범위와 제외 범위는 [`notes/preflight-run-l16.md`](preflight-run-l16.md)의 Scope·Diff 행을 따른다. 이번 PR에는 위 Changed Files의 12개만 포함해야 한다.
- 구현 판단은 [`notes/plans/l12-inventory-after-payment.md`](plans/l12-inventory-after-payment.md), [`notes/plans/l15-unexpected-error-handling.md`](plans/l15-unexpected-error-handling.md)를 확인한다.
- 상태·결제·재고 기준은 각각 [`docs/order-policy.md`](../docs/order-policy.md), [`docs/payment-policy.md`](../docs/payment-policy.md), [`docs/inventory-policy.md`](../docs/inventory-policy.md)를 정본으로 확인한다. `docs/retry-stop-matrix.md`는 정본이 아닌 보조 검증 기록이다.
