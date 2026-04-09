import type { LayoutTemplatePreviewRect, Panel } from '../types';

export interface PanelDraftSummary {
  panelIndex: number;
  hasStoryBeat: boolean;
  bubbleCount: number;
  longestBubbleLength: number;
  longBubbleCount: number;
  hasNarration: boolean;
  hasThought: boolean;
  isDense: boolean;
  isReady: boolean;
}

export interface DraftCoverageSummary {
  totalPanels: number;
  readyPanels: number;
  storyBeatPanels: number;
  bubblePanels: number;
  totalBubbles: number;
  longBubblePanels: number;
  densePanels: number;
  narrationPanels: number;
  thoughtPanels: number;
  watchFitPanels: number;
  tightFitPanels: number;
}

export type PanelFitRisk = 'safe' | 'watch' | 'tight';

export interface PanelFitSummary {
  panelIndex: number;
  risk: PanelFitRisk;
  estimatedLineBudget: number;
  estimatedLineUsage: number;
  reasons: string[];
}

export const RECOMMENDED_BUBBLE_LENGTH = 32;
export const RECOMMENDED_BUBBLES_PER_PANEL = 3;
const AUTO_SPLIT_MIN_LENGTH = 28;
const AUTO_SPLIT_PUNCTUATION = /[、。！？?!…]/u;

export function splitSpeechBubbleText(text?: string): string[] {
  if (!text) {
    return [];
  }

  return text
    .split(/\r?\n+|\s*\|\|\s*/g)
    .flatMap((segment) => autoSplitBubbleSegment(segment.trim()))
    .filter(Boolean);
}

export function getPanelDraftSummary(panel: Pick<Panel, 'panelIndex' | 'storyBeat' | 'speechBubbleText'>): PanelDraftSummary {
  const storyBeat = panel.storyBeat?.trim() ?? '';
  const bubbles = splitSpeechBubbleText(panel.speechBubbleText);
  const longBubbleCount = bubbles.filter((bubble) => bubble.length > RECOMMENDED_BUBBLE_LENGTH).length;

  return {
    panelIndex: panel.panelIndex,
    hasStoryBeat: storyBeat.length > 0,
    bubbleCount: bubbles.length,
    longestBubbleLength: bubbles.reduce((max, bubble) => Math.max(max, bubble.length), 0),
    longBubbleCount,
    hasNarration: bubbles.some((bubble) => /^(?:モノローグ|ナレーション|地の文)\s*[:：]/.test(bubble)),
    hasThought: bubbles.some((bubble) => /^[（(].+[）)]$/.test(bubble)),
    isDense: bubbles.length >= RECOMMENDED_BUBBLES_PER_PANEL,
    isReady: storyBeat.length > 0 || bubbles.length > 0,
  };
}

export function getPanelFitSummary(
  panel: Pick<Panel, 'panelIndex' | 'storyBeat' | 'speechBubbleText'>,
  templateRect?: LayoutTemplatePreviewRect
): PanelFitSummary {
  const summary = getPanelDraftSummary(panel);
  const estimatedCharsPerLine = getEstimatedCharsPerLine(templateRect);
  const bubbleLimit = getEstimatedBubbleLimit(templateRect);
  const estimatedLineBudget = getEstimatedLineBudget(templateRect);
  const estimatedLineUsage = splitSpeechBubbleText(panel.speechBubbleText)
    .reduce((total, bubble) => total + Math.max(1, Math.ceil(bubble.length / estimatedCharsPerLine)), 0);
  const adjustedLineUsage = estimatedLineUsage + (summary.hasNarration && summary.bubbleCount > 1 ? 1 : 0);
  const reasons: string[] = [];

  if (summary.longBubbleCount > 0) {
    reasons.push('長文の吹き出しがある');
  }

  if (summary.bubbleCount > bubbleLimit) {
    reasons.push('吹き出し数がコマサイズに対して多い');
  }

  if (adjustedLineUsage > estimatedLineBudget) {
    reasons.push('文字量がコマの高さに対して多い');
  }

  let risk: PanelFitRisk = 'safe';
  if (summary.bubbleCount > bubbleLimit || adjustedLineUsage > estimatedLineBudget + 1) {
    risk = 'tight';
  } else if (reasons.length > 0 || adjustedLineUsage === estimatedLineBudget) {
    risk = 'watch';
  }

  return {
    panelIndex: panel.panelIndex,
    risk,
    estimatedLineBudget,
    estimatedLineUsage: adjustedLineUsage,
    reasons,
  };
}

