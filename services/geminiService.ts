import { GoogleGenAI, Type } from "@google/genai";
import { ModelType, Attribute } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const suggestAttributes = async (
  entityName: string,
  modelType: ModelType
): Promise<Partial<Attribute>[]> => {
  if (!process.env.API_KEY) {
    console.warn("No API Key provided for Gemini.");
    return [];
  }

  const prompt = `
    I am designing a ${modelType} data model.
    Suggest 5 relevant attributes (columns/fields) for an entity named "${entityName}".
    Include standard data types suitable for a ${modelType} model (e.g., VARCHAR for Physical, String for Logical).
    Mark likely Primary Keys.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              dataType: { type: Type.STRING },
              isPrimaryKey: { type: Type.BOOLEAN },
              isNullable: { type: Type.BOOLEAN },
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    
    const parsed = JSON.parse(text);
    return parsed.map((item: any) => ({
      ...item,
      id: crypto.randomUUID()
    }));

  } catch (error) {
    console.error("Gemini suggestion failed:", error);
    return [];
  }
};

export const explainModel = async (modelName: string, entities: any[]): Promise<string> => {
  if (!process.env.API_KEY) return "AI Key missing.";

  const prompt = `
    Analyze this data model named "${modelName}".
    Entities: ${JSON.stringify(entities.map(e => ({ name: e.name, attributes: e.attributes.map((a: any) => a.name) })))}
    Provide a concise 2-sentence summary of what this system likely represents.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Could not generate explanation.";
  } catch (e) {
    return "Error generating explanation.";
  }
};