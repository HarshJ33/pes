import { Schema, model, Document, Types } from "mongoose";

export interface IEvaluation extends Document {
  exam: Types.ObjectId;
  evaluator: Types.ObjectId;
  evaluatee: Types.ObjectId;
  marks: number[];
  feedback: string;
  status: 'pending' | 'completed';
  flagged: boolean;
  
  // Credibility tracking
  evaluatorCredibilityScore?: number; // Cached credibility score at time of aggregation
  evaluatorTrustWeight?: number; // Weight multiplier for this evaluation
  
  // TA correction audit trail
  isTACorrected?: boolean; // Whether a TA corrected this evaluation
  originalEvaluator?: Types.ObjectId; // Original peer evaluator (if TA corrected)
  taCorrector?: Types.ObjectId; // Which TA corrected it (if applicable)
  
  createdAt?: Date;
  updatedAt?: Date;
}

const evaluationSchema = new Schema<IEvaluation>({
  exam: { type: Schema.Types.ObjectId, ref: 'Exam', required: true },
  evaluator: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  evaluatee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  marks: [{ type: Number, required: true }],
  feedback: { type: String },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  flagged: { type: Boolean, default: false },
  
  // Credibility tracking
  evaluatorCredibilityScore: { type: Number, default: 0.5 },
  evaluatorTrustWeight: { type: Number, default: 1.0 },
  
  // TA correction audit trail
  isTACorrected: { type: Boolean, default: false },
  originalEvaluator: { type: Schema.Types.ObjectId, ref: 'User' },
  taCorrector: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const Evaluation = model<IEvaluation>('Evaluation', evaluationSchema);
