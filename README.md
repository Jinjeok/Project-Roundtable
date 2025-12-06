# Project Round Table 🎲

**AI를 활용한 Cairn RPG 웹/디스코드 서비스**

Project Round Table는 대규모 언어 모델(LLM)을 활용하여 완전 자동화된 Cairn RPG 게임 마스터 봇을 구현하는 프로젝트입니다. 플레이어는 자연스럽고 동적인 게임 경험을 얻을 수 있으며, 시스템은 주사위 굴림, 규칙 해석, 동적 이야기 생성을 자동으로 처리합니다.

---

## 📋 프로젝트 개요

### 핵심 목표
- **LLM 기반 AI GM (Game Master)**: Google Gemini API를 활용한 고급 프롬프트 엔지니어링
- **Cairn 2e 규칙 시스템**: 정확한 규칙 구현 및 판정
- **다중 플랫폼 지원**: 웹 인터페이스 및 Discord 통합
- **상태 관리**: 게임 세션의 모든 데이터를 효율적으로 추적
- **함수 호출 통합**: LLM이 주사위 굴림, HP 업데이트 등을 독립적으로 관리

### 주요 기능
- ✅ **자동 주사위 굴림**: 다양한 다이스 표현식 지원 (d20, 2d6, d8+3 등)
- ✅ **동적 난이도 판정**: Cairn 2e 규칙에 따른 자동 판정
- ✅ **상태 추적**: 캐릭터 HP, 스태미나, 상태이상 관리
- ✅ **문맥 보존**: 게임 진행 중 메시지 히스토리 유지
- ✅ **LLM 함수 호출**: 구조화된 인터페이스를 통한 시스템 제어

---

## 🏗️ 프로젝트 구조

```
Project-Roundtable/
├── README.md                    # 프로젝트 문서
├── package.json                 # Node.js 의존성
├── .env.example                 # 환경 변수 템플릿
├── .env                         # 환경 변수 (gitignore)
│
├── index.js                     # 메인 진입점
│
├── lib/                         # 핵심 라이브러리
│   ├── geminiClient.js          # Google Gemini API 클라이언트
│   ├── diceRoller.js            # 주사위 굴림 엔진
│   ├── promptBuilder.js         # 프롬프트 구성 유틸리티
│   └── sessionManager.js        # 게임 세션 상태 관리
│
├── data/                        # 게임 데이터
│   └── cairn-rules.md           # Cairn 2e 규칙 요약
│
├── tests/                       # 테스트 코드
│   ├── gemini.test.js           # Gemini API 테스트
│   ├── dice.test.js             # 주사위 엔진 테스트
│   └── system.test.js           # 통합 시스템 테스트
│
└── docs/                        # 추가 문서
    ├── ARCHITECTURE.md          # 시스템 아키텍처
    ├── API_REFERENCE.md         # API 레퍼런스
    └── SETUP_GUIDE.md           # 셋업 가이드
```

---

## 🚀 빠른 시작

### 1. 환경 설정

