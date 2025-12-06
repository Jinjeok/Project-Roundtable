/**
 * 🎲 Dice Roller Test - 주사위 함수 직접 테스트
 * 
 * 사용법: node tests/manual/test-dice.js
 * 
 * Cairn 2e 게임 규칙의 주사위 판정 시스템 테스트
 */

import { DiceRoller } from '../../lib/diceRoller.js';

const dice = new DiceRoller();

console.log('\n' + '='.repeat(60));
console.log('  🎲 Project RT: Dice Roller Test Suite');
console.log('='.repeat(60) + '\n');

// Test 1: 기본 주사위 굴림 (2d6)
console.log('📋 Test 1: 기본 주사위 굴림 (2d6)');
console.log('-'.repeat(60));
const result1 = dice.roll('2d6');
console.log(`표현식: 2d6`);
console.log(`개별 결과: [${result1.rolls.join(', ')}]`);
console.log(`합계: ${result1.total}`);
console.log(`성공 판정 (7 이상): ${result1.total >= 7 ? '✅ 성공' : '❌ 실패'}\n`);

// Test 2: 전투 주사위 (1d20)
console.log('📋 Test 2: 전투 주사위 (1d20)');
console.log('-'.repeat(60));
const result2 = dice.roll('1d20');
console.log(`표현식: 1d20`);
console.log(`개별 결과: [${result2.rolls.join(', ')}]`);
console.log(`합계: ${result2.total}`);
console.log(`크리티컬 (20): ${result2.total === 20 ? '🎯 크리티컬!' : 'N/A'}\n`);

// Test 3: 저항 판정 (1d6 + 보정)
console.log('📋 Test 3: 저항 판정 (1d6 + STR 3)');
console.log('-'.repeat(60));
const result3 = dice.roll('1d6');
const strModifier = 3;
const resistTotal = result3.total + strModifier;
console.log(`표현식: 1d6`);
console.log(`개별 결과: [${result3.rolls.join(', ')}]`);
console.log(`기본값: ${result3.total}`);
console.log(`STR 보정: +${strModifier}`);
console.log(`최종값: ${resistTotal}\n`);

// Test 4: 여러 주사위 (3d8 - 데미지)
console.log('📋 Test 4: 다중 주사위 굴림 (3d8 - 데미지)');
console.log('-'.repeat(60));
const result4 = dice.roll('3d8');
console.log(`표현식: 3d8`);
console.log(`개별 결과: [${result4.rolls.join(', ')}]`);
console.log(`합계 데미지: ${result4.total}\n`);

// Test 5: 복합 표현식 (2d6+1d4)
console.log('📋 Test 5: 복합 표현식 (2d6 + 1d4)');
console.log('-'.repeat(60));
const result5 = dice.roll('2d6+1d4');
console.log(`표현식: 2d6+1d4`);
console.log(`개별 결과: [${result5.rolls.join(', ')}]`);
console.log(`합계: ${result5.total}\n`);

// Test 6: 큰 수의 주사위 (10d20)
console.log('📋 Test 6: 큰 수의 주사위 (10d20)');
console.log('-'.repeat(60));
const result6 = dice.roll('10d20');
console.log(`표현식: 10d20`);
console.log(`개별 결과: [${result6.rolls.join(', ')}]`);
console.log(`합계: ${result6.total}`);
console.log(`평균값: ${(result6.total / result6.rolls.length).toFixed(2)}\n`);

// Test 7: 통계 테스트 - 1d6 100회
console.log('📋 Test 7: 통계 테스트 (1d6 × 100회)');
console.log('-'.repeat(60));
const stats = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
let totalSum = 0;
for (let i = 0; i < 100; i++) {
  const result = dice.roll('1d6');
  stats[result.total]++;
  totalSum += result.total;
}
console.log('분포:');
for (const [face, count] of Object.entries(stats)) {
  const percentage = (count / 100 * 100).toFixed(1);
  const bar = '█'.repeat(Math.floor(count / 3));
  console.log(`  ${face}: ${bar} ${count}회 (${percentage}%)`);
}
console.log(`\n평균: ${(totalSum / 100).toFixed(2)}`);
console.log(`이론값: 3.5\n`);

// Test 8: Cairn 2e 일반 판정
console.log('📋 Test 8: Cairn 2e 일반 판정 시뮬레이션');
console.log('-'.repeat(60));
const scenarios = [
  { name: '쉬운 작업', dice: '2d6', minSuccess: 5 },
  { name: '보통 작업', dice: '2d6', minSuccess: 7 },
  { name: '어려운 작업', dice: '2d6', minSuccess: 9 },
  { name: '전투 - 근접', dice: '1d20', minSuccess: 11 },
  { name: '전투 - 마법', dice: '1d20', minSuccess: 13 }
];

scenarios.forEach(scenario => {
  const result = dice.roll(scenario.dice);
  const success = result.total >= scenario.minSuccess;
  const status = success ? '✅ 성공' : '❌ 실패';
  console.log(`${scenario.name}: ${result.total} ${status}`);
});

console.log('\n' + '='.repeat(60));
console.log('  ✨ 모든 테스트 완료!');
console.log('='.repeat(60) + '\n');
