// Relationship governance types (R70).
//
// Hand-aligned to the OpenAPI 3.1 contracts at
// workspace/packages/contracts/relationships/* and _shared/relationship.yaml,
// and to the design at
// .agents/design/data-management/workspaces/relationships.md.
//
// A Relationship is a governed EDGE between two datasets in one workspace — a
// column pair with a declared cardinality and validated dtype-compatibility.
// It is not a table-source; the Query Builder (R71) consumes it to join.

/** Declared multiplicity of the edge (MVP; direction by side order). */
export type Cardinality = 'one_to_one' | 'one_to_many' | 'many_to_many';

/** Computed at read vs current schemas — never stored. */
export type RelationshipStatus = 'valid' | 'stale';

/** A governed edge. Mirrors `_shared/relationship.yaml#/Relationship`. */
export type Relationship = {
  /** Server-generated, `^rel_[0-9a-f]{8}$`. */
  id: string;
  /** FK → Workspace.id (the governance scope). */
  workspaceId: string;
  /** FK → Dataset.id (the left side). */
  leftDatasetId: string;
  /** A column name in leftDataset.columns[]. */
  leftColumn: string;
  /** FK → Dataset.id (the right side; same workspace). */
  rightDatasetId: string;
  /** A column name in rightDataset.columns[]. */
  rightColumn: string;
  cardinality: Cardinality;
  /** `'stale'` iff a referenced column no longer validates. */
  status: RelationshipStatus;
  /** ISO-8601 UTC, server-stamped. */
  createdAt: string;
};

/** POST /workspaces/{id}/relationships request body. */
export type CreateRelationshipRequest = {
  leftDatasetId: string;
  leftColumn: string;
  rightDatasetId: string;
  rightColumn: string;
  cardinality: Cardinality;
};
