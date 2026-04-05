import { Request, Response, NextFunction } from 'express';
import { Evaluation } from '../../models/Evaluation.ts';
import { User } from '../../models/User.ts';
import { Notification } from '../../models/Notification.ts';
import { Submission } from '../../models/Submission.ts';
import { Ticket } from '../../models/Ticket.ts';
import { TeacherTicket } from '../../models/TeacherTicket.ts';
// Add these imports at the top with existing imports
import Enrollment from '../../models/Enrollment.ts';
import { Batch } from '../../models/Batch.ts';
import { Course } from '../../models/Course.ts';
import { Exam } from '../../models/Exam.ts';

/**
 * Get TA profile with assigned courses and batches
 */
export const getTAProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const taId = (req as any).user.id;
    
    // Find all batches where the user is assigned as a TA
    const batches = await Batch.find({ ta: taId })
      .populate('course', 'name code');
    
    if (!batches || batches.length === 0) {
      res.json({ 
        profile: {
          name: (req as any).user.name,
          email: (req as any).user.email,
          courses: [],
          batches: []
        }
      });
      return;
    }
    
    // Extract unique courses from batches
    const courses = Array.from(new Set(
      batches.map(batch => JSON.stringify(batch.course))
    )).map(course => JSON.parse(course));
    
    // Extract batch information (without year)
    const batchesInfo = batches.map(batch => ({
      _id: batch._id,
      name: batch.name
    }));
    
    res.json({
      profile: {
        name: (req as any).user.name,
        email: (req as any).user.email,
        courses,
        batches: batchesInfo
      }
    });
  } catch (error) {
    console.error('Error fetching TA profile:', error);
    next(error);
  }
};

/**
 * Get pending enrollment requests for courses and batches where the user is a TA
 */
export const getPendingEnrollments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const taId = (req as any).user.id;
    
    // Find all batches where the user is assigned as a TA
    const batches = await Batch.find({ ta: taId });
    
    if (!batches || batches.length === 0) {
      res.json({ pendingEnrollments: [] });
      return;
    }
    
    const batchIds = batches.map(batch => batch._id);
    
    // Find pending enrollments for these batches
    const pendingEnrollments = await Enrollment.find({
      batchId: { $in: batchIds },
      status: 'pending'
    })
    .populate('studentId', 'name email')
    .populate('courseId', 'name code')
    .populate('batchId', 'name');
    
    // Format the response (without year)
    const formattedEnrollments = pendingEnrollments.map(enrollment => ({
      _id: enrollment._id,
      student: {
        name: (enrollment.studentId as any).name,
        email: (enrollment.studentId as any).email
      },
      course: {
        _id: enrollment.courseId,
        name: (enrollment.courseId as any).name,
        code: (enrollment.courseId as any).code
      },
      batch: {
        _id: enrollment.batchId,
        name: (enrollment.batchId as any).name
      },
      requestDate: enrollment.enrollmentDate,
      status: enrollment.status
    }));
    
    res.json({ pendingEnrollments: formattedEnrollments });
  } catch (error) {
    console.error('Error fetching pending enrollments:', error);
    next(error);
  }
};

/**
 * Handle enrollment decision (approve/reject)
 */
export const handleEnrollmentDecision = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { enrollmentId } = req.params;
    const { decision, notes } = req.body;
    const taId = (req as any).user.id;
    
    if (!['approve', 'reject'].includes(decision)) {
      res.status(400).json({ error: 'Invalid decision. Must be "approve" or "reject"' });
      return;
    }
    
    // Find the enrollment and populate the course and batch information
    const enrollment = await Enrollment.findById(enrollmentId)
      .populate('courseId', 'name code')
      .populate('batchId', 'name');
      
    if (!enrollment) {
      res.status(404).json({ error: 'Enrollment request not found' });
      return;
    }
    
    // Verify that the TA is assigned to this batch
    const batch = await Batch.findById(enrollment.batchId);
    if (!batch || !batch.ta.includes(taId)) {
      res.status(403).json({ error: 'Not authorized to manage this enrollment' });
      return;
    }
    
    // Update enrollment status based on decision
    enrollment.status = decision === 'approve' ? 'completed' : 'rejected';
    if (notes) {
      enrollment.notes = notes;
    }
    await enrollment.save();
    
    // Get course name for notifications
    const courseName = (enrollment.courseId as any)?.name || 'the course';
    
    // If approved, add student to the batch's students array
    if (decision === 'approve') {
      // Check if student is already in the batch to avoid duplicates
      if (!batch.students.includes(enrollment.studentId)) {
        batch.students.push(enrollment.studentId);
        await batch.save();
      }
      
      // Notify the student that their enrollment was approved
      // Remove relatedResource since 'course' is not in the enum
      await Notification.create({
        recipient: enrollment.studentId,
        message: `Your enrollment for ${courseName} has been approved.`
      });
    } else {
      // Notify the student that their enrollment was rejected
      // Remove relatedResource since 'course' is not in the enum
      await Notification.create({
        recipient: enrollment.studentId,
        message: `Your enrollment for ${courseName} has been declined.`
      });
    }
    
    res.json({
      message: `Enrollment ${decision === 'approve' ? 'approved' : 'rejected'} successfully`,
      status: enrollment.status
    });
  } catch (error) {
    console.error('Error handling enrollment decision:', error);
    res.status(500).json({ error: 'Internal server error while processing enrollment decision' });
  }
};

