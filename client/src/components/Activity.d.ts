declare module "@/components/Activity.jsx" {
  import type { ComponentType } from "react";

  type ActivityClockMetrics = {
    stopwatchSeconds: number;
    cameraBpm: number | null;
    activity: string;
    met: number;
    weightKg: number;
    manualBpm: string;
    kcal: number;
  };

  type ActivityClockProps = {
    activity: string;
    met: number;
    weightKg: number;
    minutes: number;
    kcal: number;
    manualBpm: string;
    onWeightChange: (value: number) => void;
    onManualBpmChange: (value: string) => void;
    onSave: (metrics: ActivityClockMetrics) => void;
    saving: boolean;
    userReady: boolean;
    feedback?: string;
  };

  const ActivityClock: ComponentType<ActivityClockProps>;
  export default ActivityClock;
}
