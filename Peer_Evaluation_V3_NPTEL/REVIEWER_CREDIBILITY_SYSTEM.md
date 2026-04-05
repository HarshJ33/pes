# Reviewer Credibility Scoring System

## Overview

The Reviewer Credibility Scoring System is a dynamic trust evaluation mechanism that assesses the reliability and consistency of peer evaluators (students conducting peer reviews). Instead of treating all peer evaluations equally, this system:

1. **Tracks evaluator behavior** across multiple metrics
2. **Calculates credibility scores** based on consistency, bias, and accuracy
3. **Weights evaluations accordingly** so bad evaluators don't distort final grades
4. **Identifies unreliable evaluators** for manual intervention

---

## Core Metrics

### 1. **Consistency Score**
- **What it measures**: How consistent an evaluator is with their scoring
- **How it's calculated**: Inverse of score variance
  - Low variance → high consistency → good score
  - High variance → inconsistent grader → low score
- **Impact**: Evaluators who grade erratically are penalized

### 2. **Bias Analysis** 
- **What it measures**: Whether evaluator gives systematically high or low marks
- **How it's calculated**:
  - Compare evaluator's average score with class average
  - Track deviation per question
  - Results in bias score from -1 (harsh) to +1 (lenient)
- **Impact**: Consistent biases are identified and partially penalized
  - Small biases (±0.1) have minimal impact
  - Large biases (±0.5+) significantly reduce credibility

### 3. **Accuracy vs TA Ground Truth** (When available)
- **What it measures**: How well evaluator scores match TA-reviewed ground truth
- **How it's calculated**:
  - When a TA corrects a peer evaluation, correlation is calculated
  - Scores are compared question-by-question
  - Accuracy metric (0-1) showing match percentage
- **Impact**: Those aligned with expert judgment get higher trust

### 4. **Credibility Score (Final)**
- **Range**: 0 to 1 (1 = fully trustworthy)
- **Formula**: `consistency × bias_tolerance × accuracy`
  - `consistency` = 1 - (variance / max_variance)
  - `bias_tolerance` = 1 - (|bias| × 0.5)
  - `accuracy` = correlation with TA reviews
- **Default**: 0.5 (neutral) when insufficient data

---

## Trust Weight Multiplier

Each evaluator gets a **Trust Weight Multiplier** (0.5 - 1.5) derived from credibility:

- **0.5** (low trust) = Only 50% of normal weight
  - Given to unreliable evaluators
  - Prevents bad graders from heavily influencing final grade

- **1.0** (neutral/expected) = Normal weight
  - Default for unexamined evaluators
  - Credibility score around 0.5

- **1.5** (high trust) = 150% weight
  - Given to very reliable evaluators
  - Their grades influence the final average more

### How Trust Weights Are Applied

When calculating a student's final grade from peer evaluations:

```
Weighted Average = Σ(evaluator_score × evaluator_trust_weight) / Σ(trust_weights)
```

Instead of simple average, this ensures:
- High-credibility evaluators have more influence
- Low-credibility evaluators have less influence
- The final grade better reflects actual student performance

---

## Data Preservation During TA Corrections

### The Problem
Previously, when a TA corrected a peer evaluation:
- The original peer evaluator ID was lost
- You couldn't track who was wrong or how they were calibrated
- No audit trail for corrections

### The Solution
New fields in Evaluation model:

```javascript
isTACorrected: Boolean        // Whether TA correctedthis
originalEvaluator: ObjectId   // Original peer reviewer (preserved)
taCorrector: ObjectId         // Which TA made the correction
```

Now when TA corrects:
1. Original peer evaluator is preserved
2. TA correction is tracked
3. Credibility calculations can compare original vs correct answer
4. Full audit trail is maintained

---

## Workflow & Triggers

### 1. **During Peer Evaluation**
- Student submits evaluation (marks + feedback)
- Evaluation marked as `completed`
- No credibility score yet (not enough data)

