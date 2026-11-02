import mongoose from 'mongoose';

/**
 * URL validation regex helper for image URLs (http or https)
 */
const isValidHttpUrl = (str) => {
  if (!str) return true; // Optional field
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
};

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required for a post']
    },
    content: {
      type: String,
      required: [true, 'Post content is required'],
      trim: true,
      minlength: [1, 'Post content cannot be empty'],
      maxlength: [1000, 'Post content cannot exceed 1000 characters']
    },
    imageUrl: {
      type: String,
      default: '',
      trim: true,
      validate: {
        validator: isValidHttpUrl,
        message: 'Image URL must be a valid HTTP or HTTPS web address'
      }
    },
    likes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  {
    timestamps: true
  }
);

// Index for chronological feed sorting (newest first)
postSchema.index({ createdAt: -1 });

// Compound index for querying user-specific posts chronologically
postSchema.index({ author: 1, createdAt: -1 });

const Post = mongoose.model('Post', postSchema);

export default Post;
