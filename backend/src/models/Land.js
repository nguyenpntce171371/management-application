import mongoose from "mongoose";

export const LandSchema = new mongoose.Schema({
    landType: String,
    streetDescription: String,
    location: String,
    landArea: String,
    ontLandPrice: String
});
