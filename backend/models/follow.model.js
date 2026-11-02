import mongoose from 'mongoose';

const followSchema = new mongoose.Schema(
  {
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Follower is required']
    },
    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Following user is required']
    }
  },
  { timestamps: true }
);

// Unique compound index — prevents a user from following the same person twice
followSchema.index({ follower: 1, following: 1 }, { unique: true });

// Indexes for efficient follower/following list lookups
followSchema.index({ following: 1, createdAt: -1 }); // list followers of a user
followSchema.index({ follower: 1, createdAt: -1 }); // list who a user follows

const Follow = mongoose.model('Follow', followSchema);

export default Follow;
