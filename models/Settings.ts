import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const SettingsSchema = new Schema(
  {
    key: { type: String, unique: true, default: "lab" },
    openwa: {
      apiUrl: { type: String, default: "", trim: true },
      sessionId: { type: String, default: "", trim: true },
      templateId: { type: String, default: "", trim: true },
      apiKey: { type: String, default: "", trim: true },
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  { timestamps: true }
);

export type SettingsDoc = InferSchemaType<typeof SettingsSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Settings: Model<SettingsDoc> =
  (mongoose.models.Settings as Model<SettingsDoc>) ??
  mongoose.model<SettingsDoc>("Settings", SettingsSchema);
