export type Workspace = {
  id: string;
  name: string;
  /** R193 — `saved` holds frozen copies of its main workspace's datasets and is
   *  read-only; every workspace a user creates is `main`. */
  kind: 'main' | 'saved';
  /** R193 — on a `saved` workspace only: the main workspace it belongs to. */
  parentWorkspaceId?: string;
  createdAt: string;
};

export type CreateWorkspaceInput = {
  name: string;
};
