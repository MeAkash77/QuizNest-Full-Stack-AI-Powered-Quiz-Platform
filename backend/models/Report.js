// models/Report.js
import { Schema, model } from "mongoose";

const ReportSchema = new Schema({
    username: { type: String, required: true },
    quizName: { type: String, required: true },
    score: { type: Number, required: true },
    total: { type: Number, required: true },
    autoSubmitted: { type: Boolean, default: false },  // ✅ Added for auto-submit tracking
    reason: { type: String, default: null },  // ✅ Added for auto-submit reason
    questions: [{
        questionText: { type: String, required: true },
        options: { type: [String], required: true },
        userAnswer: { type: String, required: true },
        userAnswerText: { type: String, required: true },
        correctAnswer: { type: String, required: true },
        correctAnswerText: { type: String, required: true },
        answerTime: { type: Number, required: true, default: 0 },
        difficulty: { type: String, default: "medium" }  // ✅ Added to match frontend
    }]
}, { 
    timestamps: true 
});

// Add index for faster queries
ReportSchema.index({ username: 1, createdAt: -1 });
ReportSchema.index({ quizName: 1, username: 1 });

// Add validation to ensure correctAnswerText is always provided
ReportSchema.pre('validate', function(next) {
    this.questions.forEach((question, index) => {
        if (!question.correctAnswerText || question.correctAnswerText.trim() === '') {
            // Fallback to the letter if text is missing
            if (question.correctAnswer) {
                question.correctAnswerText = `Option ${question.correctAnswer}`;
            } else {
                question.correctAnswerText = "Not Available";
            }
        }
        if (!question.userAnswerText || question.userAnswerText.trim() === '') {
            if (question.userAnswer && question.userAnswer !== "Not Answered") {
                question.userAnswerText = `Option ${question.userAnswer}`;
            } else {
                question.userAnswerText = "Not Answered";
            }
        }
    });
    next();
});

// Add method to get formatted report data
ReportSchema.methods.getFormattedReport = function() {
    const totalQuestions = this.questions.length;
    const correctCount = this.questions.filter(q => q.userAnswer === q.correctAnswer).length;
    const percentage = (this.score / this.total) * 100;
    
    return {
        id: this._id,
        username: this.username,
        quizName: this.quizName,
        score: this.score,
        total: this.total,
        percentage: percentage,
        correctCount: correctCount,
        incorrectCount: totalQuestions - correctCount,
        autoSubmitted: this.autoSubmitted,
        reason: this.reason,
        submittedAt: this.createdAt,
        questions: this.questions.map(q => ({
            ...q.toObject(),
            isCorrect: q.userAnswer === q.correctAnswer
        }))
    };
};

// Add static method to get user statistics
ReportSchema.statics.getUserStats = async function(username) {
    const reports = await this.find({ username }).sort({ createdAt: -1 });
    
    if (reports.length === 0) {
        return {
            totalQuizzesTaken: 0,
            averageScore: 0,
            bestScore: 0,
            worstScore: 0,
            totalQuestionsAnswered: 0,
            correctAnswers: 0,
            accuracy: 0
        };
    }
    
    const totalScore = reports.reduce((sum, report) => sum + report.score, 0);
    const totalMarks = reports.reduce((sum, report) => sum + report.total, 0);
    const totalQuestions = reports.reduce((sum, report) => sum + report.questions.length, 0);
    const totalCorrect = reports.reduce((sum, report) => 
        sum + report.questions.filter(q => q.userAnswer === q.correctAnswer).length, 0
    );
    
    const scores = reports.map(r => (r.score / r.total) * 100);
    
    return {
        totalQuizzesTaken: reports.length,
        averageScore: totalMarks > 0 ? (totalScore / totalMarks) * 100 : 0,
        bestScore: Math.max(...scores),
        worstScore: Math.min(...scores),
        totalQuestionsAnswered: totalQuestions,
        correctAnswers: totalCorrect,
        accuracy: totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0,
        recentReports: reports.slice(0, 5).map(r => r.getFormattedReport())
    };
};

export default model("Report", ReportSchema);