### 2. **After Exam Completion** (Manual Trigger)
- Admin/Teacher calls: `POST /admin/evaluator-credibility/calculate/:examId`
- System analyzes all completed evaluations
- For each evaluator:
  - Calculates consistency, bias, accuracy
  - Derives credibility score
  - Updates trust weight multiplier
  - Optionally flags unreliable evaluators
- EvaluatorProfile documents created/updated
- Evaluation documents updated with cached scores

### 3. **When Displaying Student Results**
- Student views results via `GET /student/evaluation-results`
- System uses **weighted average** instead of simple average
- Shows:
  - `finalGrade`: The weighted average (primary grade)
  - `simpleAverage`: For comparison/transparency
  - `evaluators`: List with each evaluator's credibility score
  - `credibilityInfo`: Summary stats

### 4. **Teacher Quality Monitoring** (Optional)
- Teacher views: `GET /admin/evaluator-credibility/stats/:examId`
- See all evaluators ranked by credibility
- Identify problematic reviewers
- Manually adjust weights if needed

---

## Key Endpoints

### Admin/Teacher Routes

#### 1. Calculate Credibility Scores for an Exam
```
POST /admin/evaluator-credibility/calculate/:examId
Authorization: admin, teacher
Response: { success: true, message: "...", examId }
```
Triggers recalculation of all evaluator scores for the given exam.

#### 2. Get Credibility Statistics
```
GET /admin/evaluator-credibility/stats/:examId
Authorization: admin, teacher
Response: {
  success: true,
  data: {
    exam: { id, title },
    evaluators: [
      {
        evaluator: { id, name, email, uid },
        metrics: {
          totalEvaluations,
          averageScoreGiven,
          scoreVariance,
          scoreStdDev,
          biasVsClassAverage,
          correlationWithTruth,
          accuracyVsTA
        },
        credibilityScore,
        trustWeightMultiplier,
        isFlaggedAsUnreliable,
        lastUpdated
      }
    ],
    summary: {
      totalEvaluators,
      averageCredibilityScore,
      unreliableEvaluators
    }
  }
}
```

#### 3. Flag/Unflag Unreliable Evaluator
```
PUT /admin/evaluator-credibility/flag/:evaluatorId/:examId
Body: { isFlagged: boolean, reason?: string }
Authorization: admin, teacher
```

#### 4. Manually Adjust Trust Weight
```
PUT /admin/evaluator-credibility/trust-weight/:evaluatorId/:examId
Body: { trustWeightMultiplier: number (0-2) }
Authorization: admin, teacher
```

### Student Routes

#### View Evaluation Results (with Weighted Grading)
```
GET /student/evaluation-results
Response: {
  results: [
    {
      exam: { _id, title, ... },
      grading: {
        simpleAverage: "75.50",
        weightedAverage: "76.20",
        finalGrade: "76.20",
        description: "Grade calculated with reviewer credibility weighting"
      },
      evaluators: [
        {
          _id, name,
          credibilityScore: 0.85,
          trustWeight: 1.27
        }
      ],
      credibilityInfo: {
        averageCredibilityScore: "0.82",
        trustWeightedCount: 2,
        unreliableEvaluatorCount: 0
      }
    }
  ]
}
```

---

## Implementation Details

### Models

#### EvaluatorProfile
```typescript
{
  evaluator: ObjectId,           // The peer reviewer
  exam: ObjectId,                // Which exam
  course: ObjectId,              // Which course
  
  totalEvaluations: Number,      // How many they graded
  averageScoreGiven: Number,     // Their average marks
  scoreVariance: Number,         // Consistency metric
  scoreStdDev: Number,           
  
  biasVsClassAverage: Number,    // -1 to +1
  biasVsGradeAverage: Number,
  correlationWithTruth: Number,  // 0 to 1
  accuracyVsTA: Number,          // 0 to 1
  
  credibilityScore: Number,      // Final score (0-1)
  trustWeightMultiplier: Number, // 0.5-1.5
  isFlaggedAsUnreliable: Boolean,
  
  lastUpdated: Date
}
```

