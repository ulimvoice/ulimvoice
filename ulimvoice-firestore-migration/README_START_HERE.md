# Codex에서 시작하는 순서

1. 울림앱 Git 저장소를 Codex 앱에서 연다.
2. 가능하면 새 worktree를 만든다.
   - 이름: `firestore-migration-phase1`
3. 이 패키지의 `AGENTS.md`를 저장소 루트에 복사한다.
4. `CODEX_FIRESTORE_MASTER_PROMPT.md` 내용을 Codex에 그대로 붙여 넣는다.
5. Codex가 Phase 0·1을 완료할 때까지 운영 배포를 승인하지 않는다.
6. 결과에서 아래를 확인한다.
   - 기능 플래그가 모두 false인가
   - 기존 GAS fallback이 남아 있는가
   - 비밀키가 Git에 들어가지 않았는가
   - Emulator 권한 테스트가 통과했는가
   - 최신 index/GAS 기준 파일을 정확히 사용했는가
7. 결과 파일과 테스트 로그를 ChatGPT에 가져와 Phase 2 검토를 진행한다.
