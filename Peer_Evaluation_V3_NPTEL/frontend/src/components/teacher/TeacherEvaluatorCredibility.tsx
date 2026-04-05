import { useState, useEffect } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { FiRefreshCw, FiEye, FiFlag, FiTrendingUp, FiAlertTriangle, FiCheckCircle } from "react-icons/fi";

const PORT = import.meta.env.VITE_BACKEND_PORT || 5000;

interface EvaluatorProfile {
  evaluator: {
    id: string;
    name: string;
    email: string;
    uid: string;
  };
  metrics: {
    totalEvaluations: number;
    averageScoreGiven: number;
    scoreVariance: number;
    scoreStdDev: number;
    biasVsClassAverage: number;
    correlationWithTruth: number;
    accuracyVsTA: number;
  };
  credibilityScore: number;
  trustWeightMultiplier: number;
  isFlaggedAsUnreliable: boolean;
  lastUpdated: string;
}

interface Exam {
  _id: string;
  title: string;
  course: {
    name: string;
  };
}

interface CredibilityStats {
  exam: {
    id: string;
    title: string;
  };
  evaluators: EvaluatorProfile[];
  summary: {
    totalEvaluators: number;
    averageCredibilityScore: string;
    unreliableEvaluators: number;
  };
}

type Props = {
  darkMode: boolean;
};

