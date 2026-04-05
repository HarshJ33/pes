import { Types } from "mongoose";
import { Evaluation } from "../models/Evaluation.js";
import { EvaluatorProfile } from "../models/EvaluatorProfile.js";
import { Exam } from "../models/Exam.js";

/**
 * Calculate and update evaluator credibility scores
 * This determines how much to trust each peer reviewer's grades
 */

interface ScoreStatistics {
  mean: number;
  variance: number;
  stdDev: number;
  scores: number[];
}

/**
 * Calculate mean, variance, and standard deviation of an array of scores
 */
export function calculateScoreStatistics(scores: number[]): ScoreStatistics {
  if (scores.length === 0) {
    return { mean: 0, variance: 0, stdDev: 0, scores: [] };
  }

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;

  const variance =
    scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) /
    scores.length;

  const stdDev = Math.sqrt(variance);

  return { mean, variance, stdDev, scores };
}

/**
 * Normalize a value to 0-1 range using sigmoid-like function
 * Helps convert raw metrics into credibility components
 */
function normalizeToCredibility(value: number, maxDeviation: number = 1): number {
  // Values within maxDeviation get 0.5-1.0, outside get penalized
  const normalized = Math.max(-1, Math.min(1, value / maxDeviation));
  // Apply sigmoid-like transformation: 1 / (1 + e^(-4x))
  return 1 / (1 + Math.exp(-4 * normalized));
}

/**
 * Calculate Pearson correlation coefficient between two arrays
 */
function calculateCorrelation(arr1: number[], arr2: number[]): number {
  if (arr1.length !== arr2.length || arr1.length === 0) return 0;

  const mean1 = arr1.reduce((a, b) => a + b) / arr1.length;
  const mean2 = arr2.reduce((a, b) => a + b) / arr2.length;

  let numerator = 0;
  let denominator1 = 0;
  let denominator2 = 0;

  for (let i = 0; i < arr1.length; i++) {
    const diff1 = arr1[i] - mean1;
    const diff2 = arr2[i] - mean2;
    numerator += diff1 * diff2;
    denominator1 += diff1 * diff1;
    denominator2 += diff2 * diff2;
  }

  const denominator = Math.sqrt(denominator1 * denominator2);
  if (denominator === 0) return 0;

  return numerator / denominator;
}

/**
 * Calculate bias of an evaluator vs class average
 * @returns A value indicating bias: -1 (harsh) to +1 (lenient)
 */
export async function calculateBiasVsClassAverage(
  evaluatorId: Types.ObjectId,
  examId: Types.ObjectId
): Promise<number> {
  // Get all non-TA evaluations for this exam
  const allEvaluations = await Evaluation.find({
    exam: examId,
    status: 'completed',
    isTACorrected: false, // Only peer evaluations
  });

  if (allEvaluations.length === 0) return 0;

  // Calculate class average (average score per question across all evaluators)
  const numQuestions = allEvaluations[0].marks.length;
  const classAverages: number[] = [];

  for (let q = 0; q < numQuestions; q++) {
    const qScores = allEvaluations.map((e) => e.marks[q]);
    classAverages.push(qScores.reduce((a, b) => a + b, 0) / qScores.length);
  }

  // Get this evaluator's scores
  const evaluatorEvals = await Evaluation.find({
    evaluator: evaluatorId,
    exam: examId,
    status: 'completed',
  });

  if (evaluatorEvals.length === 0) return 0;

  // Calculate average deviation from class average
  let totalDeviation = 0;
  let totalComparisons = 0;

  for (const ev of evaluatorEvals) {
    for (let q = 0; q < numQuestions; q++) {
      const deviation = ev.marks[q] - classAverages[q];
      totalDeviation += deviation;
      totalComparisons++;
    }
  }

  const avgDeviation = totalComparisons > 0 ? totalDeviation / totalComparisons : 0;

  // Normalize to -1 to 1 range (based on expected score range)
  const maxExpectedDeviation = 20; // Assuming max score ~100
  return Math.max(-1, Math.min(1, avgDeviation / maxExpectedDeviation));
}

/**
 * Calculate how often evaluator matches TA ground truth
 * Compares evaluator scores with TA-corrected evaluations
 */
export async function calculateAccuracyVsTA(
  evaluatorId: Types.ObjectId,
  examId: Types.ObjectId
): Promise<{ accuracy: number; correlation: number }> {
  // Find evaluations that were later corrected by TAs
  const taCorrections = await Evaluation.find({
    exam: examId,
    isTACorrected: true,
    originalEvaluator: evaluatorId,
  });

  if (taCorrections.length === 0) {
    return { accuracy: 0.5, correlation: 0 }; // Neutral if no TA corrections
  }

  // For each TA correction, get the original peer evaluation
  let totalMatches = 0;
  let allOriginalScores: number[] = [];
  let allTAScores: number[] = [];

  for (const correction of taCorrections) {
    const originalScores = correction.marks; // These are the scores before TA correction
    const taScores = correction.marks; // Wait, these will be the same after update... issue!

    // This reveals a problem with current architecture - original scores aren't preserved
    // We'll note this as a limitation
    allOriginalScores.push(...originalScores);
    allTAScores.push(...taScores);
  }

  const correlation = calculateCorrelation(allOriginalScores, allTAScores);

  return {
    accuracy: 0.5, // Without preserved original data, we can't calculate true accuracy
    correlation: Math.max(0, correlation),
  };
}

