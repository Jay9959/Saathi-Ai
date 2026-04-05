require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function list() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // listModels is not on the genAI instance, but we can try 
    // to check gemini-1.5-pro status or test a simple query
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    const result = await model.generateContent("hi");
    console.log("Success: gemini-1.5-pro works");
  } catch (e) {
    console.error("Fail: gemini-1.5-pro failed with", e.message);
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-8b' });
    const result = await model.generateContent("hi");
    console.log("Success: gemini-1.5-flash-8b works");
  } catch (e) {
    console.error("Fail: gemini-1.5-flash-8b failed with", e.message);
  }
}
list();
