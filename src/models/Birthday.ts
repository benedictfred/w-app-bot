import mongoose from "mongoose";

const BirthdaySchema = new mongoose.Schema({
  name: String,
  phone: String,
  birthday: String,
});

export const Birthday = mongoose.model("Birthday", BirthdaySchema);
