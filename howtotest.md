# Project RT: Test Guide

이 문서는 `test` 브랜치에서 구현된 주사위 굴림 및 AI 시나리오 기능을 테스트하는 방법을 설명합니다.

## 실행 방법

웹 개발 화면을 실행합니다:

```bash
npm start
```

브라우저에서 `http://localhost:3000`을 열면 왼쪽에 채팅 화면, 오른쪽에 디버그 로그가 표시됩니다. 세션 기록은 `.data/sessions`에 저장됩니다.

기존 CLI를 실행하려면 `npm run cli`를 사용합니다.

`.env` 파일에 `OPENAI_API_KEY` 또는 `GEMINI_API_KEY`가 없거나 유효하지 않아도 **오프라인 모드**로 실행되며, 모든 테스트 기능을 사용할 수 있습니다.

OpenAI API를 사용하는 경우 `.env`를 다음처럼 설정합니다:

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=your_api_key_here
OPENAI_MODE=gpt54_then_mini
OPENAI_GPT54_DAILY_TOKEN_LIMIT=250000
OPENAI_MAX_OUTPUT_TOKENS=2048
OPENAI_USAGE_TIME_ZONE=UTC
```

`OPENAI_MODE=gpt54_then_mini`이면 `gpt-5.4` 사용량은 `.data/openai-gpt-5.4-token-usage.json`에 저장됩니다. `gpt-5.4`의 기본 일일 상한은 `250,000`토큰이며, 다음 요청이 한도를 넘길 수 있으면 자동으로 `gpt-5.4-mini`를 사용합니다.

현재 AI 판정 흐름은 OpenAI tool call을 사용하므로, 이 동작은 토큰 한도와 폴백을 검증하는 용도입니다. 공유 트래픽 무료 토큰 적용 여부는 OpenAI Usage Dashboard에서 별도로 확인해야 합니다.

처음부터 `gpt-5.4-mini`만 사용하려면 다음 모드를 선택합니다:

```bash
OPENAI_MODE=mini_only
```

---

## 테스트 명령어

### 1. 도움말 (`/help`)

플레이 중 가능한 행동 예시와 명령어 목록을 다시 확인합니다.

- **사용법**: `/help`

### 2. 수동 주사위 굴림 (`/roll`)

AI 없이 주사위 굴림 로직(`DiceRoller`)만 테스트합니다.

- **사용법**: `/roll <주사위식>`
- **예시**:
  - `/roll 1d20`
  - `/roll 2d6+3`
  - `/roll 1d8-1`

### 3. AI 함수 호출 테스트 (`/test_ai`)

AI가 함수(`roll_dice`)를 호출하는 과정을 시뮬레이션합니다. AI가 실제로 응답하는 것처럼 가장하여 시스템이 함수 호출 요청을 감지하고 처리하는지 확인합니다.

- **사용법**: `/test_ai`
- **검증 포인트**:
  - 로그에 `[DEBUG] AI 응답 유형: function_call`이 표시되는지 확인.
  - `📋 Warden의 처리 요청: roll_dice` 메시지가 뜨는지 확인.
  - 주사위가 굴려지고 결과가 나오는지 확인.

### 4. 시나리오 생성 테스트 (`/scenario`)

AI(또는 모의 AI)가 랜덤한 위기 상황을 제시하고, 즉시 주사위 굴림을 요청하는 전체 플로우를 테스트합니다.

- **사용법**: `/scenario`
- **동작 방식**:
  1. **API 키가 있는 경우**: 설정한 AI 공급자(OpenAI 또는 Gemini)가 실제 상황을 생성하고 함수를 호출합니다.
  2. **API 키가 없는 경우 (오프라인)**: 시스템이 자동으로 **Mock 시나리오**(고블린 매복)를 실행하여 플로우를 검증합니다.
- **검증 포인트**:
  - 상황 묘사("고블린이 튀어나와...")가 출력되는지 확인.
  - 시스템이 자동으로 `roll_dice`를 호출하여 주사위를 굴리는지 확인.
  - 결과에 따른 묘사가 이어지는지 확인.

---

## 디버그 로그 설명

테스트 중 다음과 같은 로그를 통해 내부 동작을 확인할 수 있습니다:

- `[DEBUG] AI 응답 유형: function_call`: AI(또는 Mock)가 함수 호출을 요청했음을 의미합니다.
- `[DEBUG] OpenAI Raw Function Call: roll_dice`: 실제 OpenAI API가 함수 호출을 반환했음을 의미합니다.
- `[DEBUG] Gemini Raw Function Call: roll_dice`: 실제 Gemini API가 함수 호출을 반환했음을 의미합니다.
