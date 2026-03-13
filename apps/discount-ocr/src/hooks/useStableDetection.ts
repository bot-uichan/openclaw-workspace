import { useMemo, useState } from 'react';
import type { DetectionStability, DetectionSummary } from '../types/ocr';

type StableDetectionState = {
  stableSummary?: DetectionSummary;
  stability: DetectionStability;
  pushSummary: (summary: DetectionSummary) => void;
  reset: () => void;
};

const HISTORY_LIMIT = 5;
const CONFIRM_THRESHOLD = 3;
const CANDIDATE_THRESHOLD = 2;

export function useStableDetection(): StableDetectionState {
  const [history, setHistory] = useState<DetectionSummary[]>([]);

  const stableSummary = useMemo(() => {
    const grouped = new Map<string, { count: number; latest: DetectionSummary }>();

    for (const summary of history) {
      const key = buildSummaryKey(summary);
      const current = grouped.get(key);
      grouped.set(key, {
        count: (current?.count ?? 0) + 1,
        latest: summary,
      });
    }

    return [...grouped.values()].sort((left, right) => right.count - left.count)[0];
  }, [history]);

  const stability: DetectionStability = !stableSummary
    ? 'reading'
    : stableSummary.count >= CONFIRM_THRESHOLD
      ? 'confirmed'
      : stableSummary.count >= CANDIDATE_THRESHOLD
        ? 'candidate'
        : 'reading';

  function pushSummary(summary: DetectionSummary) {
    setHistory((current) => [...current.slice(-(HISTORY_LIMIT - 1)), summary]);
  }

  function reset() {
    setHistory([]);
  }

  return {
    stableSummary: stableSummary?.latest,
    stability,
    pushSummary,
    reset,
  };
}

function buildSummaryKey(summary: DetectionSummary): string {
  return JSON.stringify({
    price: summary.selectedPrice?.value ?? null,
    discount: summary.selectedDiscount?.rate ?? null,
    final: summary.discountedPrice ?? null,
  });
}
