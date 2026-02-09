import mongoose from "mongoose";

export const ConstructionSchema = new mongoose.Schema({
    area: String,
    description: String,
    qualityRemaining: String,
    unitPrice: String
});