import { Request, Response, NextFunction } from "express";
import { Evaluation } from "../../models/Evaluation.ts";
import { IUser } from "../../models/User.ts";

// Extend Express Request interface to include 'user'
declare global {
  namespace Express {
    interface User {
      _id: string;
      role: string;
    }
    interface Request {
      user?: User;
    }
  }
}

export const getEvaluationResults = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const studentId = req.user?._id?.toString();
    if (!studentId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const evaluations = await Evaluation.find({
      evaluatee: studentId,
      status: "completed",
    })
      .populate({
        path: "exam",
        select: "title startTime course batch",
        populate: [
          { path: "course", select: "name" },
          { path: "batch", select: "name" },
        ],
      })
      .populate({
        path: "evaluator",
        model: "User",
        select: "name",
      });

    if (!evaluations || evaluations.length === 0) {
      res.status(200).json({ message: "No evaluations found" });
      return;
    }

    const resultsMap: Record<string, any> = {};

    evaluations.forEach((ev) => {
      const examKey = ev.exam?._id?.toString() || "unknown";

      if (!resultsMap[examKey]) {
        resultsMap[examKey] = {
          exam: ev.exam,
          marksList: [],
          feedbackList: [],
          evaluators: [],
          credibilityScores: [], // For weighted calculation
          trustWeights: [],
        };
      }

      const evaluator =
        typeof ev.evaluator === "object" && "name" in ev.evaluator
          ? {
              _id: ev.evaluator._id.toString(),
              name: (ev.evaluator as unknown as IUser).name,
            }
          : {
              _id: ev.evaluator?.toString() || "unknown",
              name: "Unknown",
            };

      resultsMap[examKey].marksList.push(ev.marks);
      resultsMap[examKey].feedbackList.push(ev.feedback);
      resultsMap[examKey].evaluators.push(evaluator);
      resultsMap[examKey].credibilityScores.push(
        ev.evaluatorCredibilityScore || 0.5
      ); // Default 0.5 if not calculated
      resultsMap[examKey].trustWeights.push(
        ev.evaluatorTrustWeight || 1.0
      ); // Default 1.0 if not calculated
    });

    const results = Object.values(resultsMap).map((group: any) => {
      // Compute total per evaluator
      const totalPerEvaluator = group.marksList.map(
        (marks: number[]) => marks.reduce((sum, mark) => sum + mark, 0)
      );

      // Calculate simple average (for comparison)
      const simpleAvg =
        totalPerEvaluator.length > 0
          ? (
              totalPerEvaluator.reduce((sum: number, total: number) => sum + total, 0) /
              totalPerEvaluator.length
            ).toFixed(2)
          : null;

      // Calculate weighted average based on evaluator credibility
      let weightedAvg = simpleAvg;
      if (totalPerEvaluator.length > 0) {
        let weightedSum = 0;
        let weightSum = 0;

        for (let i = 0; i < totalPerEvaluator.length; i++) {
          const weight = group.trustWeights[i] || 1.0;
          weightedSum += totalPerEvaluator[i] * weight;
          weightSum += weight;
        }

        weightedAvg = (weightSum > 0 ? (weightedSum / weightSum).toFixed(2) : simpleAvg);
      }

      // Build evaluator details with credibility info
      const evaluatorDetails = group.evaluators.map((ev: any, idx: number) => ({
        _id: ev._id,
        name: ev.name,
        credibilityScore: group.credibilityScores[idx],
        trustWeight: group.trustWeights[idx],
      }));

      return {
        exam: {
          _id: group.exam._id,
          title: group.exam.title,
          startTime: group.exam.startTime,
          courseName: group.exam.course?.name || "Unknown Course",
          batchId: group.exam.batch?._id || null,
          batchName: group.exam.batch?.name || "Unknown Batch",
        },
        grading: {
          simpleAverage: simpleAvg,
          weightedAverage: weightedAvg,
          // Show the weighted average as the primary grade
          finalGrade: weightedAvg,
          description: "Grade calculated with reviewer credibility weighting",
        },
        marks: group.marksList,
        feedback: group.feedbackList,
        evaluators: evaluatorDetails,
        credibilityInfo: {
          averageCredibilityScore: (
            group.credibilityScores.reduce((a: number, b: number) => a + b, 0) /
            group.credibilityScores.length
          ).toFixed(2),
          trustWeightedCount: group.trustWeights.filter((w: number) => w > 1).length,
          unreliableEvaluatorCount: group.trustWeights.filter((w: number) => w < 0.8).length,
        },
      };
    });

    res.json({ results });
  } catch (err) {
    console.error(err);
    next(err);
  }
};