const TeacherEvaluatorCredibility = ({ darkMode }: Props) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>("");
  const [credibilityStats, setCredibilityStats] = useState<CredibilityStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [flaggingEvaluator, setFlaggingEvaluator] = useState<string | null>(null);
  const [adjustingWeight, setAdjustingWeight] = useState<string | null>(null);
  const [newWeight, setNewWeight] = useState<number>(1.0);
  const [error, setError] = useState<string>("");

  const token = localStorage.getItem("token");

  // Color palette
  const colors = {
    bg: darkMode ? "#1A202C" : "#FFFBF6",
    cardBg: darkMode ? "#2D3748" : "#FFFAF2",
    text: darkMode ? "#E2E8F0" : "#4B0082",
    textMuted: darkMode ? "#A0AEC0" : "#A9A9A9",
    border: darkMode ? "#4A5568" : "#F0E6EF",
    accent: darkMode ? "#63B3ED" : "#800080",
    success: "#48BB78",
    warning: "#ED8936",
    danger: "#F56565",
    shadow: darkMode ? "rgba(0,0,0,0.4)" : "rgba(128,0,128,0.08)",
  };

  // Fetch teacher's exams
  useEffect(() => {
    const fetchExams = async () => {
      try {
        const response = await axios.get(`http://localhost:${PORT}/api/teacher/exams`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setExams(response.data.exams || []);
      } catch (err) {
        console.error("Error fetching exams:", err);
        setError("Failed to load exams");
      }
    };

    if (token) {
      fetchExams();
    }
  }, [token]);

  // Calculate credibility scores for selected exam
  const calculateCredibility = async () => {
    if (!selectedExam) return;

    setCalculating(true);
    setError("");

    try {
      await axios.post(
        `http://localhost:${PORT}/api/admin/evaluator-credibility/calculate/${selectedExam}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Fetch updated stats
      await fetchCredibilityStats();
    } catch (err: any) {
      console.error("Error calculating credibility:", err);
      setError(err.response?.data?.message || "Failed to calculate credibility scores");
    } finally {
      setCalculating(false);
    }
  };

  // Fetch credibility stats for selected exam
  const fetchCredibilityStats = async () => {
    if (!selectedExam) return;

    setLoading(true);
    setError("");

    try {
      const response = await axios.get(
        `http://localhost:${PORT}/api/admin/evaluator-credibility/stats/${selectedExam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCredibilityStats(response.data.data);
    } catch (err: any) {
      console.error("Error fetching credibility stats:", err);
      setError(err.response?.data?.message || "Failed to load credibility statistics");
    } finally {
      setLoading(false);
    }
  };

  // Flag/unflag evaluator as unreliable
  const toggleEvaluatorFlag = async (evaluatorId: string, currentlyFlagged: boolean) => {
    setFlaggingEvaluator(evaluatorId);

    try {
      await axios.put(
        `http://localhost:${PORT}/api/admin/evaluator-credibility/flag/${evaluatorId}/${selectedExam}`,
        { isFlagged: !currentlyFlagged },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Refresh stats
      await fetchCredibilityStats();
    } catch (err: any) {
      console.error("Error toggling evaluator flag:", err);
      setError(err.response?.data?.message || "Failed to update evaluator flag");
    } finally {
      setFlaggingEvaluator(null);
    }
  };

  // Adjust trust weight
  const adjustTrustWeight = async (evaluatorId: string) => {
    if (newWeight < 0 || newWeight > 2) {
      setError("Trust weight must be between 0 and 2");
      return;
    }

    setAdjustingWeight(evaluatorId);

    try {
      await axios.put(
        `http://localhost:${PORT}/api/admin/evaluator-credibility/trust-weight/${evaluatorId}/${selectedExam}`,
        { trustWeightMultiplier: newWeight },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Refresh stats
      await fetchCredibilityStats();
      setAdjustingWeight(null);
    } catch (err: any) {
      console.error("Error adjusting trust weight:", err);
      setError(err.response?.data?.message || "Failed to adjust trust weight");
    } finally {
      setAdjustingWeight(null);
    }
  };

  // Get credibility color and label
  const getCredibilityInfo = (score: number) => {
    if (score >= 0.8) return { color: colors.success, label: "Excellent", icon: "⭐" };
    if (score >= 0.6) return { color: "#48BB78", label: "Good", icon: "✅" };
    if (score >= 0.4) return { color: colors.warning, label: "Average", icon: "⚠️" };
    if (score >= 0.2) return { color: "#ED8936", label: "Poor", icon: "❌" };
    return { color: colors.danger, label: "Unreliable", icon: "🚫" };
  };

  // Get bias description
  const getBiasDescription = (bias: number) => {
    if (Math.abs(bias) < 0.1) return "Neutral";
    if (bias > 0.1) return `Lenient (+${bias.toFixed(2)})`;
    return `Harsh (${bias.toFixed(2)})`;
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: colors.text }}>
            Evaluator Credibility Management
          </h1>
          <p className="text-lg" style={{ color: colors.textMuted }}>
            Monitor and manage peer evaluator reliability for fair grading
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: colors.cardBg,
              borderColor: colors.danger,
              color: colors.danger
            }}
          >
            <div className="flex items-center">
              <FiAlertTriangle className="mr-2" />
              {error}
            </div>
          </motion.div>
        )}

        {/* Exam Selection */}
        <motion.div
          className="p-6 rounded-xl shadow-lg"
          style={{ backgroundColor: colors.cardBg, boxShadow: `0 4px 20px ${colors.shadow}` }}
        >
          <h2 className="text-xl font-semibold mb-4" style={{ color: colors.text }}>
            Select Exam
          </h2>

          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2" style={{ color: colors.text }}>
                Choose Exam
              </label>
              <select
                value={selectedExam}
                onChange={(e) => setSelectedExam(e.target.value)}
                className="w-full p-3 rounded-lg border focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                  color: colors.text,
                  border: `1px solid ${colors.border}`
                }}
              >
                <option value="">Select an exam...</option>
                {exams.map((exam) => (
                  <option key={exam._id} value={exam._id}>
                    {exam.title} - {exam.course?.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={calculateCredibility}
                disabled={!selectedExam || calculating}
                className="px-6 py-3 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
                style={{
                  backgroundColor: colors.accent,
                  color: "#FFFFFF",
                  border: `1px solid ${colors.accent}`
                }}
              >
                <FiRefreshCw className={calculating ? "animate-spin" : ""} />
                {calculating ? "Calculating..." : "Calculate Credibility"}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={fetchCredibilityStats}
                disabled={!selectedExam || loading}
                className="px-6 py-3 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
                style={{
                  backgroundColor: colors.success,
                  color: "#FFFFFF",
                  border: `1px solid ${colors.success}`
                }}
              >
                <FiEye />
                View Stats
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Credibility Statistics */}
        {credibilityStats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <motion.div
                className="p-4 rounded-xl text-center"
                style={{ backgroundColor: colors.cardBg, boxShadow: `0 4px 20px ${colors.shadow}` }}
              >
                <div className="text-2xl font-bold" style={{ color: colors.accent }}>
                  {credibilityStats.summary.totalEvaluators}
                </div>
                <div className="text-sm" style={{ color: colors.textMuted }}>
                  Total Evaluators
                </div>
              </motion.div>

              <motion.div
                className="p-4 rounded-xl text-center"
                style={{ backgroundColor: colors.cardBg, boxShadow: `0 4px 20px ${colors.shadow}` }}
              >
                <div className="text-2xl font-bold" style={{ color: colors.success }}>
                  {credibilityStats.summary.averageCredibilityScore}
                </div>
                <div className="text-sm" style={{ color: colors.textMuted }}>
                  Avg Credibility Score
                </div>
              </motion.div>

              <motion.div
                className="p-4 rounded-xl text-center"
                style={{ backgroundColor: colors.cardBg, boxShadow: `0 4px 20px ${colors.shadow}` }}
              >
                <div className="text-2xl font-bold" style={{ color: colors.danger }}>
                  {credibilityStats.summary.unreliableEvaluators}
                </div>
                <div className="text-sm" style={{ color: colors.textMuted }}>
                  Flagged as Unreliable
                </div>
              </motion.div>
            </div>

            {/* Evaluator List */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold" style={{ color: colors.text }}>
                Evaluator Credibility Details
              </h3>

              {credibilityStats.evaluators.map((evaluator, index) => {
                const credibilityInfo = getCredibilityInfo(evaluator.credibilityScore);

                return (
                  <motion.div
                    key={evaluator.evaluator.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-6 rounded-xl"
                    style={{
                      backgroundColor: colors.cardBg,
                      boxShadow: `0 4px 20px ${colors.shadow}`,
                      border: evaluator.isFlaggedAsUnreliable ? `2px solid ${colors.danger}` : 'none'
                    }}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Evaluator Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-semibold" style={{ color: colors.text }}>
                            {evaluator.evaluator.name}
                          </h4>
                          <span
                            className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1"
                            style={{
                              backgroundColor: credibilityInfo.color + "20",
                              color: credibilityInfo.color
                            }}
                          >
                            {credibilityInfo.icon} {credibilityInfo.label}
                          </span>
                          {evaluator.isFlaggedAsUnreliable && (
                            <span
                              className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1"
                              style={{
                                backgroundColor: colors.danger + "20",
                                color: colors.danger
                              }}
                            >
                              <FiFlag size={14} /> Flagged
                            </span>
                          )}
                        </div>

                        <p className="text-sm mb-3" style={{ color: colors.textMuted }}>
                          {evaluator.evaluator.email} • UID: {evaluator.evaluator.uid}
                        </p>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="font-medium" style={{ color: colors.text }}>
                              Credibility
                            </div>
                            <div className="text-lg font-bold" style={{ color: credibilityInfo.color }}>
                              {(evaluator.credibilityScore * 100).toFixed(0)}%
                            </div>
                          </div>

                          <div>
                            <div className="font-medium" style={{ color: colors.text }}>
                              Trust Weight
                            </div>
                            <div className="text-lg font-bold" style={{ color: colors.accent }}>
                              {evaluator.trustWeightMultiplier.toFixed(2)}x
                            </div>
                          </div>

                          <div>
                            <div className="font-medium" style={{ color: colors.text }}>
                              Evaluations
                            </div>
                            <div style={{ color: colors.textMuted }}>
                              {evaluator.metrics.totalEvaluations}
                            </div>
                          </div>

                          <div>
                            <div className="font-medium" style={{ color: colors.text }}>
                              Bias
                            </div>
                            <div style={{ color: colors.textMuted }}>
                              {getBiasDescription(evaluator.metrics.biasVsClassAverage)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col gap-2 min-w-[200px]">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => toggleEvaluatorFlag(evaluator.evaluator.id, evaluator.isFlaggedAsUnreliable)}
                          disabled={flaggingEvaluator === evaluator.evaluator.id}
                          className="px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                          style={{
                            backgroundColor: evaluator.isFlaggedAsUnreliable ? colors.success : colors.warning,
                            color: "#FFFFFF"
                          }}
                        >
                          {flaggingEvaluator === evaluator.evaluator.id ? (
                            <FiRefreshCw className="animate-spin" />
                          ) : evaluator.isFlaggedAsUnreliable ? (
                            <>
                              <FiCheckCircle /> Unflag
                            </>
                          ) : (
                            <>
                              <FiFlag /> Flag as Unreliable
                            </>
                          )}
                        </motion.button>

                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="0"
                            max="2"
                            step="0.1"
                            value={adjustingWeight === evaluator.evaluator.id ? newWeight : evaluator.trustWeightMultiplier}
                            onChange={(e) => setNewWeight(parseFloat(e.target.value))}
                            className="flex-1 px-3 py-2 rounded border text-sm"
                            style={{
                              backgroundColor: colors.bg,
                              borderColor: colors.border,
                              color: colors.text
                            }}
                            disabled={adjustingWeight !== evaluator.evaluator.id}
                          />
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              if (adjustingWeight === evaluator.evaluator.id) {
                                adjustTrustWeight(evaluator.evaluator.id);
                              } else {
                                setAdjustingWeight(evaluator.evaluator.id);
                                setNewWeight(evaluator.trustWeightMultiplier);
                              }
                            }}
                            disabled={adjustingWeight === evaluator.evaluator.id}
                            className="px-3 py-2 rounded-lg font-medium flex items-center gap-1 disabled:opacity-50"
                            style={{
                              backgroundColor: colors.accent,
                              color: "#FFFFFF"
                            }}
                          >
                            {adjustingWeight === evaluator.evaluator.id ? (
                              <FiRefreshCw className="animate-spin" />
                            ) : (
                              <>
                                <FiTrendingUp size={14} /> Adjust
                              </>
                            )}
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {loading && (
          <motion.div
            className="text-center py-8"
            style={{ color: colors.textMuted }}
          >
            <FiRefreshCw className="animate-spin mx-auto mb-2" size={24} />
            Loading credibility statistics...
          </motion.div>
        )}

        {/* Empty State */}
        {!credibilityStats && !loading && selectedExam && (
          <motion.div
            className="text-center py-12"
            style={{ color: colors.textMuted }}
          >
            <FiTrendingUp size={48} className="mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-medium mb-2">No Credibility Data</h3>
            <p className="mb-4">
              Credibility scores haven't been calculated for this exam yet.
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={calculateCredibility}
              className="px-6 py-3 rounded-lg font-medium"
              style={{
                backgroundColor: colors.accent,
                color: "#FFFFFF"
              }}
            >
              Calculate Now
            </motion.button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default TeacherEvaluatorCredibility;