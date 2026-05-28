import readline from "readline";
import dotenv from "dotenv";
import { GeminiClient } from "./lib/geminiClient.js";
import { OpenAIClient } from "./lib/openaiClient.js";
import { DailyTokenBudget } from "./lib/dailyTokenBudget.js";
import { DiceRoller } from "./lib/diceRoller.js";
import { PromptBuilder } from "./lib/promptBuilder.js";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const AI_PROVIDER = (
  process.env.AI_PROVIDER ||
  (OPENAI_API_KEY && !OPENAI_API_KEY.includes("your_api_key") ? "openai" : "gemini")
).toLowerCase();
const OPENAI_MODE = (process.env.OPENAI_MODE || "gpt54_then_mini").toLowerCase();
const GPT54_MODEL = "gpt-5.4";
const GPT54_MINI_MODEL = "gpt-5.4-mini";
const OPENAI_GPT54_DAILY_TOKEN_LIMIT = Number.parseInt(
  process.env.OPENAI_GPT54_DAILY_TOKEN_LIMIT || "250000",
  10
);
const OPENAI_MAX_OUTPUT_TOKENS = Number.parseInt(
  process.env.OPENAI_MAX_OUTPUT_TOKENS || "2048",
  10
);
const OPENAI_USAGE_TIME_ZONE = process.env.OPENAI_USAGE_TIME_ZONE || "UTC";
const OPENAI_USAGE_FILE =
  process.env.OPENAI_USAGE_FILE || ".data/openai-gpt-5.4-token-usage.json";

if (!["openai", "gemini"].includes(AI_PROVIDER)) {
  throw new Error("AI_PROVIDER must be either 'openai' or 'gemini'.");
}

if (!["gpt54_then_mini", "mini_only"].includes(OPENAI_MODE)) {
  throw new Error("OPENAI_MODE must be either 'gpt54_then_mini' or 'mini_only'.");
}

const selectedApiKey =
  AI_PROVIDER === "openai" ? OPENAI_API_KEY : GEMINI_API_KEY;

let aiEnabled = true;
if (!selectedApiKey || selectedApiKey.includes("your_api_key")) {
  const requiredKey =
    AI_PROVIDER === "openai" ? "OPENAI_API_KEY" : "GEMINI_API_KEY";
  console.warn(`⚠️  ${requiredKey}가 설정되지 않았거나 유효하지 않습니다. AI 기능이 비활성화됩니다.`);
  console.warn("   /roll 명령으로 주사위 기능은 사용할 수 있습니다.");
  aiEnabled = false;
}

// Initialize components
const openAITokenBudget = new DailyTokenBudget({
  limit: OPENAI_GPT54_DAILY_TOKEN_LIMIT,
  filePath: OPENAI_USAGE_FILE,
  timeZone: OPENAI_USAGE_TIME_ZONE,
});
const aiClient = aiEnabled
  ? AI_PROVIDER === "openai"
    ? new OpenAIClient(
        OPENAI_API_KEY,
        OPENAI_MODE === "gpt54_then_mini" ? GPT54_MODEL : GPT54_MINI_MODEL,
        {
          tokenBudget:
            OPENAI_MODE === "gpt54_then_mini" ? openAITokenBudget : null,
          fallbackModel:
            OPENAI_MODE === "gpt54_then_mini" ? GPT54_MINI_MODEL : null,
          maxOutputTokens: OPENAI_MAX_OUTPUT_TOKENS,
        }
      )
    : new GeminiClient(GEMINI_API_KEY)
  : null;
const dice = new DiceRoller();
const promptBuilder = new PromptBuilder();

// Session state
let sessionState = {
  messages: [],
  characterHP: 10,
  characterName: "이름 없는 방랑자",
  currentScene: "안개가 자욱한 숲길, 폐허가 된 예배당 앞",
};