#### 필수 조건
- Node.js 16.0.0 이상
- npm 또는 yarn
- Google Gemini API 키 ([여기서 발급받기](https://ai.google.dev/api))

#### 설치

```bash
# 1. 프로젝트 클론
git clone https://github.com/Jinjeok/Project-Roundtable.git
cd Project-Roundtable

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp .env.example .env
# .env 파일을 열어 GEMINI_API_KEY 입력
```

#### .env 파일 구성

```bash
# Google Gemini API
GEMINI_API_KEY=your_api_key_here

# 개발 모드
NODE_ENV=development
LOG_LEVEL=debug

# Discord (향후 지원)
DISCORD_TOKEN=your_discord_token_here
DISCORD_CHANNEL_ID=your_channel_id
```

### 2. 애플리케이션 실행

```bash
# 개발 모드 실행
npm start

# 또는 node로 직접 실행
node index.js
```

### 3. 게임 시작

```
========================================
   Project RT: Cairn RPG AI GM Test   
========================================

📖 Scene: A misty forest path
❤️  HP: 10

Type your action (or "quit" to exit):

> You cautiously approach the ruined building

🤔 Warden is thinking...

[AI GM이 상황을 묘사하고 필요시 주사위를 굴림]
```

---

## 📚 시스템 아키텍처

### 핵심 컴포넌트

#### 1. **GeminiClient** (`lib/geminiClient.js`)
- Google Generative AI API와의 통신
- 함수 호출 기반 상호작용
- 프롬프트 전송 및 응답 파싱

#### 2. **DiceRoller** (`lib/diceRoller.js`)
- 다양한 주사위 표현식 해석
- 확률적으로 정확한 주사위 굴림
- Cairn 규칙에 맞는 판정 시스템

**지원되는 다이스 표현식:**
- `d20`: 20면체 1개
- `2d6`: 6면체 2개
- `d8+3`: 8면체 1개 + 3 보정
- `3d6-1`: 6면체 3개 - 1 보정

#### 3. **PromptBuilder** (`lib/promptBuilder.js`)
- Cairn 2e 규칙 컨텍스트 추가
- 게임 상태 통합
- 플레이어 액션 포맷팅
- 함수 호출 스키마 추가

#### 4. **SessionManager** (`lib/sessionManager.js`)
- 게임 세션 상태 추적
- 메시지 히스토리 관리
- 캐릭터 데이터 저장
- 세션 지속성 구현

---

## 🔧 API 레퍼런스

### GeminiClient

```javascript
const gemini = new GeminiClient(apiKey);

// 기본 생성
const response = await gemini.generate(prompt);

// 함수 호출 지원
const response = await gemini.generateWithFunctionCalling(prompt, functions);
```

### DiceRoller

```javascript
const dice = new DiceRoller();

// 주사위 굴림
const result = dice.roll('2d6+3');
// { rolls: [4, 5], total: 12 }

// 파싱
const parsed = dice.parse('d20');
// { count: 1, sides: 20, modifier: 0 }
```

### PromptBuilder

```javascript
const builder = new PromptBuilder();

const prompt = builder.build(sessionState, playerAction);
// Cairn 규칙 + 게임 상태 + 플레이어 액션 포함
```

---

## 🧪 테스트

### 단위 테스트 실행

```bash
# 전체 테스트
npm test

# 특정 테스트 파일
npm test -- tests/dice.test.js

# 커버리지 리포트
npm test -- --coverage
```

### 수동 테스트

```bash
# 대화형 게임 세션
node index.js

# 특정 기능 테스트
node tests/manual/test-dice.js
node tests/manual/test-gemini.js
```

---

## 📖 게임 규칙 (Cairn 2e)

### 기본 메커니즘

**주사위 판정:**
- 일반 행동: 2d6 판정 (7 이상 성공)
- 전투: 1d20 판정 (적에게 유리/불리한 상황 반영)
- 저항: 해당 스탯 + 2d6

**캐릭터 속성:**
- HP: 생명력 (기본 10)
- Armor: 방어도 (0~3)
- STR/DEX/WIL: 주요 속성

**전투 시스템:**
- 라운드 제도 (6초)
- 초제 (initiative) 판정
- 행동 (Action) → 판정 → 결과

### AI GM의 역할
1. 상황 묘사
2. 판정 필요 상황 감지
3. 주사위 굴림 요청
4. 결과에 따른 스토리텔링

---

## 🤝 기여

### 기여 방법

1. Fork the repository
2. Feature branch 생성 (`git checkout -b feature/AmazingFeature`)
3. 커밋 (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### 코딩 표준
- ESLint 설정 준수
- 함수 주석 필수
- 테스트 커버리지 80% 이상

---

## 🗺️ 로드맵

### Phase 1: Core (현재)
- [x] Gemini API 통합
- [x] 주사위 엔진
- [ ] 기본 게임 루프
- [ ] 세션 저장/로드

### Phase 2: 웹 인터페이스
- [ ] React 기반 UI
- [ ] 실시간 업데이트 (WebSocket)
- [ ] 캐릭터 시트 표시
- [ ] 게임 로그

### Phase 3: Discord 통합
- [ ] Discord.js 봇
- [ ] 채팅 인터페이스
- [ ] 멀티 채널 지원

### Phase 4: 고급 기능
- [ ] 다중 인물(NPC) 제어
- [ ] 역사 추적
- [ ] 다른 RPG 시스템 지원

---

## ⚙️ 환경 변수 상세

| 변수명 | 설명 | 필수 | 기본값 |
|--------|------|------|--------|
| `GEMINI_API_KEY` | Google Gemini API 키 | ✅ | - |
| `NODE_ENV` | 실행 환경 (development/production) | ❌ | development |
| `LOG_LEVEL` | 로그 레벨 (debug/info/warn/error) | ❌ | info |
| `DISCORD_TOKEN` | Discord 봇 토큰 | ❌ | - |
| `DISCORD_CHANNEL_ID` | 기본 Discord 채널 ID | ❌ | - |

---

## 📝 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능

---

## 🔗 유용한 링크

- [Google Gemini API 문서](https://ai.google.dev/)
- [Cairn RPG 공식 사이트](https://cairnrpg.com/)
- [Discord.js 문서](https://discord.js.org/)

---

## 📧 연락처

- **GitHub Issues**: [버그 리포트 및 기능 요청](https://github.com/Jinjeok/Project-Roundtable/issues)
- **프로젝트 유지보수**: Jinjeok

---

**Made with ❤️ for TRPG enthusiasts and AI lovers**
