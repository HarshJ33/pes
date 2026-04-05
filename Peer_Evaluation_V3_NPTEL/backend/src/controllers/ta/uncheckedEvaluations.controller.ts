import { Request, Response, NextFunction } from 'express';
import { Evaluation } from '../../models/Evaluation.ts';
import { Batch } from '../../models/Batch.ts';
import { Exam } from '../../models/Exam.ts';
import { Submission } from '../../models/Submission.ts';
import { Notification } from '../../models/Notification.ts';
import { Ticket } from '../../models/Ticket.ts';

/**
 * Get all unchecked evaluation tickets for TA's assigned batches and courses
 * These are tickets created by teachers for pending evaluations with message "unchecked"
 */
export const getUncheckedEvaluations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const taId = (req as any).user.id;
    
    // Find all batches where the user is assigned as a TA
    const batches = await Batch.find({ ta: taId });
    
    if (!batches || batches.length === 0) {
      res.json({ uncheckedEvaluations: [] });
      return;
    }
    
    // Get all exams for TA's batches
    const batchIds = batches.map(batch => batch._id);
    const exams = await Exam.find({ batch: { $in: batchIds } });
    const examIds = exams.map(exam => exam._id);
    
    // Find tickets for unchecked evaluations where message is "unchecked"
    // and status is open, escalatedToTeacher is false, and TA is assigned
    const uncheckedTickets = await Ticket.find({
      ta: taId,
      exam: { $in: examIds },
      message: "unchecked",
      status: 'open',
      escalatedToTeacher: false
    })
    .populate('student', 'name email')
    .populate('evaluator', 'name email')
    .populate({
      path: 'exam',
      select: 'title startTime endTime numQuestions answerKeyPdf answerKeyMimeType',
      populate: {
        path: 'course',
        select: 'name code'
      }
    });
    
    // Transform tickets to look like evaluations for frontend compatibility
    const uncheckedEvaluations = await Promise.all(
      uncheckedTickets.map(async (ticket) => {
        // Find the corresponding evaluation
        const evaluation = await Evaluation.findOne({
          exam: ticket.exam,
          evaluator: ticket.evaluator,
          evaluatee: ticket.student,
          status: 'pending',
          flagged: true // These evaluations should be flagged when ticket is created
        });

        if (!evaluation) {
          return null;
        }

        return {
          _id: ticket._id, // Use ticket ID for operations
          evaluationId: evaluation._id, // Keep evaluation ID for reference
          evaluatee: ticket.student,
          evaluator: ticket.evaluator,
          exam: ticket.exam,
          marks: evaluation.marks,
          feedback: evaluation.feedback,
          status: evaluation.status,
          createdAt: ticket.createdAt
        };
      })
    );
    
    // Filter out null values
    const validEvaluations = uncheckedEvaluations.filter(evaluation => evaluation !== null);
    
    res.json({ uncheckedEvaluations: validEvaluations });
  } catch (error) {
    console.error('Error fetching unchecked evaluations:', error);
    next(error);
  }
};

/**
 * Get the submission PDF for a student's exam submission (for unchecked evaluations)
 */
export const getUncheckedSubmissionPdf = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { ticketId } = req.params;
    const taId = (req as any).user.id;

    // Find the ticket first
    const ticket = await Ticket.findById(ticketId)
      .populate('exam')
      .populate('student');

    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    // Verify the ticket is for unchecked evaluations and TA is assigned
    if (ticket.message !== "unchecked" || ticket.ta.toString() !== taId) {
      res.status(403).json({ error: 'Not authorized to access this submission' });
      return;
    }

    // Verify the ticket is from TA's assigned batches
    const batches = await Batch.find({ ta: taId });
    const batchIds = batches.map(batch => batch._id);
    const exam = await Exam.findOne({
      _id: ticket.exam,
      batch: { $in: batchIds }
    });

    if (!exam) {
      res.status(403).json({ error: 'Not authorized to access this evaluation' });
      return;
    }

    // Find the submission using exam and student from the ticket
    const submission = await Submission.findOne({
      exam: ticket.exam,
      student: ticket.student
    });

    if (!submission) {
      res.status(404).json({ error: 'Submission not found' });
      return;
    }

    // Validate PDF data exists
    if (!submission.answerPdf || !submission.answerPdfMimeType) {
      res.status(404).json({ error: 'Submission PDF data not found' });
      return;
    }

    // Create a safe filename
    const studentName = (ticket.student as any)?.name || 'student';
    const examTitle = (ticket.exam as any)?.title || 'exam';
    const safeFilename = `submission_${studentName.replace(/[^a-zA-Z0-9]/g, '_')}_${examTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    // Set appropriate headers for PDF download
    res.setHeader('Content-Type', submission.answerPdfMimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);

    // Send the PDF data
    res.send(submission.answerPdf);
  } catch (error) {
    console.error('Error fetching submission PDF:', error);
    next(error);
  }
};

/**
 * Get the answer key PDF for an exam (for unchecked evaluations)
 */
export const getUncheckedAnswerKeyPdf = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { ticketId } = req.params;
    const taId = (req as any).user.id;

    // Find the ticket first
    const ticket = await Ticket.findById(ticketId)
      .populate('exam');

    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    // Verify the ticket is for unchecked evaluations and TA is assigned
    if (ticket.message !== "unchecked" || ticket.ta.toString() !== taId) {
      res.status(403).json({ error: 'Not authorized to access this answer key' });
      return;
    }

    // Verify the ticket is from TA's assigned batches
    const batches = await Batch.find({ ta: taId });
    const batchIds = batches.map(batch => batch._id);
    const exam = await Exam.findOne({
      _id: ticket.exam,
      batch: { $in: batchIds }
    });

    if (!exam) {
      res.status(403).json({ error: 'Not authorized to access this answer key' });
      return;
    }

    // Validate answer key PDF data exists
    if (!exam.answerKeyPdf || !exam.answerKeyMimeType) {
      res.status(404).json({ error: 'Answer key PDF not found for this exam' });
      return;
    }

    // Create a safe filename
    const examTitle = exam.title || 'exam';
    const safeFilename = `answer_key_${examTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;

    // Set appropriate headers for PDF download
    res.setHeader('Content-Type', exam.answerKeyMimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);

    // Send the PDF data
    res.send(exam.answerKeyPdf);
  } catch (error) {
    console.error('Error fetching answer key PDF:', error);
    next(error);
  }
};

