import { GoogleGenAI, Type } from "@google/genai";
import { InsightResponse } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface SoQLQuery {
  $select?: string;
  $where?: string;
  $group?: string;
  $order?: string;
  $limit?: string;
}

export const generateInsights = async (
  profile: any,
  pre_computed_insights: any,
  user_question?: string
): Promise<InsightResponse> => {
  const system_prompt = `You are a data analyst assistant for the City of Austin 
    Open Data Portal. Your job is to analyze dataset profiles and pre-computed 
    statistics to surface the most important, actionable, and interesting 
    insights for the user.

    RULES:
    1. Prioritize insights by real-world impact and relevance to Austin residents.
    2. Express insights in plain, non-technical English.
    3. Suggest specific actions or follow-up questions when possible.
    4. Recommend the best visualization type for each insight.
    5. Flag any data quality issues you notice.
    6. Return your response in the following JSON structure.`;

  const user_prompt = `
    ## Dataset Profile
    ${JSON.stringify(profile, null, 2)}

    ## Pre-Computed Statistical Findings
    ${JSON.stringify(pre_computed_insights, null, 2)}

    ${user_question ? `## User's Specific Question: ${user_question}` : ""}

    Please analyze this data and provide your top insights.
    `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: user_prompt,
    config: {
      systemInstruction: system_prompt,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          quick_facts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Punchy, Excel-like data facts (e.g., 'There were 500 of X', 'Y was the most common Z', 'Most activity happens in July')."
          },
          insights: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                importance: { type: Type.STRING, enum: ["high", "medium", "low"] },
                category: { type: Type.STRING, enum: ["trend", "outlier", "correlation", "distribution", "anomaly"] },
                recommended_chart: { type: Type.STRING, enum: ["bar", "line", "scatter", "pie", "map", "table"] },
                follow_up_question: { type: Type.STRING },
              },
              required: ["title", "description", "importance", "category", "recommended_chart", "follow_up_question"],
            },
          },
          data_quality_notes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["summary", "quick_facts", "insights", "data_quality_notes"],
      },
      temperature: 0.3,
    },
  });

  return JSON.parse(response.text!);
};

export const naturalLanguageToQuery = async (
  user_question: string,
  dataset_profile: any
): Promise<SoQLQuery> => {
  const prompt = `Given this dataset profile:
    ${JSON.stringify(dataset_profile, null, 2)}

    Translate the following user question into a Socrata SODA API 
    SoQL query parameter dictionary. Return ONLY valid JSON.

    User question: "${user_question}"

    Return format:
    {
        "$select": "...",
        "$where": "...",
        "$group": "...",
        "$order": "...",
        "$limit": "..."
    }
    
    Omit any keys that are not needed.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          $select: { type: Type.STRING },
          $where: { type: Type.STRING },
          $group: { type: Type.STRING },
          $order: { type: Type.STRING },
          $limit: { type: Type.STRING },
        },
      },
      temperature: 0.1,
    },
  });

  return JSON.parse(response.text!);
};
