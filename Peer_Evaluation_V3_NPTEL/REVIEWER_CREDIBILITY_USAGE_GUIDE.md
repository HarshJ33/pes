# Reviewer Credibility Scoring - Usage Guide

## Quick Start

### Step 1: After Exam Evaluation Period Ends
Once all students have submitted their peer evaluations:

```bash
POST /admin/evaluator-credibility/calculate/:examId
```

**Response:**
```json
{
  "success": true,
  "message": "Evaluator credibility scores calculated successfully",
  "examId": "507f1f77bcf86cd799439011"
}
```

This triggers:
- Analysis of all peer evaluations for the exam
- Calculation of credibility scores for each evaluator
- Creation of EvaluatorProfile documents
- Caching of credibility scores in Evaluation records

### Step 2: Monitor Quality
View evaluator statistics to identify problematic reviewers:

```bash
GET /admin/evaluator-credibility/stats/:examId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "exam": {
      "id": "507f1f77bcf86cd799439011",
      "title": "Midterm Exam - Data Structures"
    },
    "evaluators": [
      {
        "evaluator": {
          "id": "507f1f77bcf86cd799439012",
          "name": "Alice Kumar",
          "email": "alice@university.edu",
          "uid": "U123456"
        },
        "metrics": {
          "totalEvaluations": 8,
          "averageScoreGiven": 68.5,
          "scoreVariance": 145.3,
          "scoreStdDev": 12.05,
          "biasVsClassAverage": 0.15,
          "correlationWithTruth": 0.92,
          "accuracyVsTA": 0.875
        },
        "credibilityScore": 0.88,
        "trustWeightMultiplier": 1.32,
        "isFlaggedAsUnreliable": false,
        "lastUpdated": "2024-01-15T10:30:00Z"
      },
      {
        "evaluator": {
          "id": "507f1f77bcf86cd799439013",
          "name": "Bob Smith",
          "email": "bob@university.edu",
          "uid": "U123457"
        },
        "metrics": {
          "totalEvaluations": 7,
          "averageScoreGiven": 45.2,
          "scoreVariance": 890.5,
          "scoreStdDev": 29.84,
          "biasVsClassAverage": -0.42,
          "correlationWithTruth": 0.31,
          "accuracyVsTA": 0.29
        },
        "credibilityScore": 0.21,
        "trustWeightMultiplier": 0.71,
        "isFlaggedAsUnreliable": true,
        "lastUpdated": "2024-01-15T10:30:00Z"
      }
    ],
    "summary": {
      "totalEvaluators": 2,
      "averageCredibilityScore": "0.545",
      "unreliableEvaluators": 1
    }
  }
}
```

### Step 3: Interpret the Results

**Alice Kumar** - Excellent evaluator ✅
- **Credibility: 0.88** (very high)
- **Trust Weight: 1.32** (gets 32% MORE influence)
- Low variance (12.05) = consistent grader
- Small positive bias (0.15) = slightly lenient, acceptable
- 92% correlation with TA reviews = highly accurate
- **Outcome**: Her grades will have 1.32× weight in averaging

**Bob Smith** - Problematic evaluator ⚠️
- **Credibility: 0.21** (low)
- **Trust Weight: 0.71** (gets 29% LESS influence)
- HIGH variance (29.84) = wildly inconsistent
- Large negative bias (-0.42) = very harsh grader
- 31% correlation with TA = not aligned with expert opinion
- **Already flagged as unreliable**
- **Outcome**: His grades will have 0.71× weight (reduced influence)

---

## Real Example: How This Affects Grades

Say a student "Alex" received evaluations from Alice and Bob (and 6 others):

### Without Credibility Weighting (Old System)
```
Alice gave: 80
Bob gave:   45
6 others:   72, 68, 75, 70, 73, 74

Simple Average = (80+45+72+68+75+70+73+74) / 8 = 69.4
```
Bob's harsh outlier drags the average down by ~2 points!