export function getDraftCoverageSummary(
  panels: Array<Pick<Panel, 'panelIndex' | 'storyBeat' | 'speechBubbleText'>>,
  templatePreview?: LayoutTemplatePreviewRect[]
): DraftCoverageSummary {
  const summaries = panels.map(getPanelDraftSummary);
  const fitSummaries = panels.map((panel) => getPanelFitSummary(panel, templatePreview?.[panel.panelIndex]));

  return {
    totalPanels: panels.length,
    readyPanels: summaries.filter((summary) => summary.isReady).length,
    storyBeatPanels: summaries.filter((summary) => summary.hasStoryBeat).length,
    bubblePanels: summaries.filter((summary) => summary.bubbleCount > 0).length,
    totalBubbles: summaries.reduce((sum, summary) => sum + summary.bubbleCount, 0),
    longBubblePanels: summaries.filter((summary) => summary.longBubbleCount > 0).length,
    densePanels: summaries.filter((summary) => summary.isDense).length,
    narrationPanels: summaries.filter((summary) => summary.hasNarration).length,
    thoughtPanels: summaries.filter((summary) => summary.hasThought).length,
    watchFitPanels: fitSummaries.filter((summary) => summary.risk === 'watch').length,
    tightFitPanels: fitSummaries.filter((summary) => summary.risk === 'tight').length,
  };
}

function getEstimatedCharsPerLine(templateRect?: LayoutTemplatePreviewRect): number {
  if (!templateRect) {
    return 14;
  }

  if (templateRect.w <= 0.30) {
    return 9;
  }

  if (templateRect.w <= 0.45) {
    return 12;
  }

  if (templateRect.w <= 0.70) {
    return 16;
  }

  return 20;
}

function getEstimatedLineBudget(templateRect?: LayoutTemplatePreviewRect): number {
  if (!templateRect) {
    return 5;
  }

  let budget = templateRect.h <= 0.18
    ? 3
    : templateRect.h <= 0.28
      ? 5
      : templateRect.h <= 0.42
        ? 7
        : 9;

  if (templateRect.w <= 0.30) {
    budget -= 1;
  }

  if (templateRect.w >= 0.75 && templateRect.h >= 0.20) {
    budget += 1;
  }

  return Math.max(2, budget);
}

function getEstimatedBubbleLimit(templateRect?: LayoutTemplatePreviewRect): number {
  if (!templateRect) {
    return RECOMMENDED_BUBBLES_PER_PANEL;
  }

  let limit = templateRect.h <= 0.18
    ? 1
    : templateRect.h <= 0.28
      ? 2
      : 3;

  if (templateRect.w <= 0.30) {
    limit -= 1;
  }

  return Math.max(1, limit);
}

function autoSplitBubbleSegment(segment: string): string[] {
  if (!segment) {
    return [];
  }

  if (segment.length < AUTO_SPLIT_MIN_LENGTH || isNarrationText(segment) || isThoughtText(segment)) {
    return [segment];
  }

  const splitIndex = findAutoSplitIndex(segment);
  if (splitIndex < 0) {
    return [segment];
  }

  const first = segment.slice(0, splitIndex + 1).trim();
  const second = segment.slice(splitIndex + 1).trim();

  if (first.length < 4 || second.length < 4) {
    return [segment];
  }

  return [first, second];
}

function findAutoSplitIndex(segment: string): number {
  const lowerBound = Math.floor(segment.length * 0.25);
  const upperBound = Math.ceil(segment.length * 0.8);
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  const midpoint = segment.length / 2;

  for (let index = lowerBound; index < upperBound; index += 1) {
    if (!AUTO_SPLIT_PUNCTUATION.test(segment[index])) {
      continue;
    }

    const distance = Math.abs(index - midpoint);
    if (distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  }

  return bestIndex;
}

function isNarrationText(text: string): boolean {
  return /^(?:モノローグ|ナレーション|地の文)\s*[:：]/.test(text);
}

function isThoughtText(text: string): boolean {
  return /^[（(].+[）)]$/.test(text.trim());
}
