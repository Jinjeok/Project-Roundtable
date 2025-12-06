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

## 파일 1: package.json

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

## 파일 2: .env.example

```
# Gemini API
GEMINI_API_KEY=your_api_key_here

# Test Mode
NODE_ENV=development
LOG_LEVEL=debug
```

`.env`로 복사 후 API 키 입력.

---

## 파일 3: index.js (메인 진입점)

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

      console.log(
        `\n❤️  HP changed by ${amount > 0 ? "+" : ""}${amount}`
      );
      console.log(`   Current HP: ${sessionState.characterHP}`);

      functionResult = sessionState.characterHP;

      sessionState.messages.push({
        role: "warden",
        type: "function_call",
        function: "update_hp",
        args: response.args,
        result: functionResult,
      });
    }

    // Re-prompt Gemini with function result
    const followUpPrompt = promptBuilder.buildFollowUp(
      sessionState,
      response.functionName,
      functionResult
    );

    const finalResponse = await gemini.generateText(followUpPrompt);

    console.log(`\n📖 Warden's description:\n${finalResponse}`);

    // Add final response to session
    sessionState.messages.push({
      role: "warden",
      content: finalResponse,
    });
  } else if (response.type === "text") {
    // AI responds with text only (no function call)
    console.log(`\n📖 Warden:\n${response.text}`);

    sessionState.messages.push({
      role: "warden",
      content: response.text,
    });
  }
}

// Start
gameLoop();
```

---

## 파일 4: lib/geminiClient.js

```javascript
import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiClient {
  constructor(apiKey) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = this.client.getGenerativeModel({
      model: "gemini-2.5-flash",
    });
  }

  async generateWithFunctionCalling(prompt) {
    const tools = {
      functionDeclarations: [
        {
          name: "roll_dice",
          description:
            "Roll dice when a judgment or damage calculation is needed. DO NOT generate results yourself.",
          parameters: {
            type: "OBJECT",
            properties: {
              dice_expression: {
                type: "STRING",
                description:
                  'Dice expression (e.g., "1d20", "1d8", "2d6+1")',
              },
              reason: {
                type: "STRING",
                description:
                  'Reason for the roll (e.g., "STR Save", "Sword Damage")',
              },
            },
            required: ["dice_expression", "reason"],
          },
        },
        {
          name: "update_hp",
          description:
            "Update character HP (negative value = damage, positive = healing)",
          parameters: {
            type: "OBJECT",
            properties: {
              amount: {
                type: "INTEGER",
                description: "Amount to change (e.g., -3 for 3 damage)",
              },
              reason: {
                type: "STRING",
                description: "Reason for HP change",
              },
            },
            required: ["amount", "reason"],
          },
        },
      ],
    };

    try {
      const response = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: tools,
      });

      const candidate = response.candidates[0];

      // Check for function calls
      for (const part of candidate.content.parts) {
        if (part.functionCall) {
          return {
            type: "function_call",
            functionName: part.functionCall.name,
            args: part.functionCall.args,
          };
        }
      }

      // Otherwise return text
      const textContent = candidate.content.parts
        .filter((p) => p.text)
        .map((p) => p.text)
        .join("");

      return {
        type: "text",
        text: textContent,
      };
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }

  async generateText(prompt) {
    try {
      const response = await this.model.generateContent(prompt);
      return response.response.text();
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }
}
```

---

## 파일 5: lib/diceRoller.js

```javascript
export class DiceRoller {
  roll(expression) {
    // Parse: "1d6", "2d8+1", etc.
    const match = expression.match(/^(\d+)d(\d+)([\+\-]\d+)?$/);

    if (!match) {
      throw new Error(`Invalid dice expression: ${expression}`);
    }

    const count = parseInt(match[1]);
    const sides = parseInt(match[2]);
    const modifier = match[3] ? parseInt(match[3]) : 0;

    const rolls = [];
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1);
    }

    const total = rolls.reduce((a, b) => a + b, 0) + modifier;

    return {
      expression,
      count,
      sides,
      modifier,
      rolls,
      total,
    };
  }
}
```

---

## 파일 6: lib/promptBuilder.js

```javascript
export class PromptBuilder {
  build(sessionState, playerInput) {
    const systemPrompt = `You are the Warden for the tabletop RPG game "Cairn 2e".

CRITICAL RULES:
- Attack: No to-hit roll. Damage die is rolled immediately (d6 for small weapons, d8 for medium, d10 for large).
- Save: Roll 1d20 under the target ability score to succeed (STR, DEX, WIL).
- Death: When HP reaches 0, the character takes a Scar instead of dying immediately.
- Combat is deadly and tactical. Always consider enemy tactics and environmental hazards.
- Rich description: Describe scenes vividly, but be concise.

WHEN TO CALL FUNCTION:
1. Any time a dice roll is mechanically required (saves, damage, ability checks).
2. HP changes from damage or healing.
3. DO NOT make up dice results. Call the function and wait for the result.

Current Scene: ${sessionState.currentScene}
Character HP: ${sessionState.characterHP}

Recent conversation:
${sessionState.messages
  .slice(-10) // Last 10 messages
  .map((m) => {
    if (m.type === "function_call") {
      return `[FUNCTION CALL] ${m.function}: ${JSON.stringify(m.args)} -> Result: ${m.result}`;
    }
    return `${m.role === "player" ? "Player" : "Warden"}: ${m.content}`;
  })
  .join("\n")}

Player action: ${playerInput}

Respond as the Warden. If a judgment or roll is needed, call the appropriate function.`;

    return systemPrompt;
  }

