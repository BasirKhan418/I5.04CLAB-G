import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const AccessLogSchema = new Schema(
  {
    kind: { type: String, enum: ["member", "visitor"], required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    displayName: { type: String, required: true, trim: true },
    reason: { type: String, default: null, trim: true },
    direction: { type: String, enum: ["in", "out"], required: true },
    method: {
      type: String,
      enum: ["pin", "otp", "visitor"],
      required: true,
    },
    faceKey: { type: String, default: null },
    voiceKey: { type: String, default: null },
    status: {
      type: String,
      enum: ["pending", "approved", "denied"],
      default: "approved",
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    notifiedAt: { type: Date, default: null },
    createdAt: { type: Date },
    updatedAt: { type: Date },
  },
  { timestamps: true }
);

AccessLogSchema.index({ userId: 1, createdAt: -1 });
AccessLogSchema.index({ createdAt: -1 });
AccessLogSchema.index({ status: 1, kind: 1, createdAt: -1 });

export type AccessLogDoc = InferSchemaType<typeof AccessLogSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AccessLog: Model<AccessLogDoc> =
  (mongoose.models.AccessLog as Model<AccessLogDoc>) ??
  mongoose.model<AccessLogDoc>("AccessLog", AccessLogSchema);
