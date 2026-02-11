import mongoose from 'mongoose';

// Schema for getting high score of every shell runner owned by a particular user
const shellRunnersSchema = new mongoose.Schema({
  username: {
    type: String,
    immutable: true,
    required: true,
  },
  shellRunners: [
    {
      id: {
        type: String,
        required: 'Error: shell runner identifier (uri)',
      },
      highScore: {
        type: Number,
        required: 'Error: shell runner high score',
      },
    },
  ],
  updatedAt: {
    type: Date,
    immutable: false,
    default: () => {
      Date.now();
    },
  },
});

export default
  mongoose.models.shellrunner ||
  mongoose.model('shellrunner', shellRunnersSchema);
