import { describe, expect, it } from 'vitest';
import { getDraftCoverageSummary, getPanelDraftSummary, getPanelFitSummary, splitSpeechBubbleText } from '../nameDraft';

describe('nameDraft helpers', () => {
  it('splits multiline and explicit separators into bubble units', () => {
    expect(splitSpeechBubbleText('一つ目\n二つ目 || 三つ目')).toEqual(['一つ目', '二つ目', '三つ目']);
  });

  it('conservatively auto-splits long single-line dialogue near punctuation', () => {
    expect(
      splitSpeechBubbleText('先に行ってくれ、ここは私が止める。だから振り返らずに走れ')
    ).toEqual([
      '先に行ってくれ、ここは私が止める。',
      'だから振り返らずに走れ',
    ]);
  });

  it('keeps long narration as a single bubble unit', () => {
    expect(
      splitSpeechBubbleText('ナレーション: 長い説明文だとしても作者が明示的に分けていないなら一旦そのまま扱う')
    ).toEqual([
      'ナレーション: 長い説明文だとしても作者が明示的に分けていないなら一旦そのまま扱う',
    ]);
  });

  it('detects narration and thought markers', () => {
    const summary = getPanelDraftSummary({
      panelIndex: 0,
      storyBeat: '夜道を振り返る',
      speechBubbleText: 'ナレーション: 雨が止まない\n（まだ帰れない）',
    });

    expect(summary.hasStoryBeat).toBe(true);
    expect(summary.bubbleCount).toBe(2);
    expect(summary.longBubbleCount).toBe(0);
    expect(summary.hasNarration).toBe(true);
    expect(summary.hasThought).toBe(true);
  });

  it('aggregates draft coverage across panels', () => {
    const coverage = getDraftCoverageSummary([
      { panelIndex: 0, storyBeat: '導入', speechBubbleText: '了解' },
      { panelIndex: 1, storyBeat: '', speechBubbleText: '' },
      { panelIndex: 2, storyBeat: '決断', speechBubbleText: 'ナレーション: 夜が明ける\nまだ長い説明が必要なので少し長めにしておくため文章をさらに伸ばして十分長文化する\n（まだ帰れない）' },
    ]);

    expect(coverage).toEqual({
      totalPanels: 3,
      readyPanels: 2,
      storyBeatPanels: 2,
      bubblePanels: 2,
      totalBubbles: 4,
      longBubblePanels: 1,
      densePanels: 1,
      narrationPanels: 1,
      thoughtPanels: 1,
      watchFitPanels: 1,
      tightFitPanels: 0,
    });
  });

  it('marks narrow short panels with heavy dialogue as tight fit risks', () => {
    const fit = getPanelFitSummary(
      {
        panelIndex: 0,
        storyBeat: '電話口で畳みかける',
        speechBubbleText: 'ナレーション: もう朝だ\n急いで\nまだ間に合う\n（でも怖い）',
      },
      { x: 0.69, y: 0.05, w: 0.26, h: 0.26 }
    );

    expect(fit.risk).toBe('tight');
    expect(fit.reasons).toContain('吹き出し数がコマサイズに対して多い');
  });

  it('keeps wide panels with short dialogue in the safe range', () => {
    const fit = getPanelFitSummary(
      {
        panelIndex: 0,
        storyBeat: '導入',
        speechBubbleText: 'ナレーション: 静かな朝',
      },
      { x: 0.05, y: 0.05, w: 0.9, h: 0.24 }
    );

    expect(fit.risk).toBe('safe');
    expect(fit.reasons).toEqual([]);
  });
});