  buildFollowUp(sessionState, functionName, result) {
    const followUpPrompt = `[FUNCTION RESULT]
Function: ${functionName}
Result: ${result}

Based on this result, describe what happens. Be vivid but concise. Update the current scene if needed.`;

    return followUpPrompt;
  }
}
```

---

## 파일 7: data/cairn-rules.md (간단한 룰 요약)

```markdown
# Cairn 2e Core Rules Summary

## Ability Scores
- STR (Strength), DEX (Dexterity), WIL (Willpower)
- Range: 3-18 (generated as 3d6 each)

## Saves
Roll 1d20. Success if result is **equal to or LESS than** the target ability.
- STR Save: Resist physical damage, carry heavy load
- DEX Save: Dodge traps, avoid damage
- WIL Save: Resist mental effects, interact with magic

## Combat
1. No to-hit roll. Attacks always hit.
2. Attacker rolls weapon damage die immediately.
3. Weapon damage:
   - Small (d6): Dagger, Cudgel
   - Medium (d8): Sword, Mace, Spear
   - Large (d10): Halberd, War Hammer (bulky)
4. Defender reduces damage by Armor points (0-3).
5. Remaining damage is taken as HP loss.

## HP & Scars
- Base HP: 1d6 (range 1-6)
- At 0 HP: Take a Scar instead of dying. Roll on Scar table.
- Scars: Permanent injury effects (example: -1 STR, limping gait, etc.)

## Death
Death occurs when character is reduced to 0 HP a second time.

## Armor
- No Armor: 0 points
- Leather: 1 point
- Brigandine: 1 point (bulky)
- Chainmail: 2 points (bulky)
- Plate: 3 points (bulky)

## Actions in Combat
1. **Attack**: Declare target, roll damage
2. **Defend**: Grant +1 Armor temporarily
3. **Retreat**: Leave combat safely if path is clear
4. **Special**: Use item, cast spell, interact with environment

## Magic (Spells)
Spells are learned from Spellbooks. Casting requires carrying the book or memorizing (rare).
Example spells: Detect Magic, Control Plants, Chill

## Inventory
- 10 inventory slots total
- 4 slots comfortable (without bags)
- Bulky items (armor, weapons) take multiple slots
- Petty items (chalk, oil, etc.) take 0 slots

## Example Monsters
**Goblin:**
- HP: 3, STR 8, DEX 14, WIL 8
- Leather armor (1), Hand Axe (d6), Shield (1 armor when held)
- Tendency: Cowardly, greedy, tribal

**Orc:**
- HP: 6, STR 16, DEX 10, WIL 12
- Chainmail (2), Great Axe (d10, bulky)
- Tendency: Honorable, territorial, fierce
```

---

## 설치 및 실행

### Step 1: 프로젝트 폴더 생성

```bash
mkdir rt-test
cd rt-test
```

### Step 2: 파일 생성

위의 모든 파일을 복사해서 폴더에 생성합니다.

```bash
mkdir lib
mkdir data
```

### Step 3: 패키지 설치

```bash
npm install
```

### Step 4: .env 설정

`.env.example`을 `.env`로 복사:

```bash
cp .env.example .env
```

`.env`를 열어서 `GEMINI_API_KEY` 입력:

```
GEMINI_API_KEY=sk-proj-... (your actual key)
```

### Step 5: 실행

```bash
npm start
```

또는

```bash
node index.js
```

---

## 사용 예시

```
========================================
   Project RT: Cairn RPG AI GM Test   
========================================

📖 Scene: A misty forest path
❤️  HP: 10

Type your action (or "quit" to exit):

> 숲을 탐험해볼래. 뭐가 보여?

🤔 Warden is thinking...

📖 Warden's description:
안개 속에서 이상한 소리가 들립니다. 나뭇가지를 밟는 소리...

> 가까이 다가가볼래.

🤔 Warden is thinking...

📋 Warden requests: roll_dice

🎲 DEX Save (avoid ambush)
   Expression: 1d20
   Rolls: [14]
   Total: 14

📖 Warden's description:
당신은 민첩함으로 뒤로 몸을 날립니다. 그 순간 뭔가 날카로운 물건이 공중을 지나갑니다!
고블린 3마리가 숲 뒤에서 나타났습니다!

---
```

---

## 주의사항

1. **Gemini API Key**: `gemini-2.5-flash` (또는 `gemini-pro`)를 사용합니다.
2. **Context Window**: 메시지 10개까지만 유지 (토큰 절약).
3. **Function Calling**: 실제 작동하는지 확인하세요. 응답이 텍스트만 오면 함수 호출이 없는 것.
4. **오류**: API 키가 틀렸거나 네트워크가 끊기면 에러가 발생합니다.

---

## 다음 단계

- Discord 봇으로 확장 (Discord.js 통합)
- 실시간 마크다운 포맷팅 (Discord Embeds)
- 캐릭터 시트 저장/로드 (JSON 파일 또는 DB)
- 더 복잡한 룰북 통합
```
