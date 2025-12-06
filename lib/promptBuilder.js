export class PromptBuilder {
  build(sessionState, playerInput) {
    const systemPrompt = `당신은 테이블탑 RPG "Cairn 2e"의 Warden(게임 마스터)입니다.

중요 규칙:
- 공격: 명중 굴림 없음. 피해 주사위를 즉시 굴림 (소형 d6, 중형 d8, 대형 d10).
- 내성 굴림(Save): 능력치(STR, DEX, WIL) 아래로 1d20을 굴려 성공해야 함.
- 죽음: HP가 0이 되면 즉시 죽지 않고 '흉터(Scar)'를 입음.
- 전투는 치명적이고 전술적임. 적의 전술과 환경적 위험을 항상 고려할 것.
- 풍부한 묘사: 장면을 생생하게 묘사하되 간결하게 할 것.
- **모든 응답은 한국어로 작성할 것.**

함수 호출 시점:
1. 주사위 굴림이 기계적으로 필요한 경우 (내성 굴림, 피해량, 능력 판정 등).
2. 피해나 치유로 인한 HP 변화.
3. **절대로 주사위 결과를 스스로 지어내지 말 것.** 함수를 호출하고 결과를 기다릴 것.

현재 장면: ${sessionState.currentScene}
캐릭터 HP: ${sessionState.characterHP}

최근 대화:
${sessionState.messages
  .slice(-10) // Last 10 messages
  .map((m) => {
    if (m.type === "function_call") {
      return `[함수 호출] ${m.function}: ${JSON.stringify(m.args)} -> 결과: ${m.result}`;
    }
    return `${m.role === "player" ? "플레이어" : "Warden"}: ${m.content}`;
  })
  .join("\n")}

플레이어 행동: ${playerInput}

Warden으로서 응답하세요. 판정이나 굴림이 필요하면 적절한 함수를 호출하세요.`;

    return systemPrompt;
  }

  buildFollowUp(sessionState, functionName, result) {
    const followUpPrompt = `[함수 결과]
함수: ${functionName}
결과: ${result}

이 결과를 바탕으로 어떤 일이 일어나는지 묘사하세요. 생생하지만 간결하게. 필요하다면 현재 장면을 업데이트하세요.
**반드시 한국어로 응답하세요.**`;

    return followUpPrompt;
  }

  buildScenarioPrompt(sessionState) {
    return `당신은 Cairn RPG의 Warden입니다.
플레이어를 위한 **랜덤한 위기 상황**을 하나 생성하세요.
이 상황은 **반드시** 플레이어의 즉각적인 반응과 **주사위 굴림(함수 호출)**을 필요로 해야 합니다.

예시:
- "갑자기 숲에서 고블린이 튀어나와 단검을 휘두릅니다! DEX(민첩) 내성 굴림을 하세요." (roll_dice 호출 필요)
- "오래된 다리가 무너집니다! STR(힘) 내성 굴림으로 버티세요." (roll_dice 호출 필요)

**지시사항:**
1. 짧고 긴박한 상황을 묘사하세요.
2. **즉시** \`roll_dice\` 함수를 호출하여 판정을 진행하세요. (플레이어의 입력을 기다리지 마세요)
3. **한국어로 응답하세요.**

현재 장면: ${sessionState.currentScene}
캐릭터 HP: ${sessionState.characterHP}`;
  }
}
