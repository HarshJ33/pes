import { Request, Response } from 'express';
import { Types } from 'mongoose';
import {
  recalculateAllEvaluatorScores,
  getEvaluatorCredibilityStats,
  updateEvaluatorCredibilityScore,
} from '../../utils/credibilityScoring.js';
import { Exam } from '../../models/Exam.js';
import { EvaluatorProfile } from '../../models/EvaluatorProfile.js';
import  catchAsync  from '../../utils/catchAsync.js';

/**
 * POST /admin/evaluator-credibility/calculate/:examId
 * Trigger recalculation of all evaluator credibility scores for an exam
 * Use after exam completion or when you want to update scores
 */
export const calculateEvaluatorCredibility = catchAsync(
  async (req: Request, res: Response) => {
    const { examId } = req.params;

    if (!examId || !Types.ObjectId.isValid(examId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid exam ID provided',
      });
    }

    // Verify exam exists
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found',
      });
    }

    // Recalculate all evaluator scores for this exam
    await recalculateAllEvaluatorScores(new Types.ObjectId(examId));

    res.status(200).json({
      success: true,
      message: 'Evaluator credibility scores calculated successfully',
      examId,
    });
  }
);

/**
 * GET /admin/evaluator-credibility/stats/:examId
 * Get credibility scores and stats for all evaluators of an exam
 * Useful for teachers to see which evaluators are reliable
 */
export const getEvaluatorCredibilityStats_Controller = catchAsync(
  async (req: Request, res: Response) => {
    const { examId } = req.params;

    if (!examId || !Types.ObjectId.isValid(examId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid exam ID provided',
      });
    }

    // Verify exam exists
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found',
      });
    }

    const stats = await getEvaluatorCredibilityStats(new Types.ObjectId(examId));

    res.status(200).json({
      success: true,
      data: {
        exam: {
          id: exam._id,
          title: exam.title,
        },
        evaluators: stats.map((profile: any) => ({
          evaluator: {
            id: profile.evaluator._id,
            name: profile.evaluator.name,
            email: profile.evaluator.email,
            uid: profile.evaluator.uid,
          },
          metrics: {
            totalEvaluations: profile.totalEvaluations,
            averageScoreGiven: profile.averageScoreGiven,
            scoreVariance: profile.scoreVariance,
            scoreStdDev: profile.scoreStdDev,
            biasVsClassAverage: profile.biasVsClassAverage,
            correlationWithTruth: profile.correlationWithTruth,
            accuracyVsTA: profile.accuracyVsTA,
          },
          credibilityScore: profile.credibilityScore,
          trustWeightMultiplier: profile.trustWeightMultiplier,
          isFlaggedAsUnreliable: profile.isFlaggedAsUnreliable,
          lastUpdated: profile.lastUpdated,
        })),
        summary: {
          totalEvaluators: stats.length,
          averageCredibilityScore:
            stats.length > 0
              ? (
                  stats.reduce((sum: number, p: any) => sum + p.credibilityScore, 0) /
                  stats.length
                ).toFixed(2)
              : 0,
          unreliableEvaluators: stats.filter(
            (p: any) => p.isFlaggedAsUnreliable
          ).length,
        },
      },
    });
  }
);

/**
 * PUT /admin/evaluator-credibility/flag/:evaluatorId/:examId
 * Manually flag or unflag an evaluator as unreliable
 */
export const flagEvaluatorAsUnreliable = catchAsync(
  async (req: Request, res: Response) => {
    const { evaluatorId, examId } = req.params;
    const { isFlagged, reason } = req.body;

    if (
      !evaluatorId ||
      !examId ||
      !Types.ObjectId.isValid(evaluatorId) ||
      !Types.ObjectId.isValid(examId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid evaluator ID or exam ID',
      });
    }

    const profile = await EvaluatorProfile.findOne({
      evaluator: evaluatorId,
      exam: examId,
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Evaluator profile not found for this exam',
      });
    }

    profile.isFlaggedAsUnreliable = isFlagged;
    if (isFlagged && reason) {
      // You can extend the model to store the reason if needed
      console.log(`Flagging evaluator ${evaluatorId} for exam ${examId}: ${reason}`);
    }

    // Adjust trust weight multiplier if flagged
    if (isFlagged) {
      profile.trustWeightMultiplier = Math.min(0.5, profile.trustWeightMultiplier);
    }

    await profile.save();

    res.status(200).json({
      success: true,
      message: `Evaluator ${isFlagged ? 'flagged' : 'unflagged'} successfully`,
      data: {
        evaluatorId,
        examId,
        isFlaggedAsUnreliable: profile.isFlaggedAsUnreliable,
        trustWeightMultiplier: profile.trustWeightMultiplier,
      },
    });
  }
);

/**
 * PUT /admin/evaluator-credibility/trust-weight/:evaluatorId/:examId
 * Manually adjust the trust weight multiplier for an evaluator
 */
export const adjustTrustWeight = catchAsync(
  async (req: Request, res: Response) => {
    const { evaluatorId, examId } = req.params;
    const { trustWeightMultiplier } = req.body;

    if (
      !evaluatorId ||
      !examId ||
      !Types.ObjectId.isValid(evaluatorId) ||
      !Types.ObjectId.isValid(examId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid evaluator ID or exam ID',
      });
    }

    if (
      typeof trustWeightMultiplier !== 'number' ||
      trustWeightMultiplier < 0 ||
      trustWeightMultiplier > 2
    ) {
      return res.status(400).json({
        success: false,
        message: 'Trust weight multiplier must be between 0 and 2',
      });
    }

    const profile = await EvaluatorProfile.findOne({
      evaluator: evaluatorId,
      exam: examId,
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Evaluator profile not found for this exam',
      });
    }

    profile.trustWeightMultiplier = trustWeightMultiplier;
    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Trust weight multiplier updated successfully',
      data: {
        evaluatorId,
        examId,
        trustWeightMultiplier: profile.trustWeightMultiplier,
      },
    });
  }
);
