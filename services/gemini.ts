
import { GoogleGenAI, Type } from "@google/genai";
import { MaterialItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Phase 1: Structure Scanning ---
const STRUCTURE_SCAN_PROMPT = `
你是一名资深的文档分析师。请阅读这份工程图纸文件（PDF或图片）。
你的任务是**建立设备目录索引**，不需要提取详细材料。

请识别文件中包含的所有设备，并指出它们所在的**页码范围**。
注意：一份文件可能包含多台设备，每台设备可能占用 1 页或多页。

输出 JSON 格式：
{
  "equipments": [
    {
      "tag": "设备位号 (如 V-2404)",
      "name": "设备名称 (如 缓冲罐)",
      "pageRange": "页码范围描述 (如 '第1-3页' 或 '全文件')"
    }
  ]
}
请使用中文输出。
`;

// --- Phase 2: Detail Extraction ---
const DETAIL_EXTRACTION_PROMPT = `
你是一位专业的压力容器造价工程师。
请针对文件中的特定设备（由用户指定位号和页码范围）进行深度分析。

目标设备位号: {{TARGET_TAG}}
关注页码/区域: {{PAGE_CONTEXT}}

请提取该设备的：
1. 规格尺寸 (Specification)
2. 主体材质 (Main Material)
3. 图纸设计总重 (Design Weight, kg)
4. 详细材料清单 (BOM) - 包含板材、锻件、接管等。

输出严格的 JSON 格式。
`;

export const scanDocumentStructure = async (base64Data: string, mimeType: string): Promise<{tag: string, name: string, pageRange: string}[]> => {
  try {
     let finalMimeType = mimeType || 'image/jpeg';
     if (finalMimeType === 'application/octet-stream') finalMimeType = 'image/jpeg';

     const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType: finalMimeType, data: base64Data } },
          { text: STRUCTURE_SCAN_PROMPT }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                equipments: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            tag: { type: Type.STRING },
                            name: { type: Type.STRING },
                            pageRange: { type: Type.STRING }
                        }
                    }
                }
            }
        }
      }
    });

    const json = JSON.parse(response.text || "{}");
    return json.equipments || [];
  } catch (error) {
    console.error("Structure Scan Error:", error);
    throw new Error("无法识别文件结构，请确保文件清晰。");
  }
};

export const extractEquipmentDetails = async (
    base64Data: string, 
    mimeType: string, 
    targetTag: string, 
    pageRange: string
): Promise<any> => {
    try {
        let finalMimeType = mimeType || 'image/jpeg';
        
        const prompt = DETAIL_EXTRACTION_PROMPT
            .replace('{{TARGET_TAG}}', targetTag)
            .replace('{{PAGE_CONTEXT}}', pageRange);

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: {
                parts: [
                    { inlineData: { mimeType: finalMimeType, data: base64Data } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                // Re-using the schema logic from previous version but optimized
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    tag: { type: Type.STRING },
                    name: { type: Type.STRING },
                    specification: { type: Type.STRING },
                    mainMaterial: { type: Type.STRING },
                    designWeight: { type: Type.NUMBER },
                    materials: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          material: { type: Type.STRING },
                          specification: { type: Type.STRING },
                          weight: { type: Type.NUMBER },
                          quantity: { type: Type.NUMBER },
                          category: { type: Type.STRING, enum: ["plate", "forging", "pipe", "consumable", "other"] }
                        },
                        required: ["name", "material", "quantity"]
                      }
                    }
                  }
                }
            }
        });

        const jsonStr = response.text || "{}";
        // Simple cleanup if model wraps in markdown despite config
        const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '');
        return JSON.parse(cleanJson);

    } catch (error) {
        console.error("Detail Extraction Error:", error);
        throw error;
    }
}

// Compatibility function for ExtractionView
export const analyzeDrawingForMaterials = async (base64Data: string, mimeType: string) => {
  try {
     const equipments = await scanDocumentStructure(base64Data, mimeType);
     const detailPromises = equipments.map(eq => 
        extractEquipmentDetails(base64Data, mimeType, eq.tag, eq.pageRange).then(details => ({
            ...eq,
            ...details
        })).catch(() => ({
            ...eq,
            materials: []
        }))
     );
     const fullEquipments = await Promise.all(detailPromises);
     return { equipments: fullEquipments };
  } catch (error) {
      console.error("Legacy Analysis failed:", error);
      throw error;
  }
};

// Keep the pricing function
export const findMaterialPrices = async (materials: string[]): Promise<Record<string, number>> => {
  if (materials.length === 0) return {};
  const uniqueMaterials = Array.from(new Set(materials)).join(", ");
  const prompt = `查找以下压力容器材料在中国市场的当前平均单价（人民币/kg）：${uniqueMaterials}。
  请直接返回 JSON: { "prices": [{ "material": "name", "pricePerKg": 10 }] }`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
    });
    
    let jsonStr = response.text?.trim() || "{}";
    if (jsonStr.includes("```")) jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '');
    const start = jsonStr.indexOf('{');
    const end = jsonStr.lastIndexOf('}');
    if(start > -1 && end > -1) jsonStr = jsonStr.substring(start, end+1);

    const data = JSON.parse(jsonStr);
    const priceMap: Record<string, number> = {};
    if (data.prices && Array.isArray(data.prices)) {
      data.prices.forEach((p: any) => {
        if (p.material && p.pricePerKg) priceMap[p.material] = p.pricePerKg;
      });
    }
    return priceMap;
  } catch (error) {
    return {};
  }
};

export const chatWithContext = async (
  history: { role: string; parts: { text: string }[] }[],
  currentMessage: string,
  docContext?: string, // Base64 image of the doc
  dataContext?: string // JSON string of extracted data
) => {
    
    const parts: any[] = [{ text: currentMessage }];
    if (docContext) {
        parts.unshift({
            inlineData: {
                mimeType: "image/jpeg", // Assuming screenshot is jpeg
                data: docContext
            }
        });
        parts.push({ text: "请参考附带的图纸截图回答。" });
    }
    
    if (dataContext) {
        parts.push({ text: `参考数据: ${dataContext}` });
    }

    const chat = ai.chats.create({
        model: "gemini-3-pro-preview", // Use Pro for better reasoning on images
        history: history,
        config: {
            systemInstruction: "你是一位压力容器专家。用户可能会发送图纸截图或询问数据。请根据提供的视觉信息和数据准确回答。"
        }
    });

    // Fix: sendMessage takes { message: ... } and role is implicit for the user turn being sent.
    const result = await chat.sendMessage({ message: parts });
    return result.text;
}
