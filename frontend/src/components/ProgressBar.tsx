import { GenerationProgress } from '../types';

interface ProgressBarProps {
  progress: GenerationProgress;
}

export default function ProgressBar({ progress }: ProgressBarProps) {
  return (
    <div className="w-full">
      <div className="flex justify-between text-sm text-gray-600 mb-2">
        <span>{progress.message || '処理を準備中...'}</span>
        <span>{Math.round(progress.percentage)}%</span>
      </div>
      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all duration-300"
          style={{ width: `${Math.max(0, Math.min(100, progress.percentage))}%` }}
        />
      </div>
      {progress.currentPanelIndex !== undefined && (
        <p className="mt-2 text-xs text-gray-500">現在のパネル: {progress.currentPanelIndex + 1}</p>
      )}
    </div>
  );
}
