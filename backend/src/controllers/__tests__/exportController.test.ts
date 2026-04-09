import { buildAutomaticSpeechBubbles } from '../exportController';
import { Panel } from '../../models/types';

describe('buildAutomaticSpeechBubbles', () => {
  it('splits multiline dialogue into multiple bubbles in panel order', () => {
    const panels = [
      makePanel(1, '二つ目のコマ'),
      makePanel(0, '一つ目\n二つ目'),
    ];

    expect(buildAutomaticSpeechBubbles(panels)).toEqual([
      { panelIndex: 0, text: '一つ目', position: 'top', style: 'rounded' },
      { panelIndex: 0, text: '二つ目', position: 'middle', style: 'rounded' },
      { panelIndex: 1, text: '二つ目のコマ', position: 'top', style: 'rounded' },
    ]);
  });

  it('keeps narration and thought styles per segment after splitting', () => {
    const panels = [
      makePanel(0, 'ナレーション: 夜は長かった\n（まだ終われない）\n待て!!'),
    ];

    expect(buildAutomaticSpeechBubbles(panels)).toEqual([
      { panelIndex: 0, text: 'ナレーション: 夜は長かった', position: 'top', style: 'rectangular' },
      { panelIndex: 0, text: '（まだ終われない）', position: 'middle', style: 'cloud' },
      { panelIndex: 0, text: '待て!!', position: 'bottom', style: 'spiked' },
    ]);
  });

  it('supports explicit double-pipe separators and drops empty segments', () => {
    const panels = [
      makePanel(0, '  了解  ||  || ナレーション: 裏通りへ移動した  '),
    ];

    expect(buildAutomaticSpeechBubbles(panels)).toEqual([
      { panelIndex: 0, text: '了解', position: 'top', style: 'rounded' },
      { panelIndex: 0, text: 'ナレーション: 裏通りへ移動した', position: 'top', style: 'rectangular' },
    ]);
  });

  it('conservatively splits long single-line dialogue near punctuation', () => {
    const panels = [
      makePanel(0, '先に行ってくれ、ここは私が止める。だから振り返らずに走れ'),
    ];

    expect(buildAutomaticSpeechBubbles(panels)).toEqual([
      { panelIndex: 0, text: '先に行ってくれ、ここは私が止める。', position: 'top', style: 'rounded' },
      { panelIndex: 0, text: 'だから振り返らずに走れ', position: 'middle', style: 'rounded' },
    ]);
  });

  it('does not auto-split long narration text without explicit breaks', () => {
    const panels = [
      makePanel(0, 'ナレーション: 長い説明文だとしても作者が明示的に分けていないなら一旦そのまま扱う'),
    ];

    expect(buildAutomaticSpeechBubbles(panels)).toEqual([
      {
        panelIndex: 0,
        text: 'ナレーション: 長い説明文だとしても作者が明示的に分けていないなら一旦そのまま扱う',
        position: 'top',
        style: 'rectangular',
      },
    ]);
  });

  it('pushes dialogue below narration so automatic layout does not stack at the top', () => {
    const panels = [
      makePanel(0, 'ナレーション: 放課後の屋上\n急ごう\nまだ間に合う'),
    ];

    expect(buildAutomaticSpeechBubbles(panels)).toEqual([
      { panelIndex: 0, text: 'ナレーション: 放課後の屋上', position: 'top', style: 'rectangular' },
      { panelIndex: 0, text: '急ごう', position: 'middle', style: 'rounded' },
      { panelIndex: 0, text: 'まだ間に合う', position: 'bottom', style: 'rounded' },
    ]);
  });

  it('cascades multiple dialogue bubbles from top to bottom in the same panel', () => {
    const panels = [
      makePanel(0, '了解\n今行く\n先に開けて'),
    ];

    expect(buildAutomaticSpeechBubbles(panels)).toEqual([
      { panelIndex: 0, text: '了解', position: 'top', style: 'rounded' },
      { panelIndex: 0, text: '今行く', position: 'middle', style: 'rounded' },
      { panelIndex: 0, text: '先に開けて', position: 'bottom', style: 'rounded' },
    ]);
  });
});

function makePanel(panelIndex: number, speechBubbleText?: string): Panel {
  return {
    id: `panel-${panelIndex}`,
    projectId: 'project-1',
    panelIndex,
    speechBubbleText,
    status: 'generated',
    retryCount: 0,
    createdAt: '2026-04-08T00:00:00.000Z',
  };
}
