# Lecture 13 통제된 실패 실행 로그

초기 실행에서는 통제된 실패 패치를 수정하지 않고 결과만 기록했다. 이후 복구 요청에 따라 Lab 13에서 주입한 블록만 제거했으며, stage와 commit은 수행하지 않았다.

## `npm run typecheck`

- 실행 여부: 실행함
- 종료 코드: `2`
- 첫 관련 에러 원문:

  ```text
  src/payments.ts(131,25): error TS1308: 'await' expressions are only allowed within async functions and at the top levels of modules.
  ```

- 파일과 위치: `src/payments.ts:131:25`
- 같은 실행에서 추가로 잡힌 오류:

  ```text
  src/payments.ts(131,38): error TS2339: Property 'transitionTo' does not exist on type 'Map<string, Order>'.
  ```

- 추가 오류의 파일과 위치: `src/payments.ts:131:38`

## `npm test`

- 실행 여부: 실행함
- 종료 코드: `1`
- 첫 관련 에러 원문:

  ```text
  Error: Transform failed with 1 error:
  /Users/RainaKim/Documents/코덱스강의/order-ops-demo/src/payments.ts:131:24: ERROR: "await" can only be used inside an "async" function
  ```

- 파일과 위치: `src/payments.ts:131:24`
- 결과: `tests/orders.test.ts`는 변환 실패로 수집 전에 중단되어, 실제 테스트는 실행되지 않았다 (`0 test`).

## 두 검증이 잡은 문제의 차이

`npm run typecheck`는 TypeScript의 정적 분석으로 `await`가 비동기 함수 밖에 있다는 오류와 `orders`(`Map<string, Order>`)에 `transitionTo` 메서드가 없다는 API/타입 오류를 모두 보고했다. 반면 `npm test`는 Vite/esbuild 변환 단계에서 비동기 함수 밖의 `await`를 먼저 만나 모듈을 변환하지 못했으므로, 테스트를 수집·실행하지 않았고 `transitionTo`의 타입 오류까지는 보고하지 못했다.

## 복구 후 재실행 결과

복구는 `src/payments.ts`의 아래 Lab 13 주입 블록만 원래 호출로 되돌렸다.

```ts
const paidOrder = completePayment(order);
```

`tests/`에는 작업 트리 diff가 없었으므로 변경하지 않았다. 이 결과는 위의 초기 실패 실행 결과(`npm run typecheck`, `npm test`)와 다음 재실행 결과를 연결해 비교한다.

| 명령 | 초기 실행 | 복구 후 재실행 | 변화 |
| --- | --- | --- | --- |
| `npm run typecheck` | 종료 코드 `2`; `src/payments.ts:131`에서 `await` 및 `transitionTo` 오류 | 실행함, 종료 코드 `0` | 두 정적 오류가 해소됨 |
| `npm test` | 종료 코드 `1`; `src/payments.ts:131:24` 변환 실패, `0 test` | 실행함, 종료 코드 `0`; `1`개 파일, `9`개 테스트 통과 | 변환·수집이 가능해져 전체 테스트가 실행됨 |

복구 후 첫 관련 오류: 없음. 두 명령 모두 성공적으로 종료했다.