/**
 * Get all tickets for TA's assigned batches and courses (excluding unchecked evaluation tickets)
 */
export const getStudentTickets = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const taId = (req as any).user.id;
    
    // Find all batches where the user is assigned as a TA
    const batches = await Batch.find({ ta: taId });
    
    if (!batches || batches.length === 0) {
      res.json({ tickets: [] });
      return;
    }
    
    // Get all exams for TA's batches
    const batchIds = batches.map(batch => batch._id);
    const exams = await Exam.find({ batch: { $in: batchIds } });
    const examIds = exams.map(exam => exam._id);
    
    // Find tickets for these exams where TA is assigned and status is open
    // EXCLUDE tickets with message "unchecked" as they are handled separately
    const tickets = await Ticket.find({
      ta: taId,
      exam: { $in: examIds },
      status: 'open',
      escalatedToTeacher: false,
      message: { $ne: "unchecked" } // Exclude unchecked evaluation tickets
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
    
    res.json({ tickets });
  } catch (error) {
    console.error('Error fetching student tickets:', error);
    next(error);
  }
};

/**
 * Get the submission PDF for a student's exam submission
 */
export const getSubmissionPdf = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { ticketId } = req.params;
    const taId = (req as any).user.id;

    // Find the ticket first to get exam and student information
    const ticket = await Ticket.findById(ticketId)
      .populate('exam')
      .populate('student');

    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    // Verify TA is authorized to access this ticket
    if (ticket.ta.toString() !== taId) {
      res.status(403).json({ error: 'Not authorized to access this submission' });
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
 * Resolve a student ticket with updated marks
 */
export const resolveTicket = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { ticketId } = req.params;
    const { resolution, newMarks, feedback } = req.body;
    const taId = (req as any).user.id;

    const ticket = await Ticket.findById(ticketId)
      .populate('exam')
      .populate('student');
      
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    // Verify TA is assigned to this ticket
    if (ticket.ta.toString() !== taId) {
      res.status(403).json({ error: 'Not authorized to resolve this ticket' });
      return;
    }

    // Find the evaluation related to this ticket
    const evaluation = await Evaluation.findOne({
      exam: ticket.exam,
      evaluator: ticket.evaluator,
      evaluatee: ticket.student
    });

    if (!evaluation) {
      res.status(404).json({ error: 'Related evaluation not found' });
      return;
    }

    // If new marks are provided, validate and update the evaluation
    if (newMarks) {
      // Validate marks array
      if (!Array.isArray(newMarks)) {
        res.status(400).json({ error: 'Marks must be provided as an array' });
        return;
      }

      // Get expected number of questions from exam
      const expectedQuestions = (ticket.exam as any)?.numQuestions || evaluation.marks.length;

      if (newMarks.length !== expectedQuestions) {
        res.status(400).json({
          error: `Expected ${expectedQuestions} marks, but received ${newMarks.length}`
        });
        return;
      }

      // Validate each mark
      for (const mark of newMarks) {
        if (typeof mark !== 'number' || mark < 0 || mark > 20) {
          res.status(400).json({
            error: 'Each mark must be a number between 0 and 20'
          });
          return;
        }
      }

      // Update the evaluation
      evaluation.marks = newMarks;
      if (feedback) {
        evaluation.feedback = feedback;
      }
      evaluation.status = 'completed';
      
      // Preserve the original evaluator if this is the first TA correction
      if (!evaluation.isTACorrected) {
        evaluation.originalEvaluator = evaluation.evaluator; // Store the original peer evaluator
        evaluation.isTACorrected = true; // Mark that a TA corrected this
        evaluation.taCorrector = taId; // Track which TA corrected it
        evaluation.evaluator = taId; // Update evaluator to TA for aggregation purposes
      }
      
      await evaluation.save();
    }

    // Update ticket status to closed
    ticket.status = 'closed';
    await ticket.save();

    // Notify the student who raised the ticket
    await Notification.create({
      recipient: ticket.student,
      message: `Your ticket regarding the evaluation has been resolved by a TA.`,
      relatedResource: {
        type: 'evaluation',
        id: evaluation._id
      }
    });

    res.json({
      message: 'Ticket resolved successfully',
      resolution
    });
  } catch (error) {
    console.error('Error resolving ticket:', error);
    next(error);
  }
};