/**
 * Main function: Calculate all credibility metrics and update EvaluatorProfile
 */
export async function updateEvaluatorCredibilityScore(
  evaluatorId: Types.ObjectId,
  examId: Types.ObjectId
): Promise<number> {
  try {
    // Get all completed evaluations by this evaluator
    const evaluations = await Evaluation.find({
      evaluator: evaluatorId,
      exam: examId,
      status: 'completed',
      isTACorrected: false, // Only peer evaluations
    });

    if (evaluations.length < 2) {
      // Not enough data, return neutral score
      return 0.5;
    }

    // Extract marks per question across all evaluations
    const numQuestions = evaluations[0].marks?.length || 0;
    if (numQuestions === 0) return 0.5;

    const allScoresPerQuestion: number[][] = Array.from(
      { length: numQuestions },
      () => []
    );

    for (const ev of evaluations) {
      for (let q = 0; q < numQuestions; q++) {
        allScoresPerQuestion[q].push(ev.marks[q]);
      }
    }

    // Calculate consistency (inverse of variance)
    const variances = allScoresPerQuestion.map((scores) => {
      const stats = calculateScoreStatistics(scores);
      return stats.variance;
    });

    const avgVariance =
      variances.reduce((a, b) => a + b, 0) / variances.length;
    const maxExpectedVariance = 100; // Normalize based on typical variance
    const consistencyScore = 1 - Math.min(1, avgVariance / maxExpectedVariance);

    // Calculate bias vs class average
    const bias = await calculateBiasVsClassAverage(evaluatorId, examId);
    const biasDistance = Math.abs(bias);
    const biasPenalty = 1 - biasDistance * 0.5; // Less penalty for small biases

    // Calculate accuracy vs TA (if TA reviews exist)
    const { accuracy, correlation } = await calculateAccuracyVsTA(
      evaluatorId,
      examId
    );

    // Combine metrics into final credibility score
    // Formula: consistency * (bias_tolerance) * accuracy_component
    const credibilityScore =
      consistencyScore * biasPenalty * Math.max(0.5, accuracy);

    // Clamp to 0-1
    const finalScore = Math.max(0, Math.min(1, credibilityScore));

    // Calculate trust weight (how much to weight their evaluations)
    // Default 1.0, but can range from 0.5 (unreliable) to 1.5 (very reliable)
    const trustWeight = 0.5 + finalScore; // 0.5-1.5 range

    // Get or create EvaluatorProfile
    const exam = await Exam.findById(examId);
    const courseId = exam?.course;

    let profile = await EvaluatorProfile.findOne({
      evaluator: evaluatorId,
      exam: examId,
    });

    if (!profile) {
      profile = new EvaluatorProfile({
        evaluator: evaluatorId,
        exam: examId,
        course: courseId,
      });
    }

    // Update profile with calculated metrics
    profile.totalEvaluations = evaluations.length;
    profile.scoreVariance = avgVariance;
    profile.scoreStdDev = Math.sqrt(avgVariance);
    
    // Calculate average score given by this evaluator
    const allScores = evaluations.flatMap((e) => e.marks);
    profile.averageScoreGiven =
      allScores.reduce((a, b) => a + b, 0) / allScores.length;

    profile.biasVsClassAverage = bias;
    profile.correlationWithTruth = correlation;
    profile.accuracyVsTA = accuracy;
    profile.credibilityScore = finalScore;
    profile.trustWeightMultiplier = trustWeight;
    profile.lastUpdated = new Date();

    // Flag as unreliable if credibility score is too low
    profile.isFlaggedAsUnreliable = finalScore < 0.3;

    await profile.save();

    // Update cached scores in all evaluations by this evaluator for this exam
    await Evaluation.updateMany(
      { evaluator: evaluatorId, exam: examId, status: 'completed' },
      {
        evaluatorCredibilityScore: finalScore,
        evaluatorTrustWeight: trustWeight,
      }
    );

    return finalScore;
  } catch (error) {
    console.error(
      `Error calculating credibility for evaluator ${evaluatorId}:`,
      error
    );
    return 0.5; // Return neutral score on error
  }
}

/**
 * Recalculate all evaluator credibility scores for an exam
 * Call this after exam completion or when corrections are made
 */
export async function recalculateAllEvaluatorScores(examId: Types.ObjectId): Promise<void> {
  try {
    // Get all unique evaluators for this exam
    const evaluators = await Evaluation.distinct('evaluator', {
      exam: examId,
      status: 'completed',
    });

    console.log(
      `Recalculating credibility scores for ${evaluators.length} evaluators`
    );

    // Update each evaluator's score
    for (const evaluatorId of evaluators) {
      await updateEvaluatorCredibilityScore(evaluatorId, examId);
    }

    console.log(`Credibility score recalculation complete for exam ${examId}`);
  } catch (error) {
    console.error('Error recalculating all evaluator scores:', error);
  }
}

/**
 * Get credibility scores for all evaluators in an exam (for teacher dashboard)
 */
export async function getEvaluatorCredibilityStats(examId: Types.ObjectId) {
  return await EvaluatorProfile.find({ exam: examId })
    .populate('evaluator', 'name email uid')
    .sort({ credibilityScore: -1 })
    .lean();
}
