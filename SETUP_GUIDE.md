# Project RT: Cairn RPG AI GM Bot - Minimal Test Setup

## 프로젝트 구조

```
rt-test/
├── package.json
├── .env.example
├── .env (gitignore)
├── index.js
├── lib/
│   ├── geminiClient.js
│   ├── diceRoller.js
│   └── promptBuilder.js
└── data/
    └── cairn-rules.md (Cairn 2e 룰 요약)
```

## 파일 설명

### 1. package.json

Node.js 프로젝트 메타데이터 및 의존성 정의

```json
{
  "name": "rt-test",
  "version": "0.1.0",
  "description": "Project RT: Cairn RPG AI GM - Minimal Test",
  "main": "index.js",
  "type": "module",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "@google/generative-ai": "^0.0.1",
    "dotenv": "^16.0.3"
  }
}
```

설치:
```bash
npm install
```

---

### 2. .env.example

환경 변수 템플릿

```
# Gemini API
GEMINI_API_KEY=your_api_key_here

# Test Mode
NODE_ENV=development
LOG_LEVEL=debug
```

`.env`로 복사 후 API 키 입력:
```bash
cp .env.example .env
# .env 파일을 편집하여 GEMINI_API_KEY 설정
```

---

### 3. index.js (메인 진입점)

게임 루프 및 플레이어 상호작용 처리