### With Credibility Weighting (New System)
```
Alice (0.88 credibility):    80 × 1.32 = 105.6
Bob (0.21 credibility):      45 × 0.71 = 31.95
Others average (0.60 credibility): 72.6 × 1.0 = 72.6

Weighted Average = (105.6 + 31.95 + 72.6) / (1.32 + 0.71 + 1.0)
                 = 210.15 / 3.03
                 = 69.4 → 71.2
```
**Alex gets a fairer grade of 71.2 instead of 69.4!**

---

## Practical Scenarios

### Scenario 1: Identifying a Collusion Ring

Three evaluators (X, Y, Z) consistently give 100% to their friends and 0 to everyone else:

**Credibility Stats would show:**
- High variance (0, 100, 0, 100, 0, 100 - bimodal distribution)
- High positive bias (they always give max marks)
- Low correlation with TA reviews
- Result: Credibility score 0.15-0.25, heavily flagged

**Action**: Teacher flags them, reduces their weight, reviews their evaluations

---

### Scenario 2: New Grader Learning Curve

Evaluator J is inconsistent but well-intentioned:

**First assignment metrics:**
- Total evals: 5
- Variance: 300 (high - still learning)
- Bias: 0.05 (neutral)
- Correlation with TA: 0.68
- **Credibility: 0.42** (below average)
- **Trust Weight: 0.92** (slightly reduced)

After coaching and experience:

**Second assignment metrics:**
- Total evals: 6
- Variance: 50 (much improved!)
- Bias: -0.02 (still neutral)
- Correlation with TA: 0.89
- **Credibility: 0.85** (excellent!)
- **Trust Weight: 1.27** (now influential)

**Action**: System automatically improves their credibility→teacher can provide positive feedback

---

### Scenario 3: Technical/Grade Inflation System

Some evaluators naturally give high marks without being dishonest:

**Metrics:**
- Variance: 45 (consistent)
- Bias: +0.35 (leniently by design)
- Correlation with TA: 0.81 (accurate despite being lenient)
- **Credibility: 0.72** (decent)
- **Trust Weight: 1.06**