#### Evaluation (updated fields)
```typescript
{
  // ... existing fields ...
  evaluatorCredibilityScore: Number,      // Cached
  evaluatorTrustWeight: Number,           // Cached
  
  isTACorrected: Boolean,                 // Audit trail
  originalEvaluator: ObjectId,            // Original peer
  taCorrector: ObjectId                   // Which TA corrected
}
```

### Utility Functions

All calculations live in: `utils/credibilityScoring.ts`

Key functions:
- `calculateScoreStatistics()` - Variance & std dev
- `calculateBiasVsClassAverage()` - Bias metrics
- `calculateAccuracyVsTA()` - Correlation
- `updateEvaluatorCredibilityScore()` - Main calculation
- `recalculateAllEvaluatorScores()` - Batch recalculation
- `getEvaluatorCredibilityStats()` - For dashboards

---

## Configuration & Tuning

### Adjustable Parameters

In `utils/credibilityScoring.ts`:

```typescript
// How much variance affects score (lower = more sensitive)
const maxExpectedVariance = 100;

// How much bias affects score (lower = harsher)
const maxExpectedDeviation = 20;

// Formula weights
const credibilityScore = consistency * biasPenalty * accuracy;
```

### Manual Adjustments

Teachers/Admins can:
1. Manually flag evaluators as unreliable
2. Adjust trust weight multiplier (0-2 range)
3. Re-trigger full recalculation after making changes

---

## Benefits

✅ **Better Grade Accuracy**
- Bad evaluators don't distort the final grade
- Good evaluators have appropriate influence

✅ **Fairness**
- Students aren't unfairly penalized by harsh/lenient reviewers
- Consistency is rewarded

✅ **Transparency**
- Students can see credibility scores of their evaluators
- Clear audit trail of corrections

✅ **Quality Monitoring**
- Teachers identify problematic evaluators
- Opportunity for coaching/intervention

✅ **Fraud Detection**
- Evaluators giving random marks are caught
- Collusion patterns become obvious

---

## Future Enhancements

1. **Real-time Updates**: Recalculate scores as new evaluations come in
2. **Peer Calibration**: Show evaluators how they compare to peers
3. **Appeal Process**: Students can appeal low grades with credibility stats
4. **Weighted Peer Groups**: Group students by skill level for evaluation
5. **ML-Based Outlier Detection**: Automatically flag suspicious grading patterns
6. **Historical Tracking**: Track evaluator improvement over multiple exams

---

## Setup Instructions

1. **Database Migration**:
   - New `EvaluatorProfile` collection will be created on first insert
   - Existing `Evaluation` records will get new fields (nullable, safe)

2. **After Exam Completion**:
   ```bash
   curl -X POST /admin/evaluator-credibility/calculate/{examId} \
     -H "Authorization: Bearer {token}" \
     -H "Content-Type: application/json"
   ```

3. **Monitor Credibility**:
   ```bash
   curl -X GET /admin/evaluator-credibility/stats/{examId} \
     -H "Authorization: Bearer {token}"
   ```

4. **Students See Weighted Grades**:
   - No changes needed - automatic on next results fetch
   - Earlier default to 0.5 credibility (neutral)

---

## Troubleshooting

**Problem**: Credibility scores all 0.5 (default)
- **Cause**: Calculation hasn't run yet
- **Fix**: Run `POST /admin/evaluator-credibility/calculate/:examId`

**Problem**: Weighted average very different from simple average
- **Cause**: Some evaluators have very low credibility
- **Fix**: Check individual credibility scores and flag if needed

**Problem**: Zero evaluators found for calculation
- **Cause**: No completed evaluations for that exam
- **Fix**: Ensure students have submitted evaluations before calculating

---

## API Testing Examples

See [credibilityScoring.test.ts] for complete test suite.

Key test scenarios:
- Consistent vs inconsistent evaluators
- Harsh vs lenient evaluators
- TA correction audit trail
- Weighted average calculations