```javascript
import readline from "readline";
import dotenv from "dotenv";
import { GeminiClient } from "./lib/geminiClient.js";
import { DiceRoller } from "./lib/diceRoller.js";
import { PromptBuilder } from "./lib/promptBuilder.js";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is not set in .env file");
  process.exit(1);
}

// Initialize components
const gemini = new GeminiClient(GEMINI_API_KEY);
const dice = new DiceRoller();
const promptBuilder = new PromptBuilder();

// Session state
let sessionState = {
  messages: [],
  characterHP: 10,
  characterName: "Unnamed Adventurer",
  currentScene: "A misty forest path",
};

// Main game loop
async function gameLoop() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n========================================");
  console.log("   Project RT: Cairn RPG AI GM Test   ");
  console.log("========================================\n");
  console.log(`📖 Scene: ${sessionState.currentScene}`);
  console.log(`❤️  HP: ${sessionState.characterHP}\n`);
  console.log('Type your action (or "quit" to exit):\n');

  const askQuestion = () => {
    rl.question("> ", async (userInput) => {
      if (userInput.toLowerCase() === "quit") {
        console.log("\n👋 Game ended.");
        rl.close();
        return;
      }

      try {
        await handlePlayerAction(userInput);
        console.log("\n---\n");
        askQuestion(); // Continue loop
      } catch (error) {
        console.error("❌ Error:", error.message);
        askQuestion();
      }
    });
  };

  askQuestion();
}

// Handle player action
async function handlePlayerAction(playerInput) {
  console.log("\n🤔 Warden is thinking...\n");

  // Add player message to session
  sessionState.messages.push({
    role: "player",
    content: playerInput,
  });

  // Build prompt with context
  const prompt = promptBuilder.build(sessionState, playerInput);

  // Call Gemini
  const response = await gemini.generateWithFunctionCalling(prompt);

  // Parse response
  if (response.type === "function_call") {
    // AI wants to roll dice
    console.log(`\n📋 Warden requests: ${response.functionName}`);

    let functionResult;

    if (response.functionName === "roll_dice") {
      const diceExpr = response.args.dice_expression;
      const reason = response.args.reason;

      const rollResult = dice.roll(diceExpr);

      console.log(`\n🎲 ${reason}`);
      console.log(`   Expression: ${diceExpr}`);
      console.log(`   Rolls: [${rollResult.rolls.join(", ")}]`);
      console.log(`   Total: ${rollResult.total}`);

      functionResult = rollResult.total;

      // Add function call and result to message history
      sessionState.messages.push({
        role: "warden",
        type: "function_call",
        function: "roll_dice",
        args: response.args,
        result: functionResult,
      });
    } else if (response.functionName === "update_hp") {
      const amount = response.args.amount;
      sessionState.characterHP += amount; // negative = damage
      console.log(`\n❤️ HP changed by ${amount}. Current HP: ${sessionState.characterHP}`);

      sessionState.messages.push({
        role: "warden",
        type: "function_call",
        function: "update_hp",
        args: response.args,
        result: sessionState.characterHP,
      });
    }
  } else if (response.type === "narrative") {
    // AI response is pure narrative
    console.log(`\n📖 Warden: ${response.content}`);
    sessionState.messages.push({
      role: "warden",
      type: "narrative",
      content: response.content,
    });
  }
}

// Start game
gameLoop().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

**주요 기능:**
- 플레이어 입력 받기
- Gemini로부터 응답 생성
- 함수 호출 처리 (주사위 굴림, HP 업데이트)
- 게임 상태 추적

---

### 4. lib/geminiClient.js

Google Gemini API와의 통신

```javascript
import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiClient {
  constructor(apiKey) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = this.client.getGenerativeModel({ model: "gemini-pro" });
  }

  async generate(prompt) {
    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error("Gemini API error:", error.message);
      throw error;
    }
  }

  async generateWithFunctionCalling(prompt) {
    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text();

      // Parse function calls from response
      // Format: [FUNCTION_CALL: functionName {"arg1": value1, ...}]
      const functionCallMatch = text.match(
        /\[FUNCTION_CALL: (\w+) ({.*?})\]/
      );

      if (functionCallMatch) {
        return {
          type: "function_call",
          functionName: functionCallMatch[1],
          args: JSON.parse(functionCallMatch[2]),
        };
      }

      return {
        type: "narrative",
        content: text,
      };
    } catch (error) {
      console.error("Gemini API error:", error.message);
      throw error;
    }
  }
}
```

**주요 메서드:**
- `generate(prompt)`: 기본 생성
- `generateWithFunctionCalling(prompt)`: 함수 호출 지원

---

### 5. lib/diceRoller.js

주사위 굴림 엔진

```javascript
export class DiceRoller {
  roll(expression) {
    const parsed = this.parse(expression);
    const { count, sides, modifier } = parsed;

    const rolls = [];
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1);
    }

    const total = rolls.reduce((sum, roll) => sum + roll, 0) + modifier;

    return {
      expression,
      rolls,
      modifier,
      total,
    };
  }

  parse(expression) {
    // Parse formats: d20, 2d6, d8+3, 3d6-1
    const match = expression.match(/^(\d*)d(\d+)(([+-])(\d+))?$/i);

    if (!match) {
      throw new Error(`Invalid dice expression: ${expression}`);
    }

    const count = match[1] ? parseInt(match[1]) : 1;
    const sides = parseInt(match[2]);
    const modifier = match[4] === "+" ? parseInt(match[5]) : -parseInt(match[5]) || 0;

    return { count, sides, modifier };
  }
}
```

**지원하는 표현식:**
- `d20`: 20면 주사위 1개
- `2d6`: 6면 주사위 2개
- `d8+3`: 8면 주사위 1개 + 3 보정
- `3d6-1`: 6면 주사위 3개 - 1 보정

---

### 6. lib/promptBuilder.js

Cairn 규칙 + 게임 상태를 포함한 프롬프트 생성

```javascript
export class PromptBuilder {
  build(sessionState, playerAction) {
    const systemPrompt = `당신은 Cairn RPG의 Warden(게임 마스터)입니다.

## Cairn RPG 핵심 규칙:
- 판정: 2d6로 7 이상 성공
- 전투 라운드: 6초
- 피해: 플레이어가 해치는 경우 적이 HP 손실
- 게임은 즉흥적이고 상황적입니다.

## 현재 게임 상태:
- 캐릭터 이름: ${sessionState.characterName}
- 현재 HP: ${sessionState.characterHP}
- 현재 장면: ${sessionState.currentScene}

## 메시지 히스토리:
${sessionState.messages.map((m) => `${m.role}: ${m.content}`).join("\n")}

## 플레이어 액션:
${playerAction}

## 응답 형식:
1. 순수 내러티브인 경우: [NARRATIVE] 내용
2. 주사위가 필요한 경우: [FUNCTION_CALL: roll_dice {"dice_expression": "2d6", "reason": "이유"}]
3. HP 업데이트가 필요한 경우: [FUNCTION_CALL: update_hp {"amount": -3, "reason": "피해"}]
`;

    return systemPrompt;
  }
}
```

**프롬프트 구성:**
- Warden 역할 정의
- Cairn 규칙 요약
- 게임 상태 포함
- 메시지 히스토리
- 응답 형식 지정

---

## 🚀 실행 방법

### 1. 설치

```bash
npm install
cp .env.example .env
# .env 파일에 GEMINI_API_KEY 입력
```

### 2. 실행

```bash
npm start
```

### 3. 게임 플레이

```
========================================
   Project RT: Cairn RPG AI GM Test   
========================================

📖 Scene: A misty forest path
❤️  HP: 10

Type your action (or "quit" to exit):

> You cautiously approach the ruins

🤔 Warden is thinking...

📖 Warden: You notice the stone building is partially collapsed...
```

---

## 🧪 테스트

### 수동 테스트

```bash
node index.js
# 게임 플레이하며 기능 테스트
```

### 개별 컴포넌트 테스트

```bash
# DiceRoller 테스트
node -e "import { DiceRoller } from './lib/diceRoller.js'; const d = new DiceRoller(); console.log(d.roll('2d6+3'));"
```

---

## 📝 다음 단계

1. **Gemini 함수 호출 개선**: Tool use를 통한 더 구조화된 함수 호출
2. **상태 저장**: 게임 세션을 파일로 저장/복원
3. **더 많은 NPC**: 동적 NPC 생성
4. **웹 인터페이스**: 간단한 웹 UI 추가
5. **Discord 통합**: Discord 봇으로 실행

---

## 🔗 유용한 링크

- [Google Generative AI API](https://ai.google.dev/)
- [Cairn RPG 규칙](https://cairnrpg.com/)
- [Node.js 문서](https://nodejs.org/)
