# Lab 14 assertion 검토 초안

## 판단 기준

이 문서는 테스트 이름이나 구현 추정이 아니라 `tests/orders.test.ts`에 있는 assertion 원문만을 근거로 보장 범위를 판단한다. 정책 문서는 기대해야 할 결과를 제시하지만, assertion이 그 값을 직접 확인하지 않으면 이 문서에서는 **아직 판정할 수 없음**으로 표시한다.

| 영역 | assertion 원문 근거 | 기존 assertion이 실제로 보장하는 값 | 아직 판정할 수 없는 값 | 위험 | 관찰할 값 | 정책상 예상 결과 | 후속 테스트 책임 후보 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 주문 생성 | `expect(response.status).toBe(201)` | 단일 품목 주문 생성 요청의 HTTP 상태가 `201`임 | 응답 주문의 ID·품목·총액·생성 시각, 저장 여부, 상태가 `pending`인지, 재고가 유지되는지 | 생성 응답이 성공이어도 저장 내용 또는 초기 상태가 정책과 달라질 수 있음 | `response.body.id`, `items`, `totalKrw`, `createdAt`, `orders`의 저장값, 상품 재고 | 유효 주문은 저장되어 `pending`에 진입하고, 생성만으로 재고를 차감하지 않음 | 주문 생성 API 테스트 |
| 주문 생성 | `expect(response.body.status).toBe('pending')`; `expect(products.get('keyboard')?.stock).toBe(5)`; `expect(products.get('mouse')?.stock).toBe(10)` | 충분 재고의 다품목 주문 응답 상태가 `pending`이고, keyboard·mouse의 관찰 재고가 각각 `5`·`10`임 | 주문이 실제로 저장됐는지, 응답 품목·수량·총액이 요청과 일치하는지, 다른 상품 재고가 보존되는지 | 상태와 두 재고값만 맞고 주문 데이터가 누락·변형될 수 있음 | 주문 ID로 저장소/조회 응답의 `items`, `totalKrw`, `createdAt`; 모든 비주문 품목 재고 | 충분 재고 주문은 `pending`으로 저장하고 재고를 차감하지 않음 | 주문 생성·조회 API 테스트 |
| 주문 조회 | `expect(response.status).toBe(200)` | 직전에 생성 응답에서 얻은 ID로 조회했을 때 HTTP 상태가 `200`임 | 조회 본문의 ID·상태·품목·총액·생성 시각이 생성한 주문과 일치하는지, 없는 ID의 처리 | `200` 응답이 다른 주문 또는 불완전한 주문을 반환해도 검출하지 못함 | `response.body.id`, `status`, `items`, `totalKrw`, `createdAt`; 존재하지 않는 ID의 상태·본문 | 조회는 상태를 바꾸지 않으며 저장된 주문의 현재 상태와 운영 판단에 필요한 기본 정보를 제공해야 함 | 주문 조회 API 테스트 |
| 재고 부족: 주문 생성 | `expect(response.status).toBe(409)`; `expect(response.body).toEqual({ message: 'Insufficient stock' })`; `expect(orders.size).toBe(0)`; keyboard·mouse·monitor 재고 assertion | 합산 keyboard 수량 `6`이 재고를 넘는 요청이 `409`와 정확한 본문을 반환하고, 주문 수가 `0`이며 세 seed 상품 재고가 각각 `5`·`10`·`2`임 | 실패 응답에 다른 필드가 없는지 외의 오류 형식, 미검사 상품·기존 주문이 있을 때의 불변성, 동시 요청에서의 원자성 | 현재 seed와 빈 주문 저장소에서만 무저장·무변경을 증명함 | 전체 `orders` 내용, 전체 `products` 상태, 동시성 또는 기존 데이터가 있는 경우의 상태 | 동일 상품 수량을 합산해 저장 전 검사하고, 하나라도 부족하면 주문·모든 상품 재고를 변경하지 않음 | 주문 생성 재고 경계 테스트 |
| 재고 부족: 결제 시점 | `expect(response.status).toBe(409)`; `expect(orders.get(orderId)?.status).toBe('pending')`; keyboard·mouse 재고 assertion; `expect(paymentAttempts).toHaveLength(0)` | 결제 직전 keyboard 재고를 `0`으로 만든 경우 응답 `409`, 주문 상태 `pending`, keyboard `0`·mouse `10`, 결제 이력 `0`건 | `409`의 본문/오류 코드, 모든 품목이 부족한 경우, 재고 부족 사건의 정책상 최종 상태·응답이 승인됐는지 | 재고 부족 결제의 상태·응답은 정책에서 보류인데 테스트가 현재 구현의 `409`·`pending`을 고정할 수 있음 | 응답 본문, 모든 품목 재고, 주문 상태 및 이력의 불변성; 정책 승인 여부 | 결제 성공으로 확정하지 않고 전체 주문 기준으로 미차감해야 함. 결제 시점 부족의 상태·HTTP 응답은 보류 | 결제 재고 경계 테스트 + 정책 결정 담당자 |
| 결제 실패 | `expect(payment.status).toBe(402)`; `expect(fetched.status).toBe(200)`; `expect(fetched.body.status).toBe('payment_failed')`; `expect(paymentAttempts).toHaveLength(1)`; `expect(paymentAttempts[0]).toMatchObject({ orderId, ok: false })`; `expect(products.get('mouse')?.stock).toBe(10)` | 실패 결제는 `402`, 조회 가능한 `payment_failed` 주문, 해당 주문 ID·`ok: false`를 포함한 이력 1건, mouse 재고 `10`을 보장함 | 실패 응답의 안전한 실패 정보, 이력의 `amountKrw`·`at`·실패 사유, 주문의 원래 품목/총액 보존, 카드·내부 오류 비노출 | 실패 이력이 불완전하거나 민감 정보가 노출돼도 현재 assertion만으로는 검출하지 못함 | 실패 응답 본문, `paymentAttempts[0].amountKrw`, `at`, 안전한 실패 사유, 주문 필드와 재고 전체 | `pending → payment_failed`, 실패 주문·이력 보존, HTTP `402`, 재고 미차감, 외부 응답에서 카드/내부 오류 제외 | 결제 실패 API·응답 계약 테스트 |
| 결제 실패 후 재결제 | `expect(retry.status).toBe(400)`; `expect(retry.body).toEqual({ message: 'Order is not payable' })`; 상태·이력 길이·monitor 재고 assertion | 실패한 주문의 재결제 요청이 `400`과 정확한 메시지를 반환하고, 상태가 `payment_failed`, 이력 수와 monitor 재고가 재시도 전과 같음 | 재시도 요청이 실패 주문의 다른 필드를 바꾸지 않는지, 응답에 민감 정보가 없는지, 기술적 네트워크 재시도 경계 | 상태·이력 길이·한 재고값 외의 변경 또는 정보 노출을 놓칠 수 있음 | 주문 전체 스냅샷, 이력 객체 전체, 응답 본문 필드, 기술적 재시도 식별 여부 | 동일 `payment_failed` 주문의 새 결제는 거부하며 상태·이력·재고를 변경하지 않음. 네트워크/인프라 재시도는 보류 | 재결제 거부 API 테스트 + 정책 결정 담당자 |
| 관리자 조회 | `expect(Array.isArray(response.body)).toBe(true)` | `/admin/orders` 응답 본문이 JavaScript 배열임 | HTTP 상태, 주문 행 수, 각 행의 `id`·`status`·`totalKrw`·`createdAt`, 실패 주문 포함, 실패 금액·시각·사유의 조건부 제공, 민감 정보 미노출, 고아 이력 미행 생성 | 배열이 비어 있거나 정책 필수 필드가 빠져도 통과하며, 실패 시도를 상태로 잘못 파생하는 문제를 검출하지 못함 | 응답 상태, 생성한 정상·실패 주문 각각의 행, 각 필수 필드, `payment_failed`에서만 조건부 실패 정보, 카드/내부 오류/원시 오류의 부재 | 모든 저장 주문을 기준으로 최소 필수 정보를 제공하고, `order.status === 'payment_failed'`일 때만 해당 주문의 실패 정보를 조건부로 제공 | 관리자 주문 목록 API 테스트 |

