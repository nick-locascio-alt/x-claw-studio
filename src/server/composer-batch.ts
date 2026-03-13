export async function composeAllGoals<TGoal extends string, TRequest extends { mode: "single" | "all_goals" }, TResult, TProgress extends {
  stage: string;
  message: string;
  detail?: string | null;
  goal?: TGoal | null;
  completedGoals?: number;
  totalGoals?: number;
}>(input: {
  goals: readonly TGoal[];
  request: TRequest;
  runSingle: (request: TRequest, options?: { onProgress?: (event: TProgress) => void }) => Promise<TResult>;
  onProgress?: (event: TProgress) => void;
}): Promise<TResult[]> {
  const { goals, request, runSingle, onProgress } = input;
  const totalGoals = goals.length;
  const results: TResult[] = [];

  for (const [index, goal] of goals.entries()) {
    onProgress?.({
      stage: "starting",
      message: `Starting ${goal} draft`,
      detail: `${index + 1} of ${totalGoals}`,
      goal,
      completedGoals: index,
      totalGoals
    } as TProgress);

    const result = await runSingle(
      {
        ...request,
        goal,
        mode: "single"
      } as TRequest,
      {
        onProgress(event) {
          onProgress?.({
            ...event,
            goal,
            completedGoals: event.stage === "completed" ? index + 1 : index,
            totalGoals
          });
        }
      }
    );

    results.push(result);
  }

  return results;
}
