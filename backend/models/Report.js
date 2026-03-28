// models/Report.js
import { Schema, model } from "mongoose";

const ReportSchema = new Schema({
    username: { type: String, required: true },
    quizName:   { type: String, required: true },
    score:      { type: Number, required: true },
    total:      { type: Number, required: true },
    autoSubmitted: { type: Boolean, default: false },  // ✅ Added for auto-submit tracking
    reason: { type: String },  // ✅ Added for auto-submit reason
    questions: [{
        questionText:      { type: String,   required: true },
        options:           { type: [String], required: true },
        userAnswer:        { type: String,   required: true },
        userAnswerText:    { type: String,   required: true },
        correctAnswer:     { type: String,   required: true },
        correctAnswerText: { type: String,   required: true },
        answerTime:        { type: Number,   required: true },
        difficulty:        { type: String,   default: "medium" }  // ✅ Added to match frontend
    }]
}, { timestamps: true });

export default model("Report", ReportSchema);