function printHelp() {
  console.log("\n도움말");
  console.log("  하고 싶은 행동을 자유롭게 입력하면 Warden이 결과를 진행합니다.");
  console.log('  예: "문에 귀를 대고 안쪽 소리를 듣는다"');
  console.log('  예: "등불을 켜고 예배당 안으로 들어간다"');
  console.log('  예: "돌아가라는 목소리의 정체를 묻는다"\n');
  console.log("명령어");
  console.log("  /help        이 도움말을 표시합니다.");
  console.log("  /scenario    즉시 위험한 사건을 하나 생성합니다.");
  console.log("  /roll 1d20  주사위를 직접 굴립니다.");
  console.log("  /test_ai     AI 함수 호출 흐름을 모의 테스트합니다.");
  console.log("  quit         게임을 종료합니다.");
}

function printPrologue() {
  console.log("프롤로그");
  console.log("  길을 잃은 지 사흘째 밤, 축축한 안개 사이로 무너진 예배당이 모습을 드러냅니다.");
  console.log("  문은 반쯤 열려 있고, 안쪽 어둠 속에서 약한 불빛이 한 번 깜빡입니다.");
  console.log('  그때, 어딘가에서 낮은 목소리가 들립니다. "돌아가라. 아직 늦지 않았다."');
  console.log("\n무엇을 하시겠습니까?");
  console.log("  1. 문틈으로 안을 살펴본다.");
  console.log("  2. 목소리의 주인에게 말을 건다.");
  console.log("  3. 무기를 꺼내 들고 예배당으로 들어간다.");
  console.log("\n원하시는 행동을 문장으로 입력해 주세요. 명령어 안내는 /help 입니다.\n");
}

// Main game loop
async function gameLoop() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n========================================");
  console.log("          Project Round Table         ");
  console.log("========================================\n");
  console.log(`🤖 AI 공급자: ${aiEnabled ? AI_PROVIDER : "오프라인"}\n`);
  if (aiEnabled && AI_PROVIDER === "openai") {
    console.log(`🤖 OpenAI 모드: ${OPENAI_MODE}\n`);
    if (OPENAI_MODE === "gpt54_then_mini") {
      console.log(
        `🔒 ${GPT54_MODEL} 일일 토큰 한도: ${OPENAI_GPT54_DAILY_TOKEN_LIMIT.toLocaleString()} (이후 ${GPT54_MINI_MODEL})\n`
      );
    }
  }
  console.log(`📖 현재 장면: ${sessionState.currentScene}`);
  console.log(`❤️  HP: ${sessionState.characterHP}\n`);
  printPrologue();

  const askQuestion = () => {
    rl.question("> ", async (userInput) => {
      const normalizedInput = userInput.trim().toLowerCase();

      if (normalizedInput === "quit") {
        console.log("\n👋 모험을 종료합니다.");
        rl.close();
        return;
      }

      if (normalizedInput === "/help" || normalizedInput === "help") {
        printHelp();
        console.log("\n---\n");
        askQuestion();
        return;
      }

      // Manual dice roll command
      if (normalizedInput.startsWith("/roll ")) {
        const expression = userInput.substring(6).trim();
        try {
          const result = dice.roll(expression);
          console.log(`\n🎲 직접 굴림: ${expression}`);
          console.log(`   결과: [${result.rolls.join(", ")}]`);
          console.log(`   합계: ${result.total}`);
        } catch (e) {
          console.error(`❌ 잘못된 주사위 식입니다: ${e.message}`);
        }
        console.log("\n---\n");
        askQuestion();
        return;
      }

      // Mock AI command
      if (normalizedInput === "/test_ai") {
        console.log("\n🤖 AI 함수 호출을 모의 실행합니다...");
        const mockResponse = {
          type: "function_call",
          functionName: "roll_dice",
          args: {
            dice_expression: "1d20",
            reason: "모의 판정 굴림",
          },
        };
        await processAiResponse(mockResponse);
        console.log("\n---\n");
        askQuestion();
        return;
      }

      // Scenario Generation Command
      if (normalizedInput === "/scenario") {
        console.log("\n🎲 위기 상황을 생성합니다...");

        const runMockScenario = async () => {
           console.log("⚠️  AI를 사용할 수 없어 모의 상황을 진행합니다.");
           const mockScenarioResponse = {
             type: "function_call",
             functionName: "roll_dice",
             args: {
               dice_expression: "1d20",
               reason: "모의 상황: 고블린의 기습 (DEX 내성)",
             },
           };
           // Simulate a brief delay
           await new Promise(r => setTimeout(r, 1000));
           console.log("\n📖 Warden: 갑자기 숲에서 고블린이 튀어나와 단검을 휘두릅니다! DEX(민첩) 내성 굴림을 합니다.");
           await processAiResponse(mockScenarioResponse);
        };
        
        if (!aiEnabled) {
           await runMockScenario();
           console.log("\n---\n");
           askQuestion();
           return;
        }

        try {
          const prompt = promptBuilder.buildScenarioPrompt(sessionState);
          const response = await aiClient.generateWithFunctionCalling(prompt);
          await processAiResponse(response);
        } catch (error) {
          console.error("❌ 상황 생성 중 오류가 발생했습니다:", error.message);
          console.log("🔄 모의 상황으로 전환합니다...");
          await runMockScenario();
        }
        console.log("\n---\n");
        askQuestion();
        return;
      }

      try {
        if (!aiEnabled) {
          console.log("\n⚠️  AI 기능이 꺼져 있어 행동 진행은 할 수 없습니다.");
          console.log("   API 키를 .env에 설정하거나 /help로 테스트 명령을 확인해 주세요.");
          console.log("\n---\n");
          askQuestion();
          return;
        }

        await handlePlayerAction(userInput);
        console.log("\n---\n");
        askQuestion(); // Continue loop
      } catch (error) {
        console.error("❌ 진행 중 오류가 발생했습니다:", error.message);
        askQuestion();
      }
    });
  };

  askQuestion();
}

