export interface AgentDefinition {
  name: string;
  role: string;
  inputs: string[];
  outputFiles: string[];
  outputSpec: string;
  crossReview?: CrossReviewDef;
  promptTemplate: string;
}

export interface CrossReviewDef {
  targetArtifact: string;
  reviewCriteria: string;
}
