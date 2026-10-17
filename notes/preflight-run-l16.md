# Lab 16 PR preflight 실행 기록

대상 기준선은 `notes/session-handoff.md`에 기록된 Lab 12 시작 HEAD `74e9708`이며, 점검 시점 HEAD는 `55c400a98a0765e63b43b15fa7f192f5a6d8d674`이다. 이 기록은 `docs/checklists/pr-preflight.md`를 현재 PR 후보에 적용한 결과이며, 관찰하거나 실행한 사실만 적는다.

| 항목 | 명령 또는 관찰 | 결과 | 판정 |
| --- | --- | --- | --- |
| Scope | `git diff --name-status 74e9708..HEAD`, `git status --short`, 사람 승인 | 기준선 이후 커밋 범위는 27개 파일이다. 이 중 이번 PR 포함 범위는 Lab 12–15 앱 코드 4개(`src/admin.ts`, `src/orders.ts`, `src/payments.ts`, `src/store.ts`), 테스트 1개(`tests/orders.test.ts`), 계획 2개(`notes/plans/l12-inventory-after-payment.md`, `notes/plans/l15-unexpected-error-handling.md`), 검토 증거 5개(`notes/assertion-review-l14.md`, `notes/diff-review-l12.md`, `notes/error-log-l13.md`, `notes/session-handoff.md`, `docs/retry-stop-matrix.md`)다. 나머지 15개는 `AGENTS.md`, 장기 기준·prompt·template, `labs/`의 강의 운영 자료, `notes/issue-draft-l08.md`로 이번 PR에서 제외한다. 작업 트리의 `docs/checklists/pr-preflight.md`와 이 Lab 16 기록도 제외한다. | 통과 — 사람이 이번 PR의 포함 12개와 제외 범위를 승인했다. |
| Policy | `docs/order-policy.md`, `docs/payment-policy.md`, `tests/orders.test.ts`의 관리자 조회 assertion, `src/admin.ts` 대조 | 결제 실패 정책의 `402` 및 `payment_failed` 상태 기대가 문서에 있다. 관리자 조회 테스트는 `payment_failed`를 요구하지만, 현재 `src/admin.ts`는 실패 상태를 `'결제실패'`로 만든다. 해당 테스트는 승인된 `it.fails` 상태다. 결제 재시도 조건·횟수·식별 방식과 결제 시점 재고 부족의 외부 응답은 정책에서 보류되어 있다. | 보류 — 승인된 정책 불일치 기대 실패와 미결 정책이 남아 있다. |
| Tests | `npm test` | 종료 코드 `0`. `vitest run` 결과 `tests/orders.test.ts` 1개 파일, 12개 테스트가 통과로 집계되었다. 이 집계에는 위 관리자 상태의 `it.fails` 기대 실패가 포함된다. | 보류 — 명령은 성공했으나 기대 실패를 일반 통과로 판정하지 않는다. |
| Lint | `npm run lint` | 종료 코드 `0`. `eslint src tests`가 완료되었다. 실행 환경에서 `/Users/RainaKim/.rvm/scripts/rvm:29: operation not permitted: ps` 경고가 함께 출력되었으나 lint 명령은 성공했다. | 통과 |
| Typecheck | `npm run typecheck` | 종료 코드 `0`. `tsc --noEmit`가 완료되었다. 실행 환경에서 `/Users/RainaKim/.rvm/scripts/rvm:29: operation not permitted: ps` 경고가 함께 출력되었으나 typecheck 명령은 성공했다. | 통과 |
| Diff | `git diff --check 74e9708..HEAD`, `git diff --stat 74e9708..HEAD`, Scope 승인 | `git diff --check`은 출력 없이 종료 코드 `0`이었다. 통계는 27개 파일, 1,979개 추가와 220개 삭제다. 이 27개는 Scope 행에서 이번 PR 포함 12개와 제외 15개로 분류됐다. 현재 미추적 Lab 16 기록과 장기 기준 checklist는 이번 PR에서 제외한다. | 통과 — 공백 오류는 관찰되지 않았고, 사람이 diff 포함·제외 범위를 승인했다. |
| Failure handling | `src/payments.ts`, `src/admin.ts`, `tests/orders.test.ts`, `docs/payment-policy.md`, `notes/plans/l15-unexpected-error-handling.md` 대조 및 `npm test` | 두 예기치 못한 예외 경로는 외부에 `500`과 `{ ok: false, error: "internal_error", requestId }`를 반환하고, 서버에 오류 종류·requestId·주문 ID·처리 단계·메시지·스택·전후 상태·발생 위치를 `console.error`로 남기도록 구현·테스트되어 있다. 결제 provider/인프라 재시도와 실패 뒤 상태·이력의 추가 계약은 이 범위에서 정하지 않았다. | 보류 — 승인된 오류 경계는 확인됐지만 재시도와 보존의 미결 정책은 사람 판단이 필요하다. |
| 미실행 범위 | 실제 결제 provider·네트워크/인프라 재시도·환불 흐름 | 현재 테스트는 로컬 의도적 예외와 앱 경로만 실행했다. 위 외부 흐름은 현재 정책에서 재시도 조건·횟수·식별 방식 또는 환불 정책이 보류되어 있어 실행·판정하지 않았다. | 보류 |

## 중단 지점

앱 파일은 수정하지 않았다. Scope와 diff의 포함·제외 범위는 승인되어, 이번 PR에는 Scope 행의 12개 Lab 12–15 산출물만 포함한다. 관리자 상태 정책 불일치의 다음 Lab 처리와 재시도·후속 보존 정책의 사람 결정은 계속 보류다. Lab 16 기록과 장기 기준·강의 운영 자료는 이번 PR에 포함하지 않는다.