/**
 * Escalate a ticket to teachers
 */
export const escalateTicketToTeacher = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { ticketId } = req.params;
    const { reason } = req.body;
    const taId = (req as any).user.id;

    const ticket = await Ticket.findById(ticketId)
      .populate('exam')
      .populate('student');
      
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    // Verify TA is assigned to this ticket
    if (ticket.ta.toString() !== taId) {
      res.status(403).json({ error: 'Not authorized to escalate this ticket' });
      return;
    }

    // Update ticket status to escalated
    ticket.escalatedToTeacher = true;
    await ticket.save();

    // Get the exam with batch information
    const exam = await Exam.findById(ticket.exam).populate({
      path: 'batch',
      populate: {
        path: 'instructor',
        select: 'name email'
      }
    });

    if (!exam) {
      res.status(404).json({ error: 'Associated exam not found' });
      return;
    }

    const batch = exam.batch as any;
    if (!batch || !batch.instructor) {
      res.status(404).json({ error: 'Batch instructor not found' });
      return;
    }

    // Find the evaluation related to this ticket
    const evaluation = await Evaluation.findOne({
      exam: ticket.exam,
      evaluator: ticket.evaluator,
      evaluatee: ticket.student
    });

    if (!evaluation) {
      res.status(404).json({ error: 'Related evaluation not found' });
      return;
    }

    // Create a teacher ticket with evaluation ID
    const teacherTicket = new TeacherTicket({
      subject: `Escalated Evaluation Ticket - ${exam.title}`,
      description: `${reason}\n\nOriginal student message: ${ticket.message}`,
      student: ticket.student,
      ta: taId,
      evaluationId: evaluation._id  // Use evaluation ID instead of exam ID
    });

    await teacherTicket.save();

    // Notify only the specific instructor (teacher) of this batch
    await Notification.create({
      recipient: batch.instructor._id,
      message: `A ticket has been escalated from TA and requires your attention regarding ${exam.title}`,
      relatedResource: {
        type: 'evaluation',
        id: teacherTicket._id
      }
    });

    // Also notify the student who raised the ticket
    await Notification.create({
      recipient: ticket.student,
      message: 'Your ticket has been escalated to a teacher for review',
      relatedResource: {
        type: 'evaluation',
        id: ticket._id
      }
    });

    res.json({
      message: 'Ticket escalated to teacher successfully',
      reason
    });
  } catch (error) {
    console.error('Error escalating ticket:', error);
    next(error);
  }
};

/**
 * Get TA dashboard statistics
 */
export const getTAStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const taId = (req as any).user.id;
    
    const openTickets = await Ticket.countDocuments({ 
      ta: taId, 
      status: 'open', 
      escalatedToTeacher: false 
    });
    
    const closedTickets = await Ticket.countDocuments({ 
      ta: taId, 
      status: 'closed' 
    });
    
    const escalatedTickets = await Ticket.countDocuments({ 
      ta: taId, 
      escalatedToTeacher: true 
    });

    res.json({
      stats: {
        openTickets,
        closedTickets,
        escalatedTickets,
        totalTickets: openTickets + closedTickets + escalatedTickets
      }
    });
  } catch (error) {
    console.error('Error fetching TA stats:', error);
    next(error);
  }
};

// Add this function to the existing ta.controller.ts file

/**
 * Get the answer key PDF for an exam (for student tickets)
 */
export const getAnswerKeyPdf = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { ticketId } = req.params;
    const taId = (req as any).user.id;

    // Find the ticket first to get exam information
    const ticket = await Ticket.findById(ticketId)
      .populate('exam');

    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    // Verify TA is authorized to access this ticket
    if (ticket.ta.toString() !== taId) {
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