// Handle player action
async function handlePlayerAction(playerInput) {
  console.log("\n🤔 Warden이 상황을 판단하고 있습니다...\n");

  // Add player message to session
  sessionState.messages.push({
    role: "player",
    content: playerInput,
  });

  // Build prompt with context
  const prompt = promptBuilder.build(sessionState, playerInput);

  // Call the configured AI provider.
  const response = await aiClient.generateWithFunctionCalling(prompt);

  await processAiResponse(response);
}

// Process AI response (Real or Mock)
async function processAiResponse(response) {
  console.log(`\n[DEBUG] AI 응답 유형: ${response.type}`);
  
  // Parse response
  if (response.type === "function_call") {
    // AI wants to roll dice
    console.log(`\n📋 Warden의 처리 요청: ${response.functionName}`);

    let functionResult;

    if (response.functionName === "roll_dice") {
      const diceExpr = response.args.dice_expression;
      const reason = response.args.reason;

      const rollResult = dice.roll(diceExpr);

      console.log(`\n🎲 ${reason}`);
      console.log(`   주사위 식: ${diceExpr}`);
      console.log(`   결과: [${rollResult.rolls.join(", ")}]`);
      console.log(`   합계: ${rollResult.total}`);

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
        `\n❤️  HP 변화: ${amount > 0 ? "+" : ""}${amount}`
      );
      console.log(`   현재 HP: ${sessionState.characterHP}`);

      functionResult = sessionState.characterHP;

      sessionState.messages.push({
        role: "warden",
        type: "function_call",
        function: "update_hp",
        args: response.args,
        result: functionResult,
      });
    }

    // Re-prompt the provider with the function result.
    const followUpPrompt = promptBuilder.buildFollowUp(
      sessionState,
      response.functionName,
      functionResult
    );

    let finalResponseText;
    if (aiClient) {
      finalResponseText = await aiClient.generateText(followUpPrompt);
    } else {
      finalResponseText = "[모의 진행] 주사위 결과에 따라 행동이 처리되었습니다.";
    }

    console.log(`\n📖 Warden의 묘사:\n${finalResponseText}`);

    // Add final response to session
    sessionState.messages.push({
      role: "warden",
      content: finalResponseText,
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