/**
 * Complete/grade an unchecked evaluation (resolve the ticket)
 */
export const completeUncheckedEvaluation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { ticketId } = req.params;
    const { marks, feedback } = req.body;
    const taId = (req as any).user.id;

    // Find the ticket
    const ticket = await Ticket.findById(ticketId)
      .populate('exam')
      .populate('student')
      .populate('evaluator');

    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    // Verify the ticket is for unchecked evaluations and TA is assigned
    if (ticket.message !== "unchecked" || ticket.ta.toString() !== taId) {
      res.status(403).json({ error: 'Not authorized to resolve this ticket' });
      return;
    }

    // Verify the ticket is from TA's assigned batches
    const batches = await Batch.find({ ta: taId });
    const batchIds = batches.map(batch => batch._id);
    const exam = await Exam.findOne({
      _id: ticket.exam,
      batch: { $in: batchIds }
    });

    if (!exam) {
      res.status(403).json({ error: 'Not authorized to grade this evaluation' });
      return;
    }

    // Find the corresponding evaluation
    const evaluation = await Evaluation.findOne({
      exam: ticket.exam,
      evaluator: ticket.evaluator,
      evaluatee: ticket.student,
      status: 'pending',
      flagged: true
    });

    if (!evaluation) {
      res.status(404).json({ error: 'Related evaluation not found' });
      return;
    }

    // Validate marks array
    if (!Array.isArray(marks)) {
      res.status(400).json({ error: 'Marks must be provided as an array' });
      return;
    }

    // Get expected number of questions from exam
    const expectedQuestions = (ticket.exam as any)?.numQuestions || evaluation.marks.length;

    if (marks.length !== expectedQuestions) {
      res.status(400).json({
        error: `Expected ${expectedQuestions} marks, but received ${marks.length}`
      });
      return;
    }

    // Validate each mark
    for (const mark of marks) {
      if (typeof mark !== 'number' || mark < 0 || mark > 20) {
        res.status(400).json({
          error: 'Each mark must be a number between 0 and 20'
        });
        return;
      }
    }

    // Update the evaluation
    evaluation.marks = marks;
    if (feedback) {
      evaluation.feedback = feedback;
    }
    evaluation.status = 'completed';
    evaluation.flagged = false; // Remove the flag since it's now completed
    
    // Preserve the original evaluator and mark as TA-corrected
    if (!evaluation.isTACorrected) {
      evaluation.originalEvaluator = evaluation.evaluator; // Store the original peer evaluator
      evaluation.isTACorrected = true; // Mark that a TA corrected this
      evaluation.taCorrector = taId; // Track which TA corrected it
    }
    evaluation.evaluator = taId; // Update evaluator to TA for aggregation purposes
    
    await evaluation.save();

    // Close the ticket
    ticket.status = 'closed';
    await ticket.save();

    // Notify the evaluator that their evaluation has been completed by TA
    await Notification.create({
      recipient: evaluation.evaluator,
      message: `Your evaluation for ${(evaluation.evaluatee as any).name} has been completed by a TA.`,
      relatedResource: {
        type: 'evaluation',
        id: evaluation._id
      }
    });

    // Notify the student being evaluated
    await Notification.create({
      recipient: evaluation.evaluatee,
      message: `Your evaluation has been completed and graded.`,
      relatedResource: {
        type: 'evaluation',
        id: evaluation._id
      }
    });

    res.json({
      message: 'Unchecked evaluation completed successfully',
      evaluation: {
        _id: evaluation._id,
        marks: evaluation.marks,
        feedback: evaluation.feedback,
        status: evaluation.status
      }
    });
  } catch (error) {
    console.error('Error completing unchecked evaluation:', error);
    next(error);
  }
};

/**
 * Get TA statistics for unchecked evaluations
 */
export const getUncheckedEvaluationStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const taId = (req as any).user.id;
    
    // Find all batches where the user is assigned as a TA
    const batches = await Batch.find({ ta: taId });
    
    if (!batches || batches.length === 0) {
      res.json({ 
        stats: {
          totalUnchecked: 0,
          completedByTA: 0
        }
      });
      return;
    }
    
    // Get all exams for TA's batches
    const batchIds = batches.map(batch => batch._id);
    const exams = await Exam.find({ batch: { $in: batchIds } });
    const examIds = exams.map(exam => exam._id);
    
    const totalUnchecked = await Ticket.countDocuments({
      ta: taId,
      exam: { $in: examIds },
      message: "unchecked",
      status: 'open',
      escalatedToTeacher: false
    });
    
    const completedByTA = await Ticket.countDocuments({
      ta: taId,
      exam: { $in: examIds },
      message: "unchecked",
      status: 'closed'
    });

    res.json({
      stats: {
        totalUnchecked,
        completedByTA
      }
    });
  } catch (error) {
    console.error('Error fetching unchecked evaluation stats:', error);
    next(error);
  }
};