# Lab 19 Scheduled preflight 생성 기록

## E1 후보 선별

- 이전 `notes/`와 `docs/` 산출물에서 네 후보의 반복 근거를 조사했다.
- 새 Issue 관련 파일 정리, PR preflight, 문서·코드 불일치 찾기는 조건부 후보로 남겼고, 독립 반복 근거가 부족한 테스트 실패 로그 요약은 수동 유지로 판정했다.
- 독립 작업에서 같은 checklist가 반복된 근거와 입력·출력 구조가 가장 분명한 `PR preflight 실행`을 Skill 후보로 선택했다.

## E2 표면·권한 심사

- PR preflight에는 로컬 정책·계획·diff 읽기, Git 조회와 검증 명령이 필요하다.
- lint와 typecheck는 일반 세션에서 확인했고, Supertest를 포함한 테스트는 로컬 HTTP 바인딩 권한으로 실행했다.
- 일반 세션의 성공은 Scheduled 권한의 증거가 아니므로 Scheduled의 파일·Git 읽기와 로컬 HTTP 권한은 미확인으로 남겼다.
- stage·commit·게시·외부 쓰기는 자동 실행 범위에서 제외하고, 범위·정책·기대 실패와 최종 PR 준비 판단은 사람이 맡도록 승인했다.

## E3 Skill 시험

- `.agents/skills/pr-preflight/SKILL.md`를 만들고 checklist의 일곱 항목, 근거 경로, 실행·미실행 검증, 중단 이유와 사람 결정을 보고하도록 했다.
- Skill 호출은 정책 불일치, 기대 실패, 불완전한 범위 증거를 일반 통과로 바꾸지 않고 전체 PR 준비를 보류했다.
- 일반 요청도 보류 결론과 근거를 남겼다. 두 실행은 대상·기준선·승인 범위가 같지 않아 동일 입력 비교로 간주하지 않았지만, 절차 재사용과 안전한 중단 행동은 확인했다.
- 이 차이를 한계로 남기고 읽기 전용 Scheduled 준비만 진행하기로 사람이 승인했다.

## E4 Scheduled 생성 기록

- `docs/automation/stop-conditions.md`에 반복 오류, 범위 초과, 외부 권한, 불명확한 테스트 실패, 민감정보와 입력 누락의 중단·재개 증거를 정의했다.
- Scheduled는 `order-ops-demo`에서 `pr-preflight` Skill을 사용해 최근 커밋과 작업 트리 변경을 읽기 전용으로 검토하는 주간 실행으로 준비했다.
- heartbeat 연결 정보와 프로젝트 식별 정보가 없는 요청은 생성 전에 중단됐고, 이후 task 이름과 실행 결과 보고 방식이 추가로 필요하다는 응답을 받았다.
- 현재 상태는 **미생성**이다. 이름은 `Weekly PR Preflight`, 보고는 각 Scheduled 실행 결과에만 남기고 파일 저장·외부 알림은 하지 않는 조건으로 재개한다.
- 앱·테스트 수정, stage, commit, 외부 게시는 수행하지 않았다.