## 다음 검토 시 유의점

- 재고 부족 결제의 `409` 및 `pending`은 현재 assertion이 보장하는 구현 결과지만, 정책 문서는 그 사건의 상태와 HTTP 응답을 보류한다. 정책 승인 없이 이를 장기 계약으로 확대하지 않는다.
- 관리자 조회 정책은 현재 제공 범위와 목표의 차이를 명시한다. 따라서 배열 assertion만으로 정책 준수 또는 미준수를 단정하지 않고, 행 단위 assertion을 별도로 추가할 책임을 관리자 주문 목록 테스트에 둔다.
- 후속 테스트는 정책이 이미 결정한 값만 확정적으로 assertion하고, 보류 사항은 결정 기록 또는 승인 전까지 `확인 필요`로 유지한다.

## E2 보강 결과

정책이 확정됐고 현재 구현과 일치하는 다음 assertion만 `tests/orders.test.ts`의 기존 케이스에 추가했다. 별도 파일 분리는 필요하지 않았다. 모두 기존 주문 API의 생성·조회·결제 흐름에 속하며, 서로 다른 기능을 새 파일에 섞지 않았다.

| 보강 영역 | 추가로 확인한 실제 결과 값 | 정책 근거 |
| --- | --- | --- |
| 주문 생성 | 응답·저장 주문의 `id`, `items`, `totalKrw: 49000`, `status: 'pending'`, `createdAt` | 유효 주문은 저장되어 `pending`에 진입하고 생성만으로 재고를 차감하지 않음 |
| 주문 조회 | 조회 본문 전체가 직전 생성 응답과 동일함 | 조회는 저장된 주문을 반환하며 상태를 바꾸지 않음 |
| 결제 성공 | 응답 주문의 품목, `totalKrw: 170000`, `status: 'paid'`, 생성 시각 | 결제 성공은 `pending → paid`이고 재고·결제 이력은 기존 assertion이 계속 확인함 |
| 결제 실패 | 응답 `{ ok: false }`, 조회 주문의 품목·`totalKrw: 46000`·`payment_failed`, 실패 이력의 `amountKrw: 46000`·유효한 시각, mouse 재고 `10` | 실패 주문·이력 보존, HTTP 402, 재고 미차감, 카드·내부 오류를 응답에 포함하지 않음 |

