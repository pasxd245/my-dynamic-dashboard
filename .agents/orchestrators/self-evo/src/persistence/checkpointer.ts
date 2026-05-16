import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import type { WorkspaceLayout } from "./workspace.js";

// One sqlite file per run, named `checkpoint.sqlite` under the run
// directory. The graph's thread_id is the runId, so a single file
// holds exactly one thread — keeps cleanup as simple as `rm -rf
// runs/<id>/`.
export function makeCheckpointer(layout: WorkspaceLayout): BaseCheckpointSaver {
  return SqliteSaver.fromConnString(layout.checkpointPath);
}
