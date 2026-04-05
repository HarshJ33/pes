import { Schema, model, Document, Types } from "mongoose";

/**
 * Tracks the credibility and reliability metrics for each evaluator (peer reviewer)
 * Used to weight their peer evaluations based on their accuracy and consistency
 */
export interface IEvaluatorProfile extends Document {
  evaluator: Types.ObjectId; // The peer reviewer (User)
  exam: Types.ObjectId; // Which exam they're evaluating for
  course: Types.ObjectId; // Which course
  
  // Evaluation count and basic stats
  totalEvaluations: number; // How many evaluations they've completed
  averageScoreGiven: number; // Average score they assign across all their evaluations
  
  // Consistency metrics
  scoreVariance: number; // Variance in their scores (higher = less consistent)
  scoreStdDev: number; // Standard deviation of scores they give
  
  // Bias metrics
  biasVsClassAverage: number; // Deviation from class average (-1 to +1, negative = harsh, positive = lenient)
  biasVsGradeAverage: number; // Deviation from TA ground truth grade average
  
  // Accuracy metrics
  correlationWithTruth: number; // Correlation of their scores with TA ground truth (0-1, 1 = perfect)
  accuracyVsTA: number; // How often they match TA reviews (0-1)
  
  // Final credibility score (0-1, where 1 is most reliable)
  // Calculated as: consistency * accuracy * (1 - |bias|)
  credibilityScore: number;
  
  // Flags
  isFlaggedAsUnreliable: boolean; // Manual flag for consistently bad evaluators
  trustWeightMultiplier: number; // How much to weight their evaluations (default 1.0)
  
  // Metadata
  lastUpdated: Date;
  createdAt: Date;
}

const evaluatorProfileSchema = new Schema<IEvaluatorProfile>({
  evaluator: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  exam: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  
  totalEvaluations: { type: Number, default: 0 },
  averageScoreGiven: { type: Number, default: 0 },
  
  scoreVariance: { type: Number, default: 0 },
  scoreStdDev: { type: Number, default: 0 },
  
  biasVsClassAverage: { type: Number, default: 0 },
  biasVsGradeAverage: { type: Number, default: 0 },
  
  correlationWithTruth: { type: Number, default: 0 },
  accuracyVsTA: { type: Number, default: 0 },
  
  credibilityScore: { type: Number, default: 0.5 }, // Start neutral
  
  isFlaggedAsUnreliable: { type: Boolean, default: false },
  trustWeightMultiplier: { type: Number, default: 1.0, min: 0, max: 2.0 },
  
  lastUpdated: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

// Unique constraint: one profile per (evaluator, exam)
evaluatorProfileSchema.index({ evaluator: 1, exam: 1 }, { unique: true });
evaluatorProfileSchema.index({ course: 1, exam: 1 });

export const EvaluatorProfile = model<IEvaluatorProfile>('EvaluatorProfile', evaluatorProfileSchema);