### 실행 결과

- `npm run typecheck`: 실행함, 종료 코드 `0`.
- `npm test`: 실행함, 최종 종료 코드 `0`; `tests/orders.test.ts`의 9개 테스트가 모두 통과함.
- 보강 중 결제 성공 주문의 총액 기대값을 `219000`으로 잘못 적은 첫 실행은 종료 코드 `1`이었다. 실제 품목 가격 합계 `170000`으로 assertion만 정정한 뒤 재실행해 통과했다. `src`는 수정하지 않았다.

### 아직 남은 공백

- 결제 시점 재고 부족의 HTTP 상태와 최종 주문 상태는 결제·재고 정책에서 보류되어 있으므로, 현재 `409`·`pending`을 추가 계약으로 고정하지 않았다.
- 관리자 조회는 정책 문서가 현재 구현의 상태 파생 및 실패 정보 제공이 목표와 불일치한다고 명시한다. 행 단위 정책 assertion은 구현 정렬 또는 별도 결정 뒤에 추가해야 한다.
- 네트워크·인프라 재시도 식별·허용 조건, 환불 뒤 재고 복원, 결제 실패 사유의 안전한 표현은 정책 보류 사항이므로 테스트 기대값으로 확정하지 않았다.

## E3 관리자 조회 정책 assertion 실행 기록

기존의 약한 assertion 원문 `expect(Array.isArray(response.body)).toBe(true)`는 제거했다. 이를 일반 `it('lists stored orders with their policy statuses for administrators', ...)`으로 교체해, 정상·실패 주문 두 건의 관리자 행 수와 각각의 `id`, `totalKrw`, `createdAt`, `status`를 확인한다. 실패 주문의 정책 상태는 `payment_failed`로 기대한다. `it.fails`는 사용하지 않았고 `src`도 수정하지 않았다.

- 명령: `npm test`
- 종료 코드: `1`
- 첫 관련 출력 원문:

  ```text
  AssertionError: expected [ { …(4) }, { …(4) } ] to deeply equal ArrayContaining{…}

  -     "status": "payment_failed",
  +     "status": "결제실패",
  ```

- 파일과 위치: `tests/orders.test.ts:217:27`
- 실행 결과: 전체 9개 테스트 중 8개 통과, 관리자 조회 정책 assertion 1개 실패.

이 실패는 관리자 상태가 실패 시도의 존재로부터 `'결제실패'`를 파생하지 않고, 저장된 주문의 `status === 'payment_failed'`를 그대로 표시해야 한다는 주문 상태 정책과 현재 구현의 차이를 드러낸다.

### 여전히 확인할 수 없는 관리자 조회 범위

