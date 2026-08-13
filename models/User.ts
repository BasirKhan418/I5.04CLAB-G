import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      default: null,
      sparse: true,
      unique: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["superadmin", "admin", "member"],
      default: "member",
    },
    pinHash: { type: String, required: true },
    mustChangePin: { type: Boolean, default: true },
    notifyWhatsApp: { type: Boolean, default: true },
    faceKey: { type: String, default: null },
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof UserSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) ??
  mongoose.model<UserDoc>("User", UserSchema);
