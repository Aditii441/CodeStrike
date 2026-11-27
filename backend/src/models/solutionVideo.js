const { Schema, model } = require('mongoose');

const videoSchema = new Schema({
    problemId: { type: Schema.Types.ObjectId, ref: 'problem', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'user', required: true },
    cloudinaryPublicId: { type: String, required: true, unique: true },
    secureUrl: { type: String, required: true, match: /^https:\/\// },
    thumbnailUrl: { type: String, required: true, match: /^https:\/\// },
    duration: { type: Number, required: true, min: 0 },
    retiredAt: Date
}, { timestamps: true, autoIndex: false });

videoSchema.index({ problemId: 1 }, {
    name: 'one_active_video_per_problem',
    unique: true,
    partialFilterExpression: { retiredAt: null }
});

module.exports = model('solutionVideo', videoSchema);