- 실패 금액·시각·사유는 정책상 `payment_failed` 행에 필요하지만, 정책은 관리자 응답의 필드명을 정하지 않았다. 필드 계약이 확정되기 전에는 이름을 추정한 assertion을 추가하지 않는다.
- 실패 사유의 안전한 표현과 카드·내부 오류·원시 오류의 비노출은 응답 필드 계약 및 구현 정렬 뒤에 검증한다.
- 같은 주문에 실패 이력이 여러 개인 경우 표시할 이력 선택 기준은 정책에서 사람의 결정이 필요한 사항으로 남아 있다.

### 승인된 `it.fails` 전환과 재실행

사람이 정책 불일치로 승인한 관리자 상태 표시 테스트 `lists stored orders with their policy statuses for administrators`만 `it.fails(...)`로 전환했다. 테스트 바로 위에 현재 구현이 `payment_failed` 대신 `결제실패`를 파생한다는 실패 이유를 주석으로 남겼다. 실패 금액·시각·사유는 보류하며 assertion을 추가하거나 `it.fails`로 전환하지 않았다.

- 명령: `npm test`
- 종료 코드: `0`
- 첫 관련 출력 원문:

  ```text
  ✓ tests/orders.test.ts (9 tests) 37ms
  ```

- 파일과 위치: `tests/orders.test.ts:201`
- 실행 결과: 9개 테스트 모두 통과했다. 관리자 상태 표시 assertion은 정책 불일치를 계속 감시하는 기대 실패로 실행됐다.

## E4 assertion 결과 비교

| 분류 | assertion 원문 또는 질문한 값 | 정책 근거 | 실제 결과 | 다음 조치 |
| --- | --- | --- | --- | --- |
| 나쁜 통과 | E1 원문 `expect(Array.isArray(response.body)).toBe(true)`: “관리자 응답이 배열인가?” | 관리자 목록은 저장된 주문의 `id`, `status`, `totalKrw`, `createdAt`을 제공하고, 실패 주문은 `payment_failed`일 때만 그 상태를 표시해야 함 | 응답이 빈 배열이거나 행 값·상태가 틀려도 통과하므로, 현재 구현의 `'결제실패'` 파생을 발견하지 못했음 | 이 약한 assertion은 제거했으며, 행 수와 주문별 실제 값을 묻는 정책 assertion으로 대체함 |
| 좋은 통과 | 생성 주문의 `items`, `totalKrw: 49000`, `status: 'pending'`, `id`, `createdAt` 및 저장된 주문 값; 실패 결제의 `totalKrw: 46000`, `payment_failed`, 실패 이력 `amountKrw: 46000`·유효한 `at`, mouse 재고 `10` | 유효 주문은 `pending`으로 저장되고 생성 시 재고를 차감하지 않음; 실패 주문·이력을 보존하고 실패 시 재고를 차감하지 않음 | 값 중심 assertion이 일반 `it`으로 통과하여 응답·저장 상태·이력·재고의 구체 값을 확인함 | 일반 `it`으로 유지. 정책 보류인 결제 시점 재고 부족의 상태·응답은 추가 계약으로 고정하지 않음 |
| 좋은 실패 | E3 원문 `expect.arrayContaining([{ … status: 'payment_failed', … }])`: “실패 주문 행의 실제 `status`가 `payment_failed`인가?” | `order.status === 'payment_failed'`일 때만 관리자 상태를 `payment_failed`로 표시하며, 실패 시도 존재만으로 다른 표시를 파생하지 않음 | 원래 실행에서 기대 `payment_failed`와 실제 `결제실패`의 차이를 발견함. 사람 승인 후 이 정책 불일치 테스트만 `it.fails`로 전환했으며, 최종 테스트에서는 기대 실패로 실행되어 전체 명령은 통과함 | **Lab 15 확인 대상:** `src/admin.ts`의 관리자 상태 표시(`deriveDisplayStatus`)와 관리자 응답 계약. 실패 금액·시각·사유는 필드 계약과 이력 선택 기준이 보류이므로 이번 전환·검증 범위에서 제외함 |

### 최종 실행 결과

| 명령 | 종료 코드 | 실제 결과 원문 |
| --- | --- | --- |
| `npm test` | `0` | `✓ tests/orders.test.ts (9 tests) 33ms` |
| `npm run lint` | `0` | `> eslint src tests` |
| `npm run typecheck` | `0` | `> tsc --noEmit` |

`npm test`의 종료 코드 `0`은 관리자 상태 assertion이 정책 불일치를 감시하는 승인된 `it.fails`이기 때문이다. 이는 현재 구현이 정책과 정렬됐다는 뜻이 아니다.