**Interpretation**: They're reliable but lenient. The system:
1. Reduces their influence slightly to prevent grade inflation
2. Preserves some influence (they're still accurate)
3. Teacher can decide if this is acceptable (maybe they're assessing clarity rather than correctness)

---

## Manual Adjustments

### When to Flag an Evaluator

Flag someone as unreliable if:
- Credibility score < 0.30 AND you've reviewed their eval
- Variance is extremely high (> 400) indicating random grading
- Correlation with TA is < 0.40 (seriously misaligned)

```bash
PUT /admin/evaluator-credibility/flag/:evaluatorId/:examId
Content-Type: application/json

{
  "isFlagged": true,
  "reason": "Systematic grade inflation detected - consistently gave 95%+ despite TA ground truth averaging 65%"
}
```

**Effect**: Trust weight capped at 0.5 (maximum 50% influence)

### When to Adjust Trust Weight Manually

Override automatic calculation if:
- You've identified grading error that affects credibility
- You want to give bonus to a particularly good evaluator
- You need to penalize beyond automated flags

```bash
PUT /admin/evaluator-credibility/trust-weight/:evaluatorId/:examId
Content-Type: application/json

{
  "trustWeightMultiplier": 1.8
}
```

**Valid range**: 0 to 2.0

---

## Viewing Results (Student Side)

### What Students See

Students view: `GET /student/evaluation-results`

Response includes:
```json
{
  "exam": "...",
  "grading": {
    "simpleAverage": "69.40",
    "weightedAverage": "71.20",
    "finalGrade": "71.20",
    "description": "Grade calculated with reviewer credibility weighting"
  },
  "evaluators": [
    {
      "name": "Alice Kumar",
      "credibilityScore": 0.88,
      "trustWeight": 1.32
    },
    {
      "name": "Bob Smith",
      "credibilityScore": 0.21,
      "trustWeight": 0.71
    }
  ],
  "credibilityInfo": {
    "averageCredibilityScore": "0.545",
    "trustWeightedCount": 1,
    "unreliableEvaluatorCount": 1
  }
}
```

**Students understand:**
- Their final grade is 71.20 (weighted average)
- Who evaluated them and their credibility
- That unreliable evaluators had less influence
- System is fair and objective

---

## Recalculation & Updates

### When to Recalculate

1. **After exam completion** - Initial calculation
2. **After TA corrections** - If you've fixed many evaluations
3. **Manual request** - If metrics have changed significantly

### How to Recalculate

```bash
POST /admin/evaluator-credibility/calculate/:examId
```

This:
- Re-analyzes all completed, non-TA-corrected evaluations
- Updates all EvaluatorProfile records
- Recalculates credibility scores
- Updates cached values in Evaluation records

**Running time**: ~500-1000ms for typical exam class

---

## Data Preservation & Audit Trail

### What Changed
Previously: When TA corrected an eval, original grader was lost
Now: Original grader info is preserved

### Where to Find It
In MongoDB Evaluation document:
```javascript
{
  evaluator: ObjectId(taId),              // Current: TA who corrected
  originalEvaluator: ObjectId(studentId), // NEW: Original peer evaluator
  isTACorrected: true,                    // NEW: Flag for TA correction
  taCorrector: ObjectId(taId)             // NEW: Which TA corrected
}
```

### How It Helps

1. **Fairness**: TA corrections don't hurt original evaluator's credibility
   - Bob's harsh eval isn't used to flag him as unreliable if TA disagreed

2. **Learning**: See what peer evaluators got wrong
   - Compare original eval to TA's correct answers
   - Feed back to peers for calibration

3. **Audit**: Full trace of who graded what and who corrected
   - Regulatory compliance
   - Dispute resolution

---

## Best Practices

### ✅ Do This

1. **Run calculation after each exam** - Not doing it leaves scores at default
2. **Review stats dashboard regularly** - Catch problems early
3. **Coach low-credibility evaluators** - Most are just learning
4. **Flag patterns, not individuals**- If 5 evaluators are bad, investigate why
5. **Give students transparency** - Let them see credibility of their reviewers

### ❌ Don't Do This

1. **Manually override weights constantly** - Algorithm learns/improves
2. **Flag based on one bad eval** - Need pattern of issues
3. **Hide credibility from students** - Creates distrust
4. **Ignore high variance evaluators** - These are good to catch early
5. **Remove suspicious evaluators** - Use weights and corrections instead

---

## Testing & Validation

### Validate the System

```bash
# 1. Submit some peer evaluations (as students)
# 2. Check they're in "completed" status

# 3. Run credibility calculation
POST /admin/evaluator-credibility/calculate/:examId

# 4. View results
GET /admin/evaluator-credibility/stats/:examId

# 5. Check student can see weighted results
GET /student/evaluation-results

# 6. Verify: weighted average ≠ simple average
# (if all credibilities are 0.5, they should be equal)
```

### Common Issues

**Q: All credibility scores are 0.5?**
A: Calculation hasn't run. Need `POST .../calculate/:examId`

**Q: Weighted average same as simple average?**
A: All evaluators have ~1.0 weight (credibilities around 0.5). This is normal if:
- Few evaluations per student
- No clear good/bad evaluators yet
- First time calculating

**Q: One evaluator drastically changes the average?**
A: Check if they're flagged as unreliable. If not but suspicious, review their evaluations manually.

---

## Next Steps

1. **Deploy** the changes to production
2. **Run** credibility calculation after first exam
3. **Monitor** for issues in student results
4. **Gather feedback** from teachers and students
5. **Iterate** on weights/formulas if needed

Questions? Check `REVIEWER_CREDIBILITY_SYSTEM.md` for technical details.
